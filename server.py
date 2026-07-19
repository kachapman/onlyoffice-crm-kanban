#!/usr/bin/env python3
"""Sietch CRM v3.0 — Standalone server with PostgreSQL backend.

Replaces OnlyOffice CRM proxy with direct database queries.
All data owned locally. Zero external API calls.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import hmac
import io
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse, urlencode

import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("sietch_server")

from ics_calendar import _MAX_ICS_BYTES, is_allowed_calendar_url, parse_ics_calendar

# ── Version ────────────────────────────────────────────────────────────────────
APP_VERSION = "dev"
try:
    version_path = Path(__file__).parent / "VERSION"
    if version_path.exists():
        APP_VERSION = version_path.read_text().strip()
except Exception:
    pass

# ── Local store imports (unchanged from v2) ────────────────────────────────────
from user_profile_store import load_user_profile, save_user_profile
from event_log_store import append_event_log, load_event_log, list_users_with_logs
from crm_bot_store import (
    add_mapping, cancel_code, cancel_code_by_value,
    generate_code, get_mapping_by_chat, get_pending_codes,
    get_usage_stats, list_mappings, remove_mapping,
    remove_mapping_by_chat, set_nickname, set_verify_chat_id,
    track_request, verify_code,
)
from presence_store import (
    append_dm, clear_conversation, clean_stale_presence_records,
    clear_auto_status, get_conversation, get_portal_presence_snapshot,
    get_recent_dms_for_user, load_user_presence, load_user_last_read_dms,
    mark_messages_read, save_user_presence, set_last_read_dm,
    set_status, touch_crm_activity, touch_heartbeat,
)
from notification_dispatcher import start_dispatcher, stop_dispatcher

# ── Config ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"


def _load_env_file() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file()

PORT = int(os.environ.get("PORT", "8766"))
SESSION_COOKIE = "vanguard_session"
DATA_DIR = ROOT / "data"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
PRESENCE_AUTO_STATUS_TIMEOUT_S = 300
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
PHOTO_STORAGE_PATH = Path(os.getenv("PHOTO_STORAGE_PATH", str(DATA_DIR / "photos")))
DOCUMENT_STORAGE_PATH = Path(os.getenv("DOCUMENT_STORAGE_PATH", str(DATA_DIR / "documents")))
DOCS_JWT_SECRET = os.environ.get("DOCS_JWT_SECRET", "")
DOCS_INTERNAL_URL = os.environ.get("DOCS_INTERNAL_URL", "").rstrip("/")
DOCS_PUBLIC_URL = os.environ.get("DOCS_PUBLIC_URL", "").rstrip("/")

# ── DB init ────────────────────────────────────────────────────────────────────
import db
import auth as auth_mod

db.init_db()

# ── Helpers ────────────────────────────────────────────────────────────────────


def _json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict | list) -> None:
    body = json.dumps(payload, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_body(handler: SimpleHTTPRequestHandler) -> bytes:
    length = int(handler.headers.get("Content-Length", "0") or 0)
    if length <= 0:
        return b""
    return handler.rfile.read(length)


def _session_token(handler: SimpleHTTPRequestHandler) -> str | None:
    jar = cookies.SimpleCookie(handler.headers.get("Cookie", ""))
    tok = jar.get(SESSION_COOKIE)
    return tok.value if tok else None


def _require_auth(handler: SimpleHTTPRequestHandler) -> dict | None:
    """Return user dict or None after sending error response."""
    token = _session_token(handler)
    if not token:
        _json_response(handler, 401, {"error": "Not authenticated"})
        return None
    user = auth_mod.get_session_user(token)
    if not user:
        _json_response(handler, 401, {"error": "Invalid or expired session"})
        return None
    return user


def _require_admin(handler: SimpleHTTPRequestHandler) -> dict | None:
    """Return admin user dict or None after sending error response."""
    user = _require_auth(handler)
    if not user:
        return None
    if not user.get("is_admin"):
        _json_response(handler, 403, {"error": "Forbidden"})
        return None
    return user


def _parse_iso_datetime(value: str):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


# ── JWT helpers (HS256, minimal stdlib implementation) ─────────────────────────


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    if pad != 4:
        s += "=" * pad
    return base64.urlsafe_b64decode(s.encode("ascii"))


def _sign_jwt(payload: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    enc_header = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    enc_payload = _b64url_encode(json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8"))
    signing_input = f"{enc_header}.{enc_payload}".encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{enc_header}.{enc_payload}.{_b64url_encode(sig)}"


def _proxy_document_server(method: str, ds_path: str, body: bytes | None = None, headers: dict | None = None, timeout: int = 30) -> tuple:
    """Forward a request to the internal OnlyOffice Document Server. Returns (status, body, content_type)."""
    if not DOCS_INTERNAL_URL:
        return 503, b'{"error": "Document Server not configured"}', "application/json"
    url = f"{DOCS_INTERNAL_URL}{ds_path}"
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=body, method=method, headers=req_headers, unverifiable=True)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(), resp.headers.get("Content-Type", "application/json")
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers.get("Content-Type", "application/json")
    except Exception:
        return 502, b'{"error": "Document Server unreachable"}', "application/json"


_EXT_TO_MIME = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "ppt": "application/vnd.ms-powerpoint",
    "pdf": "application/pdf",
    "txt": "text/plain",
    "csv": "text/csv",
}


def _guess_mime(filename: str) -> str:
    ext = Path(filename).suffix.lstrip(".").lower()
    return _EXT_TO_MIME.get(ext, "application/octet-stream")


def _document_type_from_ext(ext: str) -> str:
    ext = ext.lower()
    if ext in ("docx", "doc", "txt", "rtf", "odt"):
        return "word"
    if ext in ("xlsx", "xls", "csv", "ods"):
        return "cell"
    if ext in ("pptx", "ppt", "odp"):
        return "slide"
    return "word"


def _parse_multipart(body: bytes, content_type: str) -> dict:
    """Minimal multipart/form-data parser. Returns {fieldName: {filename, data, content-type}}."""
    # Parse boundary
    ct_parts = [p.strip() for p in content_type.split(";")]
    boundary = None
    for part in ct_parts:
        if part.startswith("boundary="):
            boundary = part[len("boundary="):].strip('"')
            break
    if not boundary:
        raise ValueError("boundary missing")
    b_boundary = ("--" + boundary).encode("latin-1")
    b_end = ("--" + boundary + "--").encode("latin-1")
    parts = body.split(b_boundary)
    result = {}
    for part in parts[1:]:
        part = part.lstrip(b"\r\n")
        if part.startswith(b_end):
            continue
        try:
            header_end = part.index(b"\r\n\r\n")
        except ValueError:
            continue
        headers_raw = part[:header_end].decode("latin-1")
        data = part[header_end + 4:]
        if data.endswith(b"\r\n"):
            data = data[:-2]
        # parse Content-Disposition
        cd_match = re.search(r'Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?', headers_raw, re.IGNORECASE)
        if not cd_match:
            continue
        name = cd_match.group(1)
        filename = cd_match.group(2)
        ct_match = re.search(r'Content-Type:\s*([^\r\n]+)', headers_raw, re.IGNORECASE)
        content_type_part = ct_match.group(1).strip() if ct_match else None
        if filename:
            result[name] = {"filename": filename, "data": data, "content-type": content_type_part}
        else:
            result[name] = {"data": data}
    return result


# ── Request Handler ────────────────────────────────────────────────────────────


class KanbanHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        if args and isinstance(args[0], str) and args[0].startswith("GET /api/"):
            return
        super().log_message(fmt, *args)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/api/"):
            self._handle_api_get()
            return
        super().do_GET()

    def send_head(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            return super().send_head()

        fs_path = self.translate_path(self.path)
        if os.path.isdir(fs_path):
            for index in ("index.html", "index.htm"):
                candidate = os.path.join(fs_path, index)
                if os.path.exists(candidate):
                    fs_path = candidate
                    break
            else:
                return super().send_head()
        elif not os.path.exists(fs_path):
            return super().send_head()

        ctype = self.guess_type(fs_path)
        try:
            with open(fs_path, "rb") as f:
                data = f.read()
        except OSError:
            self.send_error(404)
            return None

        accept = self.headers.get("Accept-Encoding", "")
        should_gzip = "gzip" in accept and len(data) > 1024
        if should_gzip:
            data = gzip.compress(data)

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        if should_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.end_headers()
        return io.BytesIO(data)

    def end_headers(self) -> None:
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def do_POST(self) -> None:
        if self.path == "/api/v2/auth/login":
            self._handle_login()
            return
        if self.path == "/api/v2/auth/logout":
            self._handle_logout()
            return
        if self.path.startswith("/api/"):
            self._handle_api_post_put("POST")
            return
        self.send_error(405, "Method Not Allowed")

    def do_PUT(self) -> None:
        if self.path.startswith("/api/"):
            self._handle_api_post_put("PUT")
            return
        self.send_error(405)

    def do_DELETE(self) -> None:
        if self.path.startswith("/api/"):
            self._handle_api_post_put("DELETE")
            return
        self.send_error(405)

    # ── Auth ────────────────────────────────────────────────────────────────

    def _handle_login(self) -> None:
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return

        email = str(payload.get("email") or payload.get("userName") or "").strip()
        password = str(payload.get("password") or "")
        if not email or not password:
            _json_response(self, 400, {"error": "Email and password are required"})
            return

        user = auth_mod.authenticate_user(email, password)
        if not user:
            _json_response(self, 401, {"error": "Invalid email or password"})
            return

        ip = self.client_address[0] if self.client_address else ""
        token = auth_mod.create_session(user["id"], ip)

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        cookie = cookies.SimpleCookie()
        cookie[SESSION_COOKIE] = token
        cookie[SESSION_COOKIE]["path"] = "/"
        cookie[SESSION_COOKIE]["httponly"] = True
        cookie[SESSION_COOKIE]["samesite"] = "Lax"
        if COOKIE_SECURE:
            cookie[SESSION_COOKIE]["secure"] = True
        self.send_header("Set-Cookie", cookie.output(header="").strip())
        body_out = json.dumps({
            "ok": True,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "displayName": user["display_name"],
                "isAdmin": user["is_admin"],
                "mustChangePassword": user["must_change_password"],
            },
        }).encode("utf-8")
        self.send_header("Content-Length", str(len(body_out)))
        self.end_headers()
        self.wfile.write(body_out)

    def _handle_logout(self) -> None:
        token = _session_token(self)
        if token:
            auth_mod.destroy_session(token)
        self.send_response(200)
        cookie = cookies.SimpleCookie()
        cookie[SESSION_COOKIE] = ""
        cookie[SESSION_COOKIE]["path"] = "/"
        cookie[SESSION_COOKIE]["max-age"] = "0"
        self.send_header("Set-Cookie", cookie.output(header="").strip())
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def _handle_password_reset_request(self) -> None:
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        email = str(payload.get("email") or "").strip().lower()
        if not email:
            _json_response(self, 400, {"error": "Email is required"})
            return
        user = auth_mod.get_user_by_email(email)
        if user:
            token = auth_mod.create_reset_token(user["id"])
            from smtp_client import send_password_reset_email
            reset_url = f"{self.headers.get('Origin', 'http://localhost:' + str(PORT))}/reset?token={token}"
            send_password_reset_email(email, reset_url)
        # Always return success to prevent email enumeration
        _json_response(self, 200, {"ok": True})

    def _handle_password_reset(self) -> None:
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        token = str(payload.get("token") or "").strip()
        new_password = str(payload.get("password") or "")
        if not token or not new_password:
            _json_response(self, 400, {"error": "Token and password are required"})
            return
        user_id = auth_mod.verify_reset_token(token)
        if not user_id:
            _json_response(self, 400, {"error": "Invalid or expired reset token"})
            return
        auth_mod.set_password(user_id, new_password)
        auth_mod.consume_reset_token(token)
        _json_response(self, 200, {"ok": True})

    def _handle_change_password(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        current = str(payload.get("currentPassword") or "")
        new_password = str(payload.get("newPassword") or "")
        if not current or not new_password:
            _json_response(self, 400, {"error": "Current and new password are required"})
            return
        row = db.query(
            "SELECT password_hash, password_salt FROM users WHERE id = %s",
            (user["id"],), fetch="one",
        )
        if not row or not row[0]:
            _json_response(self, 400, {"error": "No password set"})
            return
        if not auth_mod.verify_password(current, row[0], row[1]):
            _json_response(self, 401, {"error": "Current password is incorrect"})
            return
        auth_mod.set_password(user["id"], new_password)
        _json_response(self, 200, {"ok": True})

    # ── API GET Router ──────────────────────────────────────────────────────

    def _handle_api_get(self) -> None:
        api_path = urlparse(self.path).path
        qs = parse_qs(urlparse(self.path).query)

        # ── Config / Info ──
        if api_path == "/api/config":
            _json_response(self, 200, {"version": APP_VERSION})
            return
        if api_path == "/api/branding":
            try:
                row = db.query_one(
                    """SELECT company_name, logo_path, watermark_path, login_title,
                              header_eyebrow, header_title, primary_color, favicon_path
                       FROM branding ORDER BY id LIMIT 1"""
                )
                if row:
                    _json_response(self, 200, {
                        "companyName": row["company_name"] or "Sietch CRM",
                        "logoPath": row["logo_path"] or "/assets/sietch-logo.png",
                        "watermarkPath": row["watermark_path"],
                        "loginTitle": row["login_title"] or "Sietch CRM",
                        "headerEyebrow": row["header_eyebrow"] or "Sietch CRM",
                        "headerTitle": row["header_title"] or "Workspace <em>dashboard</em>",
                        "primaryColor": row["primary_color"] or "#3b82f6",
                        "faviconPath": row["favicon_path"] or "/favicon.ico",
                    })
                else:
                    _json_response(self, 200, {
                        "companyName": "Sietch CRM",
                        "logoPath": "/assets/sietch-logo.png",
                        "watermarkPath": None,
                        "loginTitle": "Sietch CRM",
                        "headerEyebrow": "Sietch CRM",
                        "headerTitle": "Workspace <em>dashboard</em>",
                        "primaryColor": "#3b82f6",
                        "faviconPath": "/favicon.ico",
                    })
            except Exception:
                logger.exception("Failed to load branding")
                _json_response(self, 200, {
                    "companyName": "Sietch CRM",
                    "logoPath": "/assets/sietch-logo.png",
                    "watermarkPath": None,
                    "loginTitle": "Sietch CRM",
                    "headerEyebrow": "Sietch CRM",
                    "headerTitle": "Workspace <em>dashboard</em>",
                    "primaryColor": "#3b82f6",
                    "faviconPath": "/favicon.ico",
                })
            return
        if api_path == "/api/changelog":
            cl = Path(__file__).parent / "CHANGELOG.md"
            body = cl.read_text("utf-8") if cl.exists() else "# Changelog\n\nNo changelog available."
            self.send_response(200)
            self.send_header("Content-Type", "text/markdown; charset=utf-8")
            self.send_header("Content-Length", str(len(body.encode("utf-8"))))
            self.end_headers()
            self.wfile.write(body.encode("utf-8"))
            return
        if api_path == "/api/session":
            user = None
            token = _session_token(self)
            if token:
                user = auth_mod.get_session_user(token)
            _json_response(self, 200, {"authenticated": user is not None, "user": user})
            return
        if api_path == "/api/health":
            try:
                row = db.query("SELECT 1", fetch="one")
                _json_response(self, 200, {"dbReachable": bool(row)})
            except Exception:
                _json_response(self, 200, {"dbReachable": False})
            return

        # ── Presence / Team (local store, unchanged) ──
        if api_path.startswith("/api/presence"):
            if api_path == "/api/presence/users":
                self._handle_presence_users()
                return
            if api_path == "/api/presence":
                self._handle_presence_get()
                return
            if api_path == "/api/presence/dm":
                self._handle_presence_dm_get()
                return
            self.send_error(404)
            return

        # ── Event log (local store, unchanged) ──
        if api_path == "/api/event-log":
            self._handle_event_log_get()
            return
        if api_path == "/api/event-log/users":
            self._handle_event_log_users()
            return
        if api_path == "/api/event-log/all":
            self._handle_event_log_admin_get()
            return

        # ── User profile (local store, unchanged) ──
        if api_path == "/api/user-profile":
            self._handle_user_profile_get()
            return
        if api_path == "/api/dashboard-notes":
            self._handle_dashboard_notes_get()
            return

        # ── Calendar feed (local handler, unchanged) ──
        if api_path == "/api/calendar/feed":
            self._handle_calendar_feed()
            return

        # ── Admin check ──
        if api_path == "/api/check-admin":
            self._handle_check_admin()
            return

        # ── Bot customers (admin, unchanged) ──
        if api_path == "/api/bot-customers":
            self._handle_bot_customers_list()
            return
        if api_path.startswith("/api/bot/"):
            self._handle_bot_api_get()
            return

        # ── v2 API: Projects ──
        if api_path == "/api/v2/projects":
            self._handle_projects_list(qs)
            return
        m = re.match(r"^/api/v2/projects/(\d+)$", api_path)
        if m:
            self._handle_project_get(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/tags$", api_path)
        if m:
            self._handle_project_tags_get(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/custom-fields$", api_path)
        if m:
            self._handle_project_custom_fields_get(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/history$", api_path)
        if m:
            self._handle_project_history_get(int(m.group(1)), qs)
            return
        m = re.match(r"^/api/v2/projects/(\d+)/photos$", api_path)
        if m:
            self._handle_project_photos_get(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/photo-folders$", api_path)
        if m:
            self._handle_project_photo_folders_get(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/history/(\d+)/replies$", api_path)
        if m:
            self._handle_history_replies_get(int(m.group(1)), int(m.group(2)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/documents$", api_path)
        if m:
            self._handle_project_documents_get(int(m.group(1)))
            return

        # ── v2 API: Other resources ──
        if api_path == "/api/v2/stages":
            self._handle_stages_get()
            return
        if api_path == "/api/v2/tags":
            self._handle_tags_get()
            return
        if api_path == "/api/v2/custom-fields":
            self._handle_custom_fields_get()
            return
        if api_path == "/api/v2/contacts":
            self._handle_contacts_get(qs)
            return
        if api_path == "/api/v2/tasks":
            self._handle_tasks_get(qs)
            return
        if api_path == "/api/v2/users":
            self._handle_users_get()
            return
        if api_path == "/api/v2/me":
            self._handle_me_get()
            return
        if api_path == "/api/v2/notifications":
            self._handle_notifications_get(qs)
            return
        if api_path == "/api/v2/history-categories":
            self._handle_history_categories_get()
            return
        m = re.match(r"^/api/v2/documents/(\d+)$", api_path)
        if m:
            self._handle_document_download(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/documents/(\d+)/editor-config$", api_path)
        if m:
            self._handle_document_editor_config(int(m.group(1)))
            return

        # ── Batch tags ──
        if api_path == "/api/batch-opportunity-tags":
            self._handle_batch_opportunity_tags()
            return

        self.send_error(404)

    # ── API POST/PUT/DELETE Router ──────────────────────────────────────────

    def _handle_api_post_put(self, method: str) -> None:
        api_path = urlparse(self.path).path
        qs = parse_qs(urlparse(self.path).query)

        # ── Presence (local, unchanged) ──
        if api_path.startswith("/api/presence"):
            if api_path == "/api/presence/heartbeat" and method == "POST":
                self._handle_presence_heartbeat()
                return
            if api_path == "/api/presence/status" and method == "POST":
                self._handle_presence_status()
                return
            if api_path == "/api/presence/last-read" and method == "POST":
                self._handle_presence_last_read()
                return
            if api_path == "/api/presence/dm" and method == "POST":
                self._handle_presence_dm_post()
                return
            if api_path == "/api/presence/dm" and method == "DELETE":
                self._handle_presence_dm_clear()
                return
            self.send_error(404)
            return

        # ── Event log (local) ──
        if api_path == "/api/event-log" and method == "PUT":
            self._handle_event_log_put()
            return

        # ── User profile (local) ──
        if api_path == "/api/user-profile" and method == "PUT":
            self._handle_user_profile_put()
            return
        if api_path == "/api/dashboard-notes" and method == "PUT":
            self._handle_dashboard_notes_put()
            return

        # ── Password reset ──
        if api_path == "/api/v2/auth/reset-request" and method == "POST":
            self._handle_password_reset_request()
            return
        if api_path == "/api/v2/auth/reset" and method == "POST":
            self._handle_password_reset()
            return
        if api_path == "/api/v2/auth/change-password" and method == "POST":
            self._handle_change_password()
            return

        # ── Branding (admin) ──
        if api_path == "/api/branding" and method == "POST":
            user = _require_admin(self)
            if not user:
                return
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON body"})
                return
            try:
                existing = db.query_one("SELECT id FROM branding LIMIT 1")
                if existing:
                    db.execute(
                        """UPDATE branding SET
                            company_name = COALESCE(%s, company_name),
                            logo_path = COALESCE(%s, logo_path),
                            watermark_path = %s,
                            login_title = COALESCE(%s, login_title),
                            header_eyebrow = COALESCE(%s, header_eyebrow),
                            header_title = COALESCE(%s, header_title),
                            primary_color = COALESCE(%s, primary_color),
                            favicon_path = COALESCE(%s, favicon_path),
                            updated_at = NOW()
                        WHERE id = %s""",
                        (payload.get("companyName"), payload.get("logoPath"),
                         payload.get("watermarkPath"), payload.get("loginTitle"),
                         payload.get("headerEyebrow"), payload.get("headerTitle"),
                         payload.get("primaryColor"), payload.get("faviconPath"),
                         existing["id"]),
                    )
                else:
                    db.execute(
                        """INSERT INTO branding (company_name, logo_path, watermark_path,
                            login_title, header_eyebrow, header_title, primary_color, favicon_path)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                        (payload.get("companyName", "Sietch CRM"),
                         payload.get("logoPath", "/assets/sietch-logo.png"),
                         payload.get("watermarkPath"),
                         payload.get("loginTitle", "Sietch CRM"),
                         payload.get("headerEyebrow", "Sietch CRM"),
                         payload.get("headerTitle", "Workspace <em>dashboard</em>"),
                         payload.get("primaryColor", "#3b82f6"),
                         payload.get("faviconPath", "/favicon.ico")),
                    )
                _json_response(self, 200, {"ok": True})
            except Exception:
                logger.exception("Failed to update branding")
                _json_response(self, 500, {"error": "Failed to update branding"})
            return

        # ── Bot customers (admin) ──
        if api_path.startswith("/api/bot-customers"):
            self._handle_bot_customers_post_put(method)
            return
        if api_path.startswith("/api/bot/"):
            self._handle_bot_api_post(method)
            return

        # ── v2 API: Projects ──
        if api_path == "/api/v2/projects" and method == "POST":
            self._handle_project_create()
            return
        m = re.match(r"^/api/v2/projects/(\d+)$", api_path)
        if m and method == "PUT":
            self._handle_project_update(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)$", api_path)
        if m and method == "DELETE":
            self._handle_project_delete(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/tags$", api_path)
        if m and method == "POST":
            self._handle_project_tag_add(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/tags/(\d+)$", api_path)
        if m and method == "DELETE":
            self._handle_project_tag_remove(int(m.group(1)), int(m.group(2)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/custom-fields$", api_path)
        if m and method == "PUT":
            self._handle_project_custom_fields_update(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/history$", api_path)
        if m and method == "POST":
            self._handle_project_history_create(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/photos$", api_path)
        if m and method == "POST":
            self._handle_project_photo_upload(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/photo-folders$", api_path)
        if m and method == "POST":
            self._handle_project_photo_folder_add(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/history/(\d+)/replies$", api_path)
        if m and method == "POST":
            self._handle_history_reply_create(int(m.group(1)), int(m.group(2)))
            return
        m = re.match(r"^/api/v2/projects/(\d+)/documents$", api_path)
        if m and method == "POST":
            self._handle_project_document_upload(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/documents/(\d+)/callback$", api_path)
        if m and method == "POST":
            self._handle_document_callback(int(m.group(1)))
            return

        # ── v2 API: Resources ──
        if api_path == "/api/v2/stages" and method == "POST":
            self._handle_stage_create()
            return
        m = re.match(r"^/api/v2/stages/(\d+)$", api_path)
        if m and method == "PUT":
            self._handle_stage_update(int(m.group(1)))
            return
        if api_path == "/api/v2/tags" and method == "POST":
            self._handle_tag_create()
            return
        m = re.match(r"^/api/v2/tags/(\d+)$", api_path)
        if m and method == "PUT":
            self._handle_tag_update(int(m.group(1)))
            return
        if api_path == "/api/v2/custom-fields" and method == "POST":
            self._handle_custom_field_create()
            return
        m = re.match(r"^/api/v2/custom-fields/(\d+)$", api_path)
        if m and method == "PUT":
            self._handle_custom_field_update(int(m.group(1)))
            return
        if api_path == "/api/v2/contacts" and method == "POST":
            self._handle_contact_create()
            return
        m = re.match(r"^/api/v2/contacts/(\d+)$", api_path)
        if m and method == "PUT":
            self._handle_contact_update(int(m.group(1)))
            return
        if api_path == "/api/v2/tasks" and method == "POST":
            self._handle_task_create()
            return
        m = re.match(r"^/api/v2/tasks/(\d+)$", api_path)
        if m and method == "PUT":
            self._handle_task_update(int(m.group(1)))
            return
        if api_path == "/api/v2/users" and method == "POST":
            self._handle_user_create()
            return
        m = re.match(r"^/api/v2/users/(\d+)$", api_path)
        if m and method == "PUT":
            self._handle_user_update(int(m.group(1)))
            return

        # ── DELETE handlers ──
        m = re.match(r"^/api/v2/history/(\d+)$", api_path)
        if m and method == "DELETE":
            self._handle_history_event_delete(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/history-replies/(\d+)$", api_path)
        if m and method == "DELETE":
            self._handle_history_reply_delete(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/photos/(\d+)$", api_path)
        if m and method == "DELETE":
            self._handle_photo_delete(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/photo-folders/(\d+)$", api_path)
        if m and method == "DELETE":
            self._handle_photo_folder_delete(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/documents/(\d+)$", api_path)
        if m and method == "DELETE":
            self._handle_document_delete(int(m.group(1)))
            return
        m = re.match(r"^/api/v2/notifications/(\d+)/read$", api_path)
        if m and method == "PUT":
            self._handle_notification_mark_read(int(m.group(1)))
            return
        if api_path == "/api/v2/notifications/read-all" and method == "PUT":
            self._handle_notifications_mark_all_read()
            return

        self.send_error(404)

    # ════════════════════════════════════════════════════════════════════════
    # v2 API ENDPOINT HANDLERS
    # ════════════════════════════════════════════════════════════════════════

    # ── Projects ────────────────────────────────────────────────────────────

    def _handle_projects_list(self, qs: dict) -> None:
        user = _require_auth(self)
        if not user:
            return
        where = ["1=1"]
        params: list = []
        if "stage_type" in qs:
            where.append("o.stage_type = %s")
            params.append(int(qs["stage_type"][0]))
        if "contact_id" in qs:
            where.append("o.contact_id = %s")
            params.append(int(qs["contact_id"][0]))
        if "responsible_user_id" in qs:
            where.append("o.responsible_user_id = %s")
            params.append(int(qs["responsible_user_id"][0]))
        if "search" in qs:
            where.append("o.title ILIKE %s")
            params.append(f"%{qs['search'][0]}%")
        if "tag_id" in qs:
            where.append("o.id IN (SELECT opportunity_id FROM opportunity_tags WHERE tag_id = %s)")
            params.append(int(qs["tag_id"][0]))

        count = int(qs.get("count", ["500"])[0])
        start = int(qs.get("startIndex", ["0"])[0])
        sort_by = qs.get("sort_by", ["date_created"])[0]
        sort_order = qs.get("sort_order", ["descending"])[0]
        order = "DESC" if sort_order == "descending" else "ASC"
        sort_col = {"date_created": "o.created_at", "title": "o.title", "bid_value": "o.bid_value"}.get(sort_by, "o.created_at")

        where_sql = " AND ".join(where)
        rows = db.query(
            f"""SELECT o.id, o.title, o.description, o.stage_id, o.stage_type, o.bid_value,
                       o.expected_close_date, o.probability, o.contact_id, o.responsible_user_id,
                       o.is_private, o.created_at, o.created_by, o.updated_at,
                       s.title as stage_title, s.color as stage_color,
                       c.first_name, c.last_name, c.company
                FROM opportunities o
                LEFT JOIN stages s ON o.stage_id = s.id
                LEFT JOIN contacts c ON o.contact_id = c.id
                WHERE {where_sql}
                ORDER BY {sort_col} {order}
                LIMIT %s OFFSET %s""",
            (*params, count, start),
        )
        projects = []
        for r in rows:
            projects.append({
                "id": r[0], "title": r[1], "description": r[2],
                "stageId": r[3], "stageType": r[4], "bidValue": float(r[5]) if r[5] else None,
                "expectedCloseDate": str(r[6]) if r[6] else None, "probability": r[7],
                "contactId": r[8], "responsibleUserId": r[9], "isPrivate": r[10],
                "created": r[11].isoformat() if r[11] else None,
                "stage": {"title": r[14], "color": r[15]} if r[14] else None,
                "contact": {"displayName": f"{r[16] or ''} {r[17] or ''}".strip(), "company": r[18]} if r[16] or r[17] else None,
            })
        _json_response(self, 200, projects)

    def _handle_project_get(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        row = db.query(
            """SELECT o.id, o.title, o.description, o.stage_id, o.stage_type, o.bid_value,
                      o.expected_close_date, o.probability, o.contact_id, o.responsible_user_id,
                      o.is_private, o.created_at, o.created_by, o.updated_at,
                      s.title, s.color,
                      u1.display_name, u2.display_name,
                      c.first_name, c.last_name, c.company, c.email, c.phone
               FROM opportunities o
               LEFT JOIN stages s ON o.stage_id = s.id
               LEFT JOIN users u1 ON o.created_by = u1.id
               LEFT JOIN users u2 ON o.responsible_user_id = u2.id
               LEFT JOIN contacts c ON o.contact_id = c.id
               WHERE o.id = %s""",
            (opp_id,), fetch="one",
        )
        if not row:
            _json_response(self, 404, {"error": "Project not found"})
            return
        _json_response(self, 200, {
            "id": row[0], "title": row[1], "description": row[2],
            "stageId": row[3], "stageType": row[4], "bidValue": float(row[5]) if row[5] else None,
            "expectedCloseDate": str(row[6]) if row[6] else None, "probability": row[7],
            "contactId": row[8], "responsibleUserId": row[9], "isPrivate": row[10],
            "created": row[11].isoformat() if row[11] else None,
            "createdBy": row[12], "updatedAt": row[13].isoformat() if row[13] else None,
            "stage": {"title": row[14], "color": row[15]} if row[14] else None,
            "responsible": {"displayName": row[17]} if row[17] else None,
            "contact": {"displayName": f"{row[18] or ''} {row[19] or ''}".strip(), "company": row[20], "email": row[21], "phone": row[22]} if row[18] or row[19] else None,
        })

    def _handle_project_create(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        title = str(payload.get("title") or "").strip()
        if not title:
            _json_response(self, 400, {"error": "Title is required"})
            return
        stage_id = payload.get("stageId")
        bid_value = payload.get("bidValue")
        contact_id = payload.get("contactId")
        responsible_user_id = payload.get("responsibleUserId") or user["id"]
        description = str(payload.get("description") or "").strip() or None
        expected_close = str(payload.get("expectedCloseDate") or "").strip() or None
        is_private = bool(payload.get("isPrivate"))

        opp_id = db.insert_returning(
            """INSERT INTO opportunities (title, description, stage_id, stage_type, bid_value,
                   expected_close_date, contact_id, responsible_user_id, created_by, is_private)
               VALUES (%s, %s, %s, 0, %s, %s, %s, %s, %s, %s)
               RETURNING id""",
            (title, description, stage_id, bid_value, expected_close, contact_id, responsible_user_id, user["id"], is_private),
        )
        _json_response(self, 201, {"id": opp_id, "ok": True})

    def _handle_project_update(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        sets = ["updated_at = NOW()", "updated_by = %s"]
        params: list = [user["id"]]
        for field, col in [("title", "title"), ("description", "description"), ("stageId", "stage_id"),
                           ("bidValue", "bid_value"), ("contactId", "contact_id"),
                           ("responsibleUserId", "responsible_user_id"), ("isPrivate", "is_private"),
                           ("expectedCloseDate", "expected_close_date"), ("probability", "probability"),
                           ("stageType", "stage_type")]:
            if field in payload:
                sets.append(f"{col} = %s")
                params.append(payload[field])
        params.append(opp_id)
        db.execute(f"UPDATE opportunities SET {', '.join(sets)} WHERE id = %s", (*params,))
        _json_response(self, 200, {"ok": True})

    def _handle_project_delete(self, opp_id: int) -> None:
        user = _require_admin(self)
        if not user:
            return
        db.execute("DELETE FROM opportunities WHERE id = %s", (opp_id,))
        _json_response(self, 200, {"ok": True})

    # ── Project Tags ────────────────────────────────────────────────────────

    def _handle_project_tags_get(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query(
            """SELECT t.id, t.title, t.color FROM tag_definitions t
               JOIN opportunity_tags ot ON t.id = ot.tag_id
               WHERE ot.opportunity_id = %s""",
            (opp_id,),
        )
        _json_response(self, 200, [{"id": r[0], "title": r[1], "color": r[2]} for r in rows])

    def _handle_project_tag_add(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        tag_id = payload.get("tagId")
        tag_title = str(payload.get("title") or "").strip()
        if not tag_id and tag_title:
            row = db.query("SELECT id FROM tag_definitions WHERE title = %s", (tag_title,), fetch="one")
            if row:
                tag_id = row[0]
            else:
                tag_id = db.insert_returning(
                    "INSERT INTO tag_definitions (title) VALUES (%s) RETURNING id", (tag_title,)
                )
        if not tag_id:
            _json_response(self, 400, {"error": "tagId or title is required"})
            return
        db.execute(
            "INSERT INTO opportunity_tags (opportunity_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (opp_id, tag_id),
        )
        _json_response(self, 200, {"ok": True})

    def _handle_project_tag_remove(self, opp_id: int, tag_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        db.execute(
            "DELETE FROM opportunity_tags WHERE opportunity_id = %s AND tag_id = %s",
            (opp_id, tag_id),
        )
        _json_response(self, 200, {"ok": True})

    # ── Custom Fields ───────────────────────────────────────────────────────

    def _handle_custom_fields_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query(
            """SELECT id, field_key, label, field_type, is_required, default_value,
                      sort_order, show_on_create, show_on_edit
               FROM custom_field_definitions WHERE is_active = TRUE ORDER BY sort_order"""
        )
        fields = []
        for r in rows:
            opts = db.query(
                "SELECT option_value, option_label FROM custom_field_options WHERE field_id = %s ORDER BY sort_order",
                (r[0],),
            )
            fields.append({
                "id": r[0], "key": r[1], "label": r[2], "type": r[3],
                "isRequired": r[4], "defaultValue": r[5], "sortOrder": r[6],
                "showOnCreate": r[7], "showOnEdit": r[8],
                "options": [{"value": o[0], "label": o[1]} for o in opts],
            })
        _json_response(self, 200, fields)

    def _handle_project_custom_fields_get(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query(
            """SELECT cfv.field_id, cfv.field_value, cfd.field_key, cfd.label, cfd.field_type
               FROM opportunity_custom_field_values cfv
               JOIN custom_field_definitions cfd ON cfv.field_id = cfd.id
               WHERE cfv.opportunity_id = %s""",
            (opp_id,),
        )
        _json_response(self, 200, [
            {"fieldId": r[0], "value": r[1], "key": r[2], "label": r[3], "type": r[4]}
            for r in rows
        ])

    def _handle_project_custom_fields_update(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        fields = payload.get("fields", payload.get("customFieldList", []))
        for f in fields:
            field_id = f.get("fieldId") or f.get("id")
            value = f.get("value") or f.get("fieldValue") or ""
            if field_id is not None:
                db.execute(
                    """INSERT INTO opportunity_custom_field_values (opportunity_id, field_id, field_value)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (opportunity_id, field_id) DO UPDATE SET field_value = EXCLUDED.field_value""",
                    (opp_id, field_id, str(value)),
                )
        _json_response(self, 200, {"ok": True})

    # ── History ─────────────────────────────────────────────────────────────

    def _handle_project_history_get(self, opp_id: int, qs: dict) -> None:
        user = _require_auth(self)
        if not user:
            return
        count = int(qs.get("count", ["10"])[0])
        start = int(qs.get("startIndex", ["0"])[0])
        rows = db.query(
            """SELECT h.id, h.category_id, hc.title, h.title, h.content,
                      h.created_by, h.created_at, h.backdated_created_at,
                      u.display_name
               FROM history_events h
               LEFT JOIN history_categories hc ON h.category_id = hc.id
               LEFT JOIN users u ON h.created_by = u.id
               WHERE h.opportunity_id = %s
               ORDER BY h.created_at DESC
               LIMIT %s OFFSET %s""",
            (opp_id, count, start),
        )
        event_ids = [r[0] for r in rows]
        attachments_by_event: dict[int, list] = {}
        if event_ids:
            att_rows = db.query(
                """SELECT id, event_id, filename, file_path, file_size, mime_type, uploaded_by
                   FROM history_attachments WHERE event_id = ANY(%s)""",
                (event_ids,),
            )
            for ar in att_rows:
                attachments_by_event.setdefault(ar[1], []).append({
                    "id": ar[0], "filename": ar[2], "filePath": ar[3],
                    "fileSize": ar[4], "mimeType": ar[5], "uploadedBy": ar[6],
                })
        events = []
        for r in rows:
            events.append({
                "id": r[0], "categoryId": r[1], "category": {"title": r[2]},
                "title": r[3], "content": r[4], "createdBy": r[5],
                "created": r[6].isoformat() if r[6] else None,
                "backdatedCreated": r[7].isoformat() if r[7] else None,
                "author": r[8] or "",
                "attachments": attachments_by_event.get(r[0], []),
            })
        _json_response(self, 200, events)

    def _handle_project_history_create(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        content = str(payload.get("content") or "").strip()
        category_id = payload.get("categoryId") or 1
        backdated = str(payload.get("created") or "").strip() or None
        event_id = db.insert_returning(
            """INSERT INTO history_events (opportunity_id, category_id, content, created_by, backdated_created_at)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (opp_id, category_id, content, user["id"], backdated),
        )
        # Insert notify users
        notify_list = payload.get("notifyUserList") or []
        for uid in notify_list:
            try:
                db.execute(
                    "INSERT INTO history_notify_users (event_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (event_id, int(uid)),
                )
            except (TypeError, ValueError):
                pass
        # Link uploaded document IDs as history attachments
        file_ids = payload.get("fileIds") or []
        for fid in file_ids:
            try:
                fid_int = int(fid)
            except (TypeError, ValueError):
                continue
            doc = db.query(
                "SELECT id, title, file_path, file_size, mime_type, uploaded_by FROM project_documents WHERE id = %s AND is_deleted = FALSE",
                (fid_int,), fetch="one",
            )
            if doc:
                db.execute(
                    """INSERT INTO history_attachments (event_id, filename, file_path, file_size, mime_type, uploaded_by)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (event_id, doc[1], doc[2], doc[3], doc[4], doc[5]),
                )
        _json_response(self, 201, {"id": event_id, "ok": True})

    def _handle_history_event_delete(self, event_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        db.execute("DELETE FROM history_events WHERE id = %s", (event_id,))
        _json_response(self, 200, {"ok": True})

    # ── Threaded Replies ────────────────────────────────────────────────────

    def _handle_history_replies_get(self, opp_id: int, event_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query(
            """SELECT r.id, r.parent_reply_id, r.content, r.created_by, r.created_at,
                      r.is_deleted, u.display_name
               FROM history_replies r
               LEFT JOIN users u ON r.created_by = u.id
               WHERE r.event_id = %s
               ORDER BY r.created_at ASC""",
            (event_id,),
        )
        replies = []
        for r in rows:
            replies.append({
                "id": r[0], "parentReplyId": r[1], "content": "" if r[5] else r[2],
                "createdBy": r[3], "created": r[4].isoformat() if r[4] else None,
                "isDeleted": r[5], "author": r[6] or "",
            })
        _json_response(self, 200, replies)

    def _handle_history_reply_create(self, opp_id: int, event_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        content = str(payload.get("content") or "").strip()
        if not content:
            _json_response(self, 400, {"error": "Content is required"})
            return
        parent_reply_id = payload.get("parentReplyId")
        reply_id = db.insert_returning(
            """INSERT INTO history_replies (event_id, parent_reply_id, content, created_by)
               VALUES (%s, %s, %s, %s) RETURNING id""",
            (event_id, parent_reply_id, content, user["id"]),
        )
        _json_response(self, 201, {"id": reply_id, "ok": True})

    def _handle_history_reply_delete(self, reply_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        db.execute(
            "UPDATE history_replies SET is_deleted = TRUE, deleted_by = %s, deleted_at = NOW() WHERE id = %s",
            (user["id"], reply_id),
        )
        _json_response(self, 200, {"ok": True})

    # ── Stages ──────────────────────────────────────────────────────────────

    def _handle_stages_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query(
            "SELECT id, title, color, sort_order, stage_type, probability, is_active FROM stages ORDER BY sort_order"
        )
        _json_response(self, 200, [
            {"id": r[0], "title": r[1], "color": r[2], "sortOrder": r[3],
             "stageType": r[4], "probability": r[5], "isActive": r[6]}
            for r in rows
        ])

    def _handle_stage_create(self) -> None:
        user = _require_admin(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        title = str(payload.get("title") or "").strip()
        if not title:
            _json_response(self, 400, {"error": "Title is required"})
            return
        sid = db.insert_returning(
            """INSERT INTO stages (title, color, sort_order, stage_type, probability)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (title, payload.get("color"), payload.get("sortOrder", 0), payload.get("stageType", 0), payload.get("probability", 0)),
        )
        _json_response(self, 201, {"id": sid, "ok": True})

    def _handle_stage_update(self, stage_id: int) -> None:
        user = _require_admin(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        sets, params = [], []
        for field, col in [("title", "title"), ("color", "color"), ("sortOrder", "sort_order"),
                           ("stageType", "stage_type"), ("probability", "probability"), ("isActive", "is_active")]:
            if field in payload:
                sets.append(f"{col} = %s")
                params.append(payload[field])
        if sets:
            params.append(stage_id)
            db.execute(f"UPDATE stages SET {', '.join(sets)} WHERE id = %s", (*params,))
        _json_response(self, 200, {"ok": True})

    # ── Tags ────────────────────────────────────────────────────────────────

    def _handle_tags_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query("SELECT id, title, color FROM tag_definitions ORDER BY title")
        _json_response(self, 200, [{"id": r[0], "title": r[1], "color": r[2]} for r in rows])

    def _handle_tag_create(self) -> None:
        user = _require_admin(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        title = str(payload.get("title") or "").strip()
        if not title:
            _json_response(self, 400, {"error": "Title is required"})
            return
        tid = db.insert_returning(
            "INSERT INTO tag_definitions (title, color) VALUES (%s, %s) RETURNING id",
            (title, payload.get("color")),
        )
        _json_response(self, 201, {"id": tid, "ok": True})

    def _handle_tag_update(self, tag_id: int) -> None:
        user = _require_admin(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        if "title" in payload:
            db.execute("UPDATE tag_definitions SET title = %s WHERE id = %s", (payload["title"], tag_id))
        if "color" in payload:
            db.execute("UPDATE tag_definitions SET color = %s WHERE id = %s", (payload["color"], tag_id))
        _json_response(self, 200, {"ok": True})

    # ── Contacts ────────────────────────────────────────────────────────────

    def _handle_contacts_get(self, qs: dict) -> None:
        user = _require_auth(self)
        if not user:
            return
        where, params = ["1=1"], []
        if "q" in qs:
            where.append("(first_name ILIKE %s OR last_name ILIKE %s OR company ILIKE %s OR email ILIKE %s)")
            q = f"%{qs['q'][0]}%"
            params.extend([q, q, q, q])
        rows = db.query(
            f"SELECT id, first_name, last_name, email, phone, company FROM contacts WHERE {' AND '.join(where)} ORDER BY last_name, first_name LIMIT 200",
            (*params,),
        )
        _json_response(self, 200, [
            {"id": r[0], "firstName": r[1], "lastName": r[2], "email": r[3], "phone": r[4], "company": r[5],
             "displayName": f"{r[1] or ''} {r[2] or ''}".strip()}
            for r in rows
        ])

    def _handle_contact_create(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        cid = db.insert_returning(
            """INSERT INTO contacts (first_name, last_name, email, phone, company, job_title, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (payload.get("firstName"), payload.get("lastName"), payload.get("email"),
             payload.get("phone"), payload.get("company"), payload.get("jobTitle"), user["id"]),
        )
        _json_response(self, 201, {"id": cid, "ok": True})

    def _handle_contact_update(self, contact_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        sets, params = [], []
        for field, col in [("firstName", "first_name"), ("lastName", "last_name"), ("email", "email"),
                           ("phone", "phone"), ("company", "company"), ("jobTitle", "job_title")]:
            if field in payload:
                sets.append(f"{col} = %s")
                params.append(payload[field])
        if sets:
            params.append(contact_id)
            db.execute(f"UPDATE contacts SET {', '.join(sets)} WHERE id = %s", (*params,))
        _json_response(self, 200, {"ok": True})

    # ── Tasks ───────────────────────────────────────────────────────────────

    def _handle_tasks_get(self, qs: dict) -> None:
        user = _require_auth(self)
        if not user:
            return
        closed = qs.get("closed", ["false"])[0].lower() == "true"
        where = ["t.is_closed = %s"]
        params: list = [closed]
        if "responsible_user_id" in qs:
            where.append("t.responsible_user_id = %s")
            params.append(int(qs["responsible_user_id"][0]))
        rows = db.query(
            f"""SELECT t.id, t.title, t.description, t.opportunity_id, t.responsible_user_id,
                       t.due_date, t.priority, t.is_closed, t.closed_at, t.created_at,
                       u.display_name, o.title
                FROM tasks t
                LEFT JOIN users u ON t.responsible_user_id = u.id
                LEFT JOIN opportunities o ON t.opportunity_id = o.id
                WHERE {' AND '.join(where)}
                ORDER BY t.due_date ASC NULLS LAST""",
            (*params,),
        )
        _json_response(self, 200, [
            {"id": r[0], "title": r[1], "description": r[2], "opportunityId": r[3],
             "responsibleUserId": r[4], "dueDate": r[5].isoformat() if r[5] else None,
             "priority": r[6], "isClosed": r[7], "closedAt": r[8].isoformat() if r[8] else None,
             "created": r[9].isoformat() if r[9] else None,
             "responsible": {"displayName": r[10]} if r[10] else None,
             "opportunity": {"title": r[11]} if r[11] else None}
            for r in rows
        ])

    def _handle_task_create(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        title = str(payload.get("title") or "").strip()
        if not title:
            _json_response(self, 400, {"error": "Title is required"})
            return
        tid = db.insert_returning(
            """INSERT INTO tasks (title, description, opportunity_id, responsible_user_id, due_date, priority, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (title, payload.get("description"), payload.get("opportunityId"),
             payload.get("responsibleUserId", user["id"]),
             payload.get("dueDate"), payload.get("priority", 0), user["id"]),
        )
        _json_response(self, 201, {"id": tid, "ok": True})

    def _handle_task_update(self, task_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        if "isClosed" in payload:
            if payload["isClosed"]:
                db.execute(
                    "UPDATE tasks SET is_closed = TRUE, closed_at = NOW(), closed_by = %s WHERE id = %s",
                    (user["id"], task_id),
                )
            else:
                db.execute("UPDATE tasks SET is_closed = FALSE, closed_at = NULL WHERE id = %s", (task_id,))
        for field, col in [("title", "title"), ("description", "description"), ("dueDate", "due_date"), ("priority", "priority")]:
            if field in payload:
                db.execute(f"UPDATE tasks SET {col} = %s WHERE id = %s", (payload[field], task_id))
        _json_response(self, 200, {"ok": True})

    # ── Users ───────────────────────────────────────────────────────────────

    def _handle_users_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query(
            "SELECT id, email, display_name, first_name, last_name, is_admin, is_active FROM users ORDER BY display_name"
        )
        _json_response(self, 200, [
            {"id": r[0], "email": r[1], "displayName": r[2], "firstName": r[3],
             "lastName": r[4], "isAdmin": r[5], "isActive": r[6]}
            for r in rows
        ])

    def _handle_me_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        _json_response(self, 200, user)

    def _handle_user_create(self) -> None:
        admin = _require_admin(self)
        if not admin:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        email = str(payload.get("email") or "").strip().lower()
        if not email:
            _json_response(self, 400, {"error": "Email is required"})
            return
        temp_password = str(payload.get("password") or "changeme")
        pw_hash, salt = auth_mod.hash_password(temp_password)
        uid = db.insert_returning(
            """INSERT INTO users (email, password_hash, password_salt, display_name, first_name, last_name, is_admin, must_change_password)
               VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE) RETURNING id""",
            (email, pw_hash, salt, payload.get("displayName"), payload.get("firstName"),
             payload.get("lastName"), payload.get("isAdmin", False)),
        )
        _json_response(self, 201, {"id": uid, "ok": True})

    def _handle_user_update(self, user_id: int) -> None:
        admin = _require_admin(self)
        if not admin:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        sets, params = [], []
        for field, col in [("displayName", "display_name"), ("firstName", "first_name"),
                           ("lastName", "last_name"), ("isAdmin", "is_admin"), ("isActive", "is_active")]:
            if field in payload:
                sets.append(f"{col} = %s")
                params.append(payload[field])
        if "password" in payload and payload["password"]:
            pw_hash, salt = auth_mod.hash_password(payload["password"])
            sets.extend(["password_hash = %s", "password_salt = %s", "must_change_password = FALSE"])
            params.extend([pw_hash, salt])
        if sets:
            params.append(user_id)
            db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = %s", (*params,))
        _json_response(self, 200, {"ok": True})

    # ── Notifications ───────────────────────────────────────────────────────

    def _handle_notifications_get(self, qs: dict) -> None:
        user = _require_auth(self)
        if not user:
            return
        unread_only = qs.get("unread", ["false"])[0].lower() == "true"
        where = ["n.user_id = %s"]
        params: list = [user["id"]]
        if unread_only:
            where.append("n.is_read = FALSE")
        rows = db.query(
            f"""SELECT n.id, n.type, n.opportunity_id, n.message, n.payload, n.is_read, n.created_at,
                       u.display_name, o.title
                FROM notifications n
                LEFT JOIN users u ON n.actor_user_id = u.id
                LEFT JOIN opportunities o ON n.opportunity_id = o.id
                WHERE {' AND '.join(where)}
                ORDER BY n.created_at DESC LIMIT 100""",
            (*params,),
        )
        _json_response(self, 200, [
            {"id": r[0], "type": r[1], "opportunityId": r[2], "message": r[3],
             "payload": r[4], "isRead": r[5], "created": r[6].isoformat() if r[6] else None,
             "actor": r[7], "projectTitle": r[8]}
            for r in rows
        ])

    def _handle_notification_mark_read(self, notif_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        db.execute(
            "UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
            (notif_id, user["id"]),
        )
        _json_response(self, 200, {"ok": True})

    def _handle_notifications_mark_all_read(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        db.execute("UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE", (user["id"],))
        _json_response(self, 200, {"ok": True})

    # ── History Categories ──────────────────────────────────────────────────

    def _handle_history_categories_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query("SELECT id, title, display_color FROM history_categories ORDER BY sort_order")
        _json_response(self, 200, [{"id": r[0], "title": r[1], "color": r[2]} for r in rows])

    # ── Photos ──────────────────────────────────────────────────────────────

    def _handle_project_photos_get(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query(
            """SELECT id, filename, file_path, file_size, mime_type, exif_data,
                      thumbnail_path, alt_description, uploaded_by, uploaded_at
               FROM project_photos WHERE opportunity_id = %s AND is_deleted = FALSE
               ORDER BY uploaded_at DESC""",
            (opp_id,),
        )
        photos = []
        for r in rows:
            photos.append({
                "id": r[0], "filename": r[1], "filePath": r[2],
                "fileSize": r[3], "mimeType": r[4], "exifData": r[5],
                "thumbnailPath": r[6], "altDescription": r[7],
                "uploadedBy": r[8], "uploadedAt": r[9].isoformat() if r[9] else None,
            })
        # Total size for quota display
        total = db.query(
            "SELECT COALESCE(SUM(file_size), 0) FROM project_photos WHERE opportunity_id = %s AND is_deleted = FALSE",
            (opp_id,), fetch="one",
        )
        _json_response(self, 200, {"photos": photos, "totalSize": total[0] if total else 0, "quota": 157286400})

    def _handle_project_photo_upload(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        # TODO: multipart file upload handling (Phase 2E)
        _json_response(self, 501, {"error": "Photo upload not yet implemented"})

    def _handle_project_photo_folders_get(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query(
            """SELECT id, folder_type, label, external_url, external_provider, created_at
               FROM project_photo_folders WHERE opportunity_id = %s""",
            (opp_id,),
        )
        _json_response(self, 200, [
            {"id": r[0], "folderType": r[1], "label": r[2], "externalUrl": r[3],
             "externalProvider": r[4], "createdAt": r[5].isoformat() if r[5] else None}
            for r in rows
        ])

    def _handle_project_photo_folder_add(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        url = str(payload.get("externalUrl") or "").strip()
        if not url:
            _json_response(self, 400, {"error": "externalUrl is required"})
            return
        fid = db.insert_returning(
            """INSERT INTO project_photo_folders (opportunity_id, folder_type, label, external_url, external_provider, created_by)
               VALUES (%s, 'external', %s, %s, %s, %s) RETURNING id""",
            (opp_id, payload.get("label"), url, payload.get("externalProvider"), user["id"]),
        )
        _json_response(self, 201, {"id": fid, "ok": True})

    def _handle_photo_delete(self, photo_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        db.execute(
            "UPDATE project_photos SET is_deleted = TRUE, deleted_at = NOW() WHERE id = %s",
            (photo_id,),
        )
        _json_response(self, 200, {"ok": True})

    def _handle_photo_folder_delete(self, folder_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        db.execute("DELETE FROM project_photo_folders WHERE id = %s", (folder_id,))
        _json_response(self, 200, {"ok": True})

    # ── Documents ─────────────────────────────────────────────────────────────

    def _handle_project_documents_get(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        rows = db.query(
            """SELECT id, title, file_path, file_size, mime_type, uploaded_by, uploaded_at
               FROM project_documents WHERE opportunity_id = %s AND is_deleted = FALSE
               ORDER BY uploaded_at DESC""",
            (opp_id,),
        )
        docs = []
        for r in rows:
            docs.append({
                "id": r[0], "title": r[1], "filePath": r[2],
                "fileSize": r[3], "mimeType": r[4], "uploadedBy": r[5],
                "uploadedAt": r[6].isoformat() if r[6] else None,
                "editUrl": f"/api/v2/documents/{r[0]}/editor-config",
            })
        _json_response(self, 200, {"documents": docs})

    def _handle_project_document_upload(self, opp_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("multipart/form-data"):
            _json_response(self, 400, {"error": "Expected multipart/form-data"})
            return
        try:
            parsed = _parse_multipart(_read_body(self), content_type)
        except Exception as exc:
            _json_response(self, 400, {"error": f"Invalid multipart body: {exc}"})
            return
        file_info = parsed.get("file")
        if not file_info:
            _json_response(self, 400, {"error": "file field required"})
            return
        filename = file_info["filename"]
        data = file_info["data"]
        mime_type = file_info.get("content-type") or _guess_mime(filename)
        safe_name = re.sub(r'[^\w.\-]', '_', filename)
        if not safe_name:
            safe_name = "document"
        opp_dir = DOCUMENT_STORAGE_PATH / str(opp_id)
        opp_dir.mkdir(parents=True, exist_ok=True)
        # avoid collisions
        unique_name = f"{int(time.time())}_{safe_name}"
        file_path = opp_dir / unique_name
        file_path.write_bytes(data)
        file_size = len(data)
        doc_id = db.insert_returning(
            """INSERT INTO project_documents (opportunity_id, title, file_path, file_size, mime_type, uploaded_by)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (opp_id, filename, str(file_path.relative_to(ROOT)), file_size, mime_type, user["id"]),
        )
        _json_response(self, 201, {
            "id": doc_id, "title": filename, "fileSize": file_size,
            "mimeType": mime_type, "editUrl": f"/api/v2/documents/{doc_id}/editor-config",
        })

    def _handle_document_download(self, doc_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        row = db.query(
            "SELECT opportunity_id, title, file_path, file_size, mime_type FROM project_documents WHERE id = %s AND is_deleted = FALSE",
            (doc_id,), fetch="one",
        )
        if not row:
            self.send_error(404)
            return
        opp_id, title, file_path, file_size, mime_type = row
        full_path = ROOT / file_path
        if not full_path.exists():
            self.send_error(404)
            return
        data = full_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition", f'inline; filename="{title}"')
        self.end_headers()
        self.wfile.write(data)

    def _handle_document_editor_config(self, doc_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        row = db.query(
            "SELECT opportunity_id, title, file_path, file_size, mime_type FROM project_documents WHERE id = %s AND is_deleted = FALSE",
            (doc_id,), fetch="one",
        )
        if not row:
            self.send_error(404)
            return
        opp_id, title, file_path, file_size, mime_type = row
        if not DOCS_PUBLIC_URL:
            _json_response(self, 503, {"error": "Document Server public URL not configured"})
            return
        if not DOCS_JWT_SECRET:
            _json_response(self, 503, {"error": "Document Server JWT secret not configured"})
            return
        file_ext = Path(title).suffix.lstrip(".").lower() or "docx"
        doc_type = _document_type_from_ext(file_ext)
        # Public URL that Document Server will use to download the file
        download_url = f"{DOCS_PUBLIC_URL}/api/v2/documents/{doc_id}/download"
        key = _sign_jwt({"id": doc_id, "path": file_path, "ts": int(time.time())}, DOCS_JWT_SECRET)
        config = {
            "document": {
                "fileType": file_ext,
                "key": key,
                "title": title,
                "url": download_url,
            },
            "documentType": doc_type,
            "editorConfig": {
                "callbackUrl": f"{DOCS_PUBLIC_URL}/api/v2/documents/{doc_id}/callback",
                "mode": "edit",
                "user": {"id": str(user["id"]), "name": user.get("display_name") or user.get("email") or "User"},
            },
        }
        token = _sign_jwt({"payload": config}, DOCS_JWT_SECRET)
        config["token"] = token
        _json_response(self, 200, config)

    def _handle_document_delete(self, doc_id: int) -> None:
        user = _require_auth(self)
        if not user:
            return
        db.execute(
            "UPDATE project_documents SET is_deleted = TRUE, deleted_at = NOW() WHERE id = %s",
            (doc_id,),
        )
        _json_response(self, 200, {"ok": True})

    def _handle_document_callback(self, doc_id: int) -> None:
        """OnlyOffice Document Server save callback. Saves updated file if provided."""
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 200, {"error": 0})
            return
        status = payload.get("status")
        if status in (2, 6):
            url = payload.get("url")
            if url:
                try:
                    with urllib.request.urlopen(url, timeout=60) as resp:
                        data = resp.read()
                    row = db.query(
                        "SELECT file_path FROM project_documents WHERE id = %s AND is_deleted = FALSE",
                        (doc_id,), fetch="one",
                    )
                    if row:
                        file_path = ROOT / row[0]
                        file_path.write_bytes(data)
                        db.execute(
                            "UPDATE project_documents SET file_size = %s WHERE id = %s",
                            (len(data), doc_id),
                        )
                except Exception:
                    pass
        _json_response(self, 200, {"error": 0})

    # ── Batch Tags ──────────────────────────────────────────────────────────

    def _handle_batch_opportunity_tags(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        qs = parse_qs(urlparse(self.path).query)
        ids_raw = (qs.get("ids") or [""])[0]
        if not ids_raw:
            _json_response(self, 400, {"error": "ids parameter required"})
            return
        try:
            ids = [int(x.strip()) for x in ids_raw.split(",") if x.strip()]
        except ValueError:
            _json_response(self, 400, {"error": "Invalid ids"})
            return
        result = {}
        for opp_id in ids:
            rows = db.query(
                """SELECT t.id, t.title, t.color FROM tag_definitions t
                   JOIN opportunity_tags ot ON t.id = ot.tag_id WHERE ot.opportunity_id = %s""",
                (opp_id,),
            )
            result[str(opp_id)] = [{"id": r[0], "title": r[1], "color": r[2]} for r in rows]
        _json_response(self, 200, result)

    # ── Admin check ─────────────────────────────────────────────────────────

    def _handle_check_admin(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        _json_response(self, 200, {"isAdmin": user.get("is_admin", False)})

    # ── Calendar feed (unchanged) ───────────────────────────────────────────

    def _handle_calendar_feed(self) -> None:
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        feed_url = (qs.get("url") or [""])[0].strip()
        if not feed_url:
            _json_response(self, 400, {"error": "url query parameter is required"})
            return
        if not is_allowed_calendar_url(feed_url):
            _json_response(self, 400, {"error": "Invalid or disallowed calendar URL"})
            return
        import urllib.request, urllib.error
        req = urllib.request.Request(
            feed_url,
            headers={"Accept": "text/calendar", "User-Agent": "Vanguard-CRM-Calendar/3.0"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                raw = resp.read(_MAX_ICS_BYTES + 1)
        except urllib.error.HTTPError as exc:
            _json_response(self, exc.code, {"error": "Could not fetch calendar feed"})
            return
        except urllib.error.URLError as exc:
            _json_response(self, 502, {"error": str(exc.reason)})
            return
        if len(raw) > _MAX_ICS_BYTES:
            _json_response(self, 413, {"error": "Calendar feed too large"})
            return
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("utf-8", errors="replace")
        try:
            payload = parse_ics_calendar(text)
        except Exception as exc:
            _json_response(self, 422, {"error": f"Could not parse calendar: {exc}"})
            return
        _json_response(self, 200, payload)

    # ── User Profile (local store, unchanged) ───────────────────────────────

    def _handle_user_profile_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        profile = load_user_profile("vanguard", str(user["id"]))
        _json_response(self, 200, profile)

    def _handle_user_profile_put(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        if not isinstance(payload, dict):
            _json_response(self, 400, {"error": "Profile object is required"})
            return
        profile = save_user_profile("vanguard", str(user["id"]), payload)
        _json_response(self, 200, {"ok": True, **profile})

    def _handle_dashboard_notes_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        profile = load_user_profile("vanguard", str(user["id"]))
        _json_response(self, 200, {"tiles": profile.get("notesTiles", [])})

    def _handle_dashboard_notes_put(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        tiles = payload.get("tiles")
        if not isinstance(tiles, list):
            _json_response(self, 400, {"error": "tiles array is required"})
            return
        existing = load_user_profile("vanguard", str(user["id"]))
        existing["notesTiles"] = tiles
        save_user_profile("vanguard", str(user["id"]), existing)
        _json_response(self, 200, {"ok": True, "tiles": tiles})

    # ── Event Log (local store, unchanged) ──────────────────────────────────

    def _handle_event_log_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        events = load_event_log("vanguard", str(user["id"]))
        _json_response(self, 200, {"events": events})

    def _handle_event_log_put(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        entries = payload.get("events")
        if not isinstance(entries, list):
            _json_response(self, 400, {"error": "events array is required"})
            return
        events = append_event_log("vanguard", str(user["id"]), entries)
        _json_response(self, 200, {"ok": True, "events": events})

    def _handle_event_log_users(self) -> None:
        user = _require_admin(self)
        if not user:
            return
        users = list_users_with_logs("vanguard")
        _json_response(self, 200, {"users": users})

    def _handle_event_log_admin_get(self) -> None:
        user = _require_admin(self)
        if not user:
            return
        qs = parse_qs(urlparse(self.path).query)
        target_user = (qs.get("userId") or [""])[0]
        if not target_user:
            _json_response(self, 400, {"error": "userId is required"})
            return
        events = load_event_log("vanguard", target_user)
        _json_response(self, 200, {"events": events})

    # ── Bot Endpoints (DB-backed, no CRM proxy needed) ──────────────────────

    def _handle_bot_customers_list(self) -> None:
        user = _require_admin(self)
        if not user:
            return
        mappings = list_mappings("vanguard")
        pending = get_pending_codes("vanguard")
        _json_response(self, 200, {"mappings": mappings, "pendingCodes": pending})

    def _handle_bot_customers_post_put(self, method: str) -> None:
        api_path = urlparse(self.path).path
        if api_path == "/api/bot-customers/generate-code" and method == "POST":
            user = _require_admin(self)
            if not user:
                return
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON body"})
                return
            contact_id = payload.get("contactId")
            contact_name = str(payload.get("contactName") or "").strip()
            notes_category_id = payload.get("notesCategoryId")
            nickname = str(payload.get("nickname") or "").strip()
            employee = payload.get("employee", False)
            if not employee and not contact_id:
                _json_response(self, 400, {"error": "contactId is required"})
                return
            result = generate_code("vanguard", int(contact_id) if contact_id else None,
                                   contact_name, int(notes_category_id) if notes_category_id else None,
                                   nickname, employee=bool(employee))
            _json_response(self, 200, result)
            return
        if api_path == "/api/bot-customers/cancel-code" and method == "POST":
            user = _require_admin(self)
            if not user:
                return
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON body"})
                return
            contact_id = payload.get("contactId")
            code = str(payload.get("code") or "").strip()
            if contact_id:
                ok = cancel_code("vanguard", int(contact_id))
            elif code:
                ok = cancel_code_by_value("vanguard", code)
            else:
                _json_response(self, 400, {"error": "contactId or code is required"})
                return
            _json_response(self, 200, {"ok": ok})
            return
        if api_path == "/api/bot-customers/verify-code" and method == "POST":
            bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
            if not bot_token:
                _json_response(self, 503, {"error": "TELEGRAM_BOT_TOKEN not configured"})
                return
            auth_header = self.headers.get("Authorization", "").strip()
            if auth_header != f"Bearer {bot_token}":
                _json_response(self, 403, {"error": "Forbidden"})
                return
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON body"})
                return
            code = str(payload.get("code") or "").strip()
            chat_id = payload.get("chatId")
            portal = str(payload.get("portal") or "vanguard").strip()
            if not code or not chat_id:
                _json_response(self, 400, {"error": "code and chatId are required"})
                return
            mapping = verify_code(portal, code)
            if mapping is None:
                _json_response(self, 404, {"error": "Invalid or expired code"})
                return
            if isinstance(mapping, str):
                _json_response(self, 400, {"error": mapping})
                return
            set_verify_chat_id(portal, mapping["contactId"], int(chat_id))
            _json_response(self, 200, mapping)
            return
        if api_path == "/api/bot-customers/mapping" and method == "DELETE":
            user = _require_admin(self)
            if not user:
                return
            qs = parse_qs(urlparse(self.path).query)
            chat_id_raw = (qs.get("chatId") or [""])[0]
            if chat_id_raw:
                try:
                    ok = remove_mapping_by_chat("vanguard", int(chat_id_raw))
                except (TypeError, ValueError):
                    _json_response(self, 400, {"error": "Invalid chatId"})
                    return
                _json_response(self, 200, {"ok": ok})
                return
            _json_response(self, 400, {"error": "chatId is required"})
            return
        if api_path == "/api/bot-customers/nickname" and method == "PUT":
            user = _require_admin(self)
            if not user:
                return
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON body"})
                return
            contact_id = payload.get("contactId")
            nickname = str(payload.get("nickname") or "").strip()
            ok = set_nickname("vanguard", int(contact_id) if contact_id else None, nickname)
            _json_response(self, 200, {"ok": ok})
            return
        self.send_error(404)

    def _handle_bot_api_get(self) -> None:
        api_path = urlparse(self.path).path
        qs = parse_qs(urlparse(self.path).query)
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        auth_header = self.headers.get("Authorization", "").strip()
        if not bot_token or auth_header != f"Bearer {bot_token}":
            _json_response(self, 403, {"error": "Forbidden"})
            return

        if api_path == "/api/bot/me":
            raw_chat = (qs.get("chatId") or [""])[0]
            if not raw_chat:
                _json_response(self, 400, {"error": "chatId is required"})
                return
            track_request("vanguard", int(raw_chat), "me")
            mapping = get_mapping_by_chat("vanguard", int(raw_chat))
            if not mapping:
                _json_response(self, 404, {"error": "Not found"})
                return
            _json_response(self, 200, mapping)
            return

        if api_path == "/api/bot/deals":
            raw_chat_deals = (qs.get("chatId") or [""])[0]
            if raw_chat_deals:
                track_request("vanguard", int(raw_chat_deals), "deals")
            is_employee = (qs.get("employee") or [""])[0].lower() == "true"
            raw_contact = (qs.get("contactId") or [""])[0]
            if not is_employee and not raw_contact:
                _json_response(self, 400, {"error": "contactId is required"})
                return
            contact_id = int(raw_contact) if raw_contact else None

            # Query PostgreSQL directly
            where = ["o.stage_type = 0"]
            params: list = []
            if contact_id:
                where.append("o.contact_id = %s")
                params.append(contact_id)
            search = (qs.get("search") or [""])[0].strip().lower()
            if search:
                where.append("o.title ILIKE %s")
                params.append(f"%{search}%")

            rows = db.query(
                f"""SELECT o.id, o.title, o.bid_value, o.description, o.created_at, o.expected_close_date,
                           s.title, c.first_name, c.last_name, u.display_name
                    FROM opportunities o
                    LEFT JOIN stages s ON o.stage_id = s.id
                    LEFT JOIN contacts c ON o.contact_id = c.id
                    LEFT JOIN users u ON o.responsible_user_id = u.id
                    WHERE {' AND '.join(where)} ORDER BY o.created_at DESC LIMIT 100""",
                (*params,),
            )
            deals = []
            for r in rows:
                deals.append({
                    "id": r[0], "title": r[1], "amount": float(r[2]) if r[2] else 0,
                    "stage": r[6] or "", "contact": f"{r[7] or ''} {r[8] or ''}".strip(),
                    "responsible": r[9] or "",
                })
            _json_response(self, 200, deals)
            return

        if api_path == "/api/bot/categories":
            rows = db.query("SELECT id, title FROM history_categories ORDER BY sort_order")
            _json_response(self, 200, [{"id": r[0], "title": r[1]} for r in rows])
            return

        if api_path == "/api/bot/tags":
            rows = db.query("SELECT DISTINCT t.title FROM tag_definitions t JOIN opportunity_tags ot ON t.id = ot.tag_id")
            _json_response(self, 200, [r[0] for r in rows])
            return

        if api_path == "/api/bot/usage":
            user = _require_admin(self)
            if not user:
                return
            stats = get_usage_stats("vanguard")
            _json_response(self, 200, stats)
            return

        self.send_error(404)

    def _handle_bot_api_post(self, method: str) -> None:
        api_path = urlparse(self.path).path
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        auth_header = self.headers.get("Authorization", "").strip()

        if api_path == "/api/bot/note" and method == "POST":
            if not bot_token or auth_header != f"Bearer {bot_token}":
                _json_response(self, 403, {"error": "Forbidden"})
                return
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON body"})
                return
            opp_id = payload.get("opportunityId")
            content = str(payload.get("content") or "").strip()
            category_id = int(payload.get("categoryId") or 1)
            created_by = payload.get("createdBy")
            if not opp_id or not content:
                _json_response(self, 400, {"error": "opportunityId and content are required"})
                return
            event_id = db.insert_returning(
                """INSERT INTO history_events (opportunity_id, category_id, content, created_by)
                   VALUES (%s, %s, %s, %s) RETURNING id""",
                (int(opp_id), category_id, content, int(created_by) if created_by else None),
            )
            _json_response(self, 200, {"ok": True, "eventId": event_id})
            return

        if api_path == "/api/bot/send-message" and method == "POST":
            user = _require_admin(self)
            if not user:
                return
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON body"})
                return
            chat_id = payload.get("chatId")
            text = str(payload.get("text") or "").strip()
            if not chat_id or not text:
                _json_response(self, 400, {"error": "chatId and text are required"})
                return
            reply_to = payload.get("replyToMessageId")
            parse_mode = payload.get("parseMode", "HTML")
            try:
                import httpx as _httpx
                bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
                if not bot_token:
                    _json_response(self, 500, {"error": "TELEGRAM_BOT_TOKEN not configured"})
                    return
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                body: dict = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
                if reply_to:
                    body["reply_to_message_id"] = reply_to
                resp = _httpx.post(url, json=body, timeout=10)
                data = resp.json()
                if data.get("ok"):
                    _json_response(self, 200, {"ok": True, "messageId": data["result"]["message_id"]})
                else:
                    _json_response(self, 502, {"error": data.get("description", "Telegram API error")})
            except Exception as exc:
                logger.exception("Failed to send Telegram message")
                _json_response(self, 500, {"error": str(exc)})
            return

        if api_path == "/api/bot/notification-by-message" and method == "GET":
            if not bot_token or auth_header != f"Bearer {bot_token}":
                _json_response(self, 403, {"error": "Forbidden"})
                return
            chat_id = _qp.get("chatId", [""])[0]
            message_id = _qp.get("messageId", [""])[0]
            if not chat_id or not message_id:
                _json_response(self, 400, {"error": "chatId and messageId are required"})
                return
            try:
                row = db.query_one(
                    """SELECT n.id AS notification_id, n.opportunity_id, o.title AS project_title
                       FROM telegram_notification_log tnl
                       JOIN notifications n ON n.id = tnl.notification_id
                       LEFT JOIN opportunities o ON o.id = n.opportunity_id
                       WHERE tnl.chat_id = %s AND tnl.message_id = %s""",
                    (int(chat_id), int(message_id)),
                )
                if row:
                    _json_response(self, 200, {
                        "notificationId": row["notification_id"],
                        "opportunityId": row["opportunity_id"],
                        "projectTitle": row.get("project_title") or "Unknown Project",
                    })
                else:
                    _json_response(self, 404, {"error": "Notification not found"})
            except Exception:
                logger.exception("Failed to look up notification by message")
                _json_response(self, 500, {"error": "Internal error"})
            return

        self.send_error(404)

    # ── Presence (local store, ported from v2 — unchanged) ──────────────────

    def _handle_presence_users(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        # Return users from DB instead of CRM API
        rows = db.query(
            "SELECT id, email, display_name, first_name, last_name, is_admin FROM users WHERE is_active = TRUE"
        )
        people = [{"id": r[0], "email": r[1], "displayName": r[2] or f"{r[3] or ''} {r[4] or ''}".strip()} for r in rows]
        _json_response(self, 200, people)

    def _handle_presence_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        portal = "vanguard"
        overlays = get_portal_presence_snapshot(portal)
        clean_stale_presence_records(portal)
        now = datetime.now(timezone.utc)

        rows = db.query(
            "SELECT id, email, display_name, first_name, last_name FROM users WHERE is_active = TRUE"
        )
        out_users = []
        for r in rows:
            uid = str(r[0])
            ov = overlays.get(uid) or {}
            hb = _parse_iso_datetime(ov.get("lastHeartbeat") or "")
            online = bool(hb and (now - hb).total_seconds() < 600)
            afd = bool(hb and not online and (now - hb).total_seconds() < 10800)
            auto_status = ov.get("autoStatus") or ""
            if auto_status and not online:
                auto_status = ""

            out_users.append({
                "id": uid,
                "displayName": r[2] or f"{r[3] or ''} {r[4] or ''}".strip(),
                "email": r[1] or "",
                "online": online,
                "afd": afd,
                "status": ov.get("status", ""),
                "inferred": bool(ov.get("inferred")),
                "autoStatus": auto_status,
            })

        my_presence = load_user_presence(portal, str(user["id"]))
        _json_response(self, 200, {
            "users": out_users,
            "me": {"id": user["id"], "email": user["email"], "status": my_presence.get("status", ""), "inferred": bool(my_presence.get("inferred"))},
            "isAdmin": user.get("is_admin", False),
        })

    def _handle_presence_heartbeat(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        offline, visible = False, False
        try:
            body = _read_body(self)
            if body:
                payload = json.loads(body)
                offline = bool(payload.get("offline"))
                visible = bool(payload.get("visible"))
        except (json.JSONDecodeError, ValueError):
            pass
        touch_heartbeat("vanguard", str(user["id"]), offline=offline, visible=visible)
        _json_response(self, 200, {"ok": True})

    def _handle_presence_status(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        has_status = "status" in payload
        status_text = str(payload.get("status") or "")[:200] if has_status else None
        auto_status = payload.get("autoStatus")
        inferred = bool(payload.get("inferred"))
        rec = set_status("vanguard", str(user["id"]), status_text, inferred=inferred, autoStatus=auto_status)
        _json_response(self, 200, {"ok": True, "status": rec.get("status", ""), "inferred": rec.get("inferred", False)})

    def _handle_presence_last_read(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        other = str(payload.get("with") or "").strip()
        at = str(payload.get("at") or "")
        if not other:
            _json_response(self, 400, {"error": "with=<userId> is required"})
            return
        set_last_read_dm("vanguard", str(user["id"]), other, at or None)
        _json_response(self, 200, {"ok": True})

    def _handle_presence_dm_get(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        qs = parse_qs(urlparse(self.path).query)
        with_id = (qs.get("with") or [""])[0]
        if not with_id:
            _json_response(self, 400, {"error": "with=<userId> is required"})
            return
        mark_messages_read("vanguard", str(user["id"]), with_id)
        msgs, has_more = get_conversation("vanguard", str(user["id"]), with_id)
        _json_response(self, 200, {"messages": msgs, "has_more": has_more})

    def _handle_presence_dm_post(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        to_id = str(payload.get("to") or "").strip()
        text = str(payload.get("text") or "").strip()
        if not to_id or not text:
            _json_response(self, 400, {"error": "to and text are required"})
            return
        msg = append_dm("vanguard", str(user["id"]), to_id, text, payload.get("reply_to"), payload.get("reply_text"))
        _json_response(self, 200, {"ok": True, "message": msg})

    def _handle_presence_dm_clear(self) -> None:
        user = _require_auth(self)
        if not user:
            return
        qs = parse_qs(urlparse(self.path).query)
        with_id = (qs.get("with") or [""])[0]
        if not with_id:
            _json_response(self, 400, {"error": "with=<userId> is required"})
            return
        clear_conversation("vanguard", str(user["id"]), with_id)
        _json_response(self, 200, {"ok": True})


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), KanbanHandler)
    print(f"Sietch CRM v3.0 starting on port {PORT}")
    print(f"Version: {APP_VERSION}")
    dispatcher_stop = start_dispatcher()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        stop_dispatcher(dispatcher_stop)
        server.shutdown()


if __name__ == "__main__":
    main()
