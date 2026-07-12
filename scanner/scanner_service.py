"""Standalone HTTP service for the mail scanner (for CRM-droplet container).

Exposes minimal admin surface:
  GET  /status
  GET  /config
  PUT  /config   (body with create_* / action_toggles)
  GET  /log?limit=200
  POST /reprocess  ({"conversation_ids": [..]} or {"all": true} for verification)

It starts the scanner thread using the same mail_scanner module (bot creds via env).
Intended to run on the OnlyOffice network; dashboard proxies admin calls to it.
"""

from __future__ import annotations

import json
import os
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Import the library (same module used by dashboard or moved into scanner container)
import mail_scanner

PORT = int(os.environ.get("SCANNER_PORT", "8787"))
ADMIN_TOKEN = os.environ.get("SCANNER_ADMIN_TOKEN", "") or os.environ.get("SCANNER_SERVICE_TOKEN", "")

# Ensure mail_scanner is configured from env at import/start time.
# The caller (or docker entry) should have set SCANNER_CRM_EMAIL / SCANNER_CRM_PASSWORD etc.
# We also apply any persisted scanner_behavior from contractors.json (mail_scanner handles this on configure).

def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)

def _read_body(handler: BaseHTTPRequestHandler) -> bytes:
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except Exception:
        length = 0
    return handler.rfile.read(length) if length else b""

def _require_admin(handler: BaseHTTPRequestHandler, cached_body: bytes | None = None) -> tuple[bool, bytes]:
    """Check admin token from header or JSON body. Returns (authorized, body_bytes).
    The caller should pass cached_body=None on first call; _require_admin reads
    the body and returns it so the handler can reuse it without a second read."""
    if not ADMIN_TOKEN:
        return True, cached_body or b""
    supplied = handler.headers.get("X-Scanner-Admin-Token", "") or ""
    if supplied == ADMIN_TOKEN:
        return True, cached_body or b""
    # Also allow token in JSON body for convenience from UI proxies
    body = cached_body if cached_body is not None else _read_body(handler)
    try:
        parsed = json.loads(body or b"{}")
        if parsed.get("admin_token") == ADMIN_TOKEN:
            return True, body
    except Exception:
        pass
    _json_response(handler, 403, {"error": "Scanner admin token required"})
    return False, body

class ScannerHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):  # quieter
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/status":
            try:
                s = mail_scanner.get_scanner_status()
            except Exception as e:
                _json_response(self, 500, {"error": str(e)})
                return
            _json_response(self, 200, s)
            return

        if path == "/config":
            try:
                cfg = mail_scanner.get_contractors() or {}
                sb = cfg.get("scanner_behavior") or {}
                at = cfg.get("action_toggles") or {}
            except Exception:
                sb, at = {}, {}
            _json_response(self, 200, {
                "create_deals": bool(sb.get("create_deals", mail_scanner.SCANNER_CREATE_DEALS)),
                "create_tasks": bool(sb.get("create_tasks", mail_scanner.SCANNER_CREATE_TASKS)),
                "post_notes": bool(sb.get("post_notes", mail_scanner.SCANNER_POST_NOTES)),
                "notify_users": bool(sb.get("notify_users", mail_scanner.SCANNER_NOTIFY_USERS)),
                "action_toggles": at,
                "dry_run": not any([
                    bool(sb.get("create_deals", mail_scanner.SCANNER_CREATE_DEALS)),
                    bool(sb.get("create_tasks", mail_scanner.SCANNER_CREATE_TASKS)),
                    bool(sb.get("post_notes", mail_scanner.SCANNER_POST_NOTES)),
                    bool(sb.get("notify_users", mail_scanner.SCANNER_NOTIFY_USERS)),
                ]),
                "admin_token_required": bool(ADMIN_TOKEN),
            })
            return

        if path == "/log":
            try:
                limit = 200
                ls = (qs.get("limit") or [""])[0]
                if ls.isdigit():
                    limit = int(ls)
                entries = mail_scanner.get_scanner_log(limit)
            except Exception as e:
                _json_response(self, 500, {"error": str(e)})
                return
            _json_response(self, 200, {"entries": entries})
            return

        _json_response(self, 404, {"error": "Not found"})

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/config":
            if not _require_admin(self)[0]:
                return
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON"})
                return
            data = payload.get("scanner_behavior") if isinstance(payload, dict) and isinstance(payload.get("scanner_behavior"), dict) else payload
            try:
                changed = mail_scanner.configure_scanner_behavior(**data)
            except Exception as e:
                _json_response(self, 500, {"error": str(e)})
                return
            # Persist like the dashboard does
            try:
                cfg = mail_scanner.get_contractors() or {}
                if not isinstance(cfg, dict):
                    cfg = {}
                sb = cfg.get("scanner_behavior") or {}
                if not isinstance(sb, dict):
                    sb = {}
                at = cfg.get("action_toggles") or {}
                if not isinstance(at, dict):
                    at = {}
                for k, v in changed.items():
                    short = k.replace("SCANNER_", "").lower().replace("_", "_")
                    if short in ("create_deals", "create_tasks", "post_notes", "notify_users"):
                        sb[short] = bool(v)
                    if short in ("link_email","post_notes","create_tasks","create_deals","notify_users","apply_bot_review_mail_tag","mark_read"):
                        at[short] = bool(v)
                cfg["scanner_behavior"] = sb
                if at:
                    cfg["action_toggles"] = at
                mail_scanner.update_contractors(cfg)
            except Exception:
                pass
            _json_response(self, 200, {"ok": True, "changed": changed})
            return

        _json_response(self, 404, {"error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/reprocess":
            ok, body = _require_admin(self)
            if not ok:
                return
            try:
                payload = json.loads(body or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON"})
                return
            ids = payload.get("conversation_ids") or payload.get("ids") or []
            if not ids:
                _json_response(self, 400, {"error": "conversation_ids required"})
                return
            # Convert to int list
            try:
                int_ids = [int(x) for x in ids]
            except (ValueError, TypeError):
                _json_response(self, 400, {"error": "ids must be integers"})
                return
            try:
                results = mail_scanner.reprocess_conversations(int_ids)
            except Exception as e:
                _json_response(self, 500, {"error": str(e)})
                return
            _json_response(self, 200, {"results": results})
            return

        _json_response(self, 404, {"error": "Not found"})

def main():
    # Start the background scanner using env-configured creds + persisted toggles.
    # mail_scanner.start_scanner will read SCANNER_* and also re-apply persisted scanner_behavior.
    mail_scanner.start_scanner()

    server = ThreadingHTTPServer(("0.0.0.0", PORT), ScannerHandler)
    print(f"Scanner service listening on :{PORT} (admin_token_required={bool(ADMIN_TOKEN)})")
    server.serve_forever()

if __name__ == "__main__":
    main()
