#!/usr/bin/env python3
"""DEV ONLY: standalone proxy for UI testing.

Production: install onlyoffice-module/ into Community Server (see INSTALL.txt).
The board is then served by Workspace at /Products/OpportunityBoard/Default.aspx.
"""

from __future__ import annotations

import gzip
import io
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

from ics_calendar import _MAX_ICS_BYTES, is_allowed_calendar_url, parse_ics_calendar

# Load app version from VERSION file (for display in UI, updates automatically on release)
APP_VERSION = "dev"
try:
    version_path = Path(__file__).parent / "VERSION"
    if version_path.exists():
        APP_VERSION = version_path.read_text().strip()
except Exception:
    pass
from user_profile_store import load_user_profile, save_user_profile
from event_log_store import append_event_log, load_event_log, list_users_with_logs
from crm_bot_store import (add_mapping, cancel_code, generate_code,
                           get_mapping_by_chat, get_pending_codes, list_mappings,
                           remove_mapping, remove_mapping_by_chat,
                           set_nickname, set_verify_chat_id, verify_code)
from presence_store import (
    append_dm,
    clear_conversation,
    clean_stale_presence_records,
    clear_auto_status,
    get_conversation,
    get_portal_presence_snapshot,
    get_recent_dms_for_user,
    load_user_presence,
    load_user_last_read_dms,
    mark_messages_read,
    save_user_presence,
    set_last_read_dm,
    set_status,
    touch_crm_activity,
    touch_heartbeat,
)

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
PORT = int(os.environ.get("PORT", "8765"))
PORTAL_URL = os.environ.get("ONLYOFFICE_PORTAL_URL", "").rstrip("/")
DEFAULT_PORTAL = PORTAL_URL or "https://office.publicadjustermidwest.com"
SSL_VERIFY = os.environ.get("ONLYOFFICE_SSL_VERIFY", "true").lower() not in (
    "0",
    "false",
    "no",
)
SESSION_COOKIE = "oo_token"
DATA_DIR = ROOT / "data"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
PRESENCE_AUTO_STATUS_TIMEOUT_S = 300  # 5 min — clear auto-status if no dashboard activity
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
BOT_CRM_EMAIL = os.environ.get("BOT_CRM_EMAIL", "")
BOT_CRM_PASSWORD = os.environ.get("BOT_CRM_PASSWORD", "")


class ResponseCache:
    """Simple in-memory response cache with per-entry TTL."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[float, int, bytes, str]] = {}

    def get(self, key: str) -> tuple[int, bytes, str] | None:
        entry = self._data.get(key)
        if entry is None:
            return None
        expires_at, status, body, ctype = entry
        if time.time() >= expires_at:
            del self._data[key]
            return None
        return (status, body, ctype)

    def set(self, key: str, value: tuple[int, bytes, str], ttl: float) -> None:
        self._data[key] = (time.time() + ttl, value[0], value[1], value[2])

    def clear(self) -> None:
        self._data.clear()

    def invalidate_prefix(self, prefix: str) -> None:
        """Remove all cache entries whose key starts with the given prefix."""
        to_delete = [k for k in self._data if k.startswith(prefix)]
        for k in to_delete:
            del self._data[k]


_proxy_cache = ResponseCache()


def _proxy_cache_ttl(api_path: str) -> int | None:
    """Return cache TTL seconds for a GET proxy path, or None (no cache)."""
    p = api_path.lower()
    if re.search(r"/crm/opportunity/tag(/\d+)?$", p):
        return 600  # 10 min — CRM-wide tag definitions, changes only when admin edits tags
    if "/crm/opportunity/stage" in p:
        return 600  # 10 min — CRM-wide stage definitions, admin-only changes
    if "/crm/opportunity/filter" in p:
        return 30  # 30s — user-scoped filter results (not reusable between users)
    if "/crm/history/filter" in p:
        return 30  # 30s — user-scoped history (not reusable between users)
    if re.search(r"/crm/opportunity/\d+/customfield", p):
        return 600  # 10 min — CRM-wide custom field definitions
    # Single-opp fetch for board card updates (used by targeted refresh)
    if re.search(r"/crm/opportunity/\d+$", p):
        return 30
    return None


def _cache_key(method: str, api_path: str, query: str, portal: str, token: str = "") -> str:
    return f"{method}:{api_path}:{query}:{portal}:{token}"


def _session_token(handler: SimpleHTTPRequestHandler) -> str | None:
    jar = cookies.SimpleCookie(handler.headers.get("Cookie", ""))
    tok = jar.get(SESSION_COOKIE)
    return tok.value if tok else None


def _require_auth(handler: SimpleHTTPRequestHandler) -> tuple[str, str, str] | None:
    """Return (portal, token, user_id) or None after sending error response."""
    portal = _portal_base(handler)
    if not portal:
        _json_response(handler, 400, {"error": "Portal URL not configured"})
        return None
    token = _session_token(handler)
    if not token:
        _json_response(handler, 401, {"error": "Not authenticated"})
        return None
    user_id = _fetch_crm_user_id(portal, token)
    if not user_id:
        _json_response(handler, 502, {"error": "Could not resolve CRM user"})
        return None
    return portal, token, user_id


_crm_user_id_cache: dict[str, str] = {}  # token -> user_id

def _fetch_crm_user_id(portal: str, token: str) -> str | None:
    cached = _crm_user_id_cache.get(token)
    if cached is not None:
        return cached
    url = f"{portal.rstrip('/')}/api/2.0/people/@self.json"
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "Authorization": token},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, context=_ssl_context(), timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, OSError):
        return None
    me = data.get("response") or data.get("result") or data
    if not isinstance(me, dict):
        return None
    uid = me.get("id") or me.get("ID") or me.get("userId") or me.get("UserId")
    if uid is None:
        return None
    user_id_str = str(uid)
    _crm_user_id_cache[token] = user_id_str
    return user_id_str


def _ssl_context() -> ssl.SSLContext | None:
    if SSL_VERIFY:
        return None
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _portal_base(handler: SimpleHTTPRequestHandler) -> str:
    header = handler.headers.get("X-OnlyOffice-Portal", "").strip().rstrip("/")
    return header or PORTAL_URL


def _read_body(handler: SimpleHTTPRequestHandler) -> bytes:
    length = int(handler.headers.get("Content-Length", "0") or 0)
    if length <= 0:
        return b""
    return handler.rfile.read(length)


def _json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _proxy_request(
    handler: SimpleHTTPRequestHandler,
    method: str,
    api_path: str,
    query: str = "",
    body: bytes | None = None,
    content_type: str | None = None,
) -> tuple[int, bytes, str]:
    portal = _portal_base(handler)
    if not portal:
        return 400, b'{"error":"Portal URL not configured. Set ONLYOFFICE_PORTAL_URL or send X-OnlyOffice-Portal header."}', "application/json"

    jar = cookies.SimpleCookie(handler.headers.get("Cookie", ""))
    token = jar.get(SESSION_COOKIE)
    if token is None:
        return 401, b'{"error":"Not authenticated"}', "application/json"

    path = api_path if api_path.startswith("/") else f"/{api_path}"
    url = f"{portal}{path}"
    if query:
        url = f"{url}?{query}"

    # Use the incoming request's Accept header so binary downloads (attachments) work
    incoming_accept = handler.headers.get("Accept", "application/json")
    headers = {
        "Accept": incoming_accept,
        "Authorization": token.value,
    }
    body_empty = body is None or body.strip() in (b"", b"{}", b"null")
    if not body_empty:
        headers["Content-Type"] = content_type or "application/json"
    elif method in ("PUT", "POST", "DELETE"):
        # Empty JSON body on entity custom-field POST breaks fieldValue query binding.
        if method == "POST" and re.search(r"/customfield/\d+", path, re.I):
            body = None
        else:
            body = b"{}"
            headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=_ssl_context(), timeout=120) as resp:
            return resp.status, resp.read(), resp.headers.get_content_type()
    except urllib.error.HTTPError as exc:
        data = exc.read()
        ctype = exc.headers.get_content_type() if exc.headers else "application/json"
        return exc.code, data, ctype


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
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-OnlyOffice-Portal")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/api/"):
            self._handle_api_get()
            return
        if self.path.startswith("/crm-proxy/"):
            self._handle_crm_proxy("GET")
            return
        super().do_GET()

    def send_head(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            return super().send_head()

        fs_path = self.translate_path(self.path)
        # Resolve directory to index.html so it gets gzip compression too
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
        if self.path == "/api/login":
            self._handle_login()
            return
        if self.path == "/api/logout":
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

    def _handle_login(self) -> None:
        portal = _portal_base(self)
        if not portal:
            _json_response(
                self,
                400,
                {
                    "error": "Portal URL required. Set ONLYOFFICE_PORTAL_URL or pass portalUrl in body.",
                },
            )
            return

        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return

        username = payload.get("userName") or payload.get("username")
        password = payload.get("password")
        portal_override = (payload.get("portalUrl") or "").strip().rstrip("/")
        if portal_override:
            portal = portal_override

        if not username or not password:
            _json_response(self, 400, {"error": "userName and password are required"})
            return

        body = json.dumps({"userName": username, "password": password}).encode("utf-8")
        req = urllib.request.Request(
            f"{portal}/api/2.0/authentication.json",
            data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, context=_ssl_context()) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            _json_response(self, exc.code, {"error": "Authentication failed", "detail": detail})
            return
        except urllib.error.URLError as exc:
            _json_response(self, 502, {"error": str(exc.reason)})
            return

        token = data.get("response", {}).get("token")
        if not token:
            _json_response(self, 502, {"error": "No token in authentication response", "raw": data})
            return

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
        body_out = json.dumps(
            {
                "ok": True,
                "portalUrl": portal,
                "expires": data.get("response", {}).get("expires"),
            }
        ).encode("utf-8")
        self.send_header("Content-Length", str(len(body_out)))
        self.end_headers()
        self.wfile.write(body_out)

    def _handle_logout(self) -> None:
        # Best-effort: clear the user's lastHeartbeat so they immediately appear "offline"
        # (not AFD) after explicit or auto sign-out. Tab-away users keep their hb record
        # (stale) and will show as AFD until hb cleared or aged >3h.
        try:
            portal = _portal_base(self)
            token = _session_token(self)
            if portal and token:
                user_id = _fetch_crm_user_id(portal, token)
                if user_id:
                    pres = load_user_presence(portal, user_id)
                    if pres.get("lastHeartbeat"):
                        pres["lastHeartbeat"] = ""
                        save_user_presence(portal, user_id, pres)
        except Exception:
            pass

        # Clear cached user ID on logout
        _crm_user_id_cache.pop(token, None)

        self.send_response(200)
        cookie = cookies.SimpleCookie()
        cookie[SESSION_COOKIE] = ""
        cookie[SESSION_COOKIE]["path"] = "/"
        cookie[SESSION_COOKIE]["max-age"] = "0"
        self.send_header("Set-Cookie", cookie.output(header="").strip())
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def _api_route(self) -> tuple[str, str] | None:
        match = re.match(r"^/api/proxy(/.*)$", urlparse(self.path).path)
        if not match:
            return None
        api_path = match.group(1)
        parsed = urlparse(self.path)
        return api_path, parsed.query

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
        req = urllib.request.Request(
            feed_url,
            headers={"Accept": "text/calendar", "User-Agent": "CRM-Kanban-Calendar/1.0"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=45) as resp:
                raw = resp.read(_MAX_ICS_BYTES + 1)
        except urllib.error.HTTPError as exc:
            detail = exc.read(500).decode("utf-8", errors="replace")
            _json_response(
                self,
                exc.code,
                {"error": "Could not fetch calendar feed", "detail": detail[:300]},
            )
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

    def _handle_user_profile_get(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        profile = load_user_profile(portal, user_id)
        _json_response(self, 200, profile)

    def _handle_user_profile_put(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        if not isinstance(payload, dict):
            _json_response(self, 400, {"error": "Profile object is required"})
            return
        profile = save_user_profile(portal, user_id, payload)
        _json_response(self, 200, {"ok": True, **profile})

    def _handle_dashboard_notes_get(self) -> None:
        """Backward-compatible notes endpoint."""
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        profile = load_user_profile(portal, user_id)
        _json_response(self, 200, {"tiles": profile.get("notesTiles", [])})

    def _handle_dashboard_notes_put(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        tiles = payload.get("tiles")
        if not isinstance(tiles, list):
            _json_response(self, 400, {"error": "tiles array is required"})
            return
        existing = load_user_profile(portal, user_id)
        existing["notesTiles"] = tiles
        profile = save_user_profile(portal, user_id, existing)
        _json_response(self, 200, {"ok": True, "tiles": profile.get("notesTiles", [])})

    # ---------------- Event Log / Health (server-side persistence, admin for kenc) ----------------

    def _current_user_email(self, portal: str, token: str) -> str:
        try:
            url = f"{portal.rstrip('/')}/api/2.0/people/@self.json"
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "Authorization": token},
                method="GET",
            )
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=20) as resp:
                me_data = json.loads(resp.read().decode("utf-8"))
                me = me_data.get("response") or me_data.get("result") or me_data
                if isinstance(me, dict):
                    return str(me.get("email") or me.get("Email") or "").strip().lower()
        except Exception:
            pass
        return ""

    def _current_user_is_admin(self, portal: str, token: str) -> bool:
        try:
            url = f"{portal.rstrip('/')}/api/2.0/people/@self.json"
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "Authorization": token},
                method="GET",
            )
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=20) as resp:
                me_data = json.loads(resp.read().decode("utf-8"))
                me = me_data.get("response") or me_data.get("result") or me_data
                if isinstance(me, dict):
                    return me.get("isAdmin") is True
        except Exception:
            pass
        return False

    def _is_admin(self, portal: str, token: str) -> bool:
        if self._current_user_is_admin(portal, token):
            return True
        return self._current_user_email(portal, token) == "kenc@vanguardadj.com"

    def _handle_event_log_get(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        events = load_event_log(portal, user_id)
        _json_response(self, 200, {"events": events})

    def _handle_event_log_put(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        entries = payload.get("events")
        if not isinstance(entries, list):
            _json_response(self, 400, {"error": "events array is required"})
            return
        events = append_event_log(portal, user_id, entries)
        _json_response(self, 200, {"ok": True, "events": events})

    def _handle_event_log_users(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        if not self._is_admin(portal, token):
            _json_response(self, 403, {"error": "Forbidden"})
            return
        users = list_users_with_logs(portal)
        _json_response(self, 200, {"users": users})

    def _handle_event_log_admin_get(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        if not self._is_admin(portal, token):
            _json_response(self, 403, {"error": "Forbidden"})
            return
        qs = parse_qs(urlparse(self.path).query)
        target_user = (qs.get("userId") or [""])[0]
        if not target_user:
            _json_response(self, 400, {"error": "userId is required"})
            return
        events = load_event_log(portal, target_user)
        _json_response(self, 200, {"events": events})

    # ---------------- Bot customers (admin) ----------------

    def _handle_bot_customers_list(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        if not self._is_admin(portal, token):
            _json_response(self, 403, {"error": "Forbidden"})
            return
        mappings = list_mappings(portal)
        pending = get_pending_codes(portal)
        _json_response(self, 200, {"mappings": mappings, "pendingCodes": pending})

    def _handle_bot_customers_generate_code(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        if not self._is_admin(portal, token):
            _json_response(self, 403, {"error": "Forbidden"})
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
        if not contact_id:
            _json_response(self, 400, {"error": "contactId is required"})
            return
        result = generate_code(portal, int(contact_id), contact_name,
                               int(notes_category_id) if notes_category_id else None,
                               nickname)
        _json_response(self, 200, result)

    def _handle_bot_customers_cancel_code(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        if not self._is_admin(portal, token):
            _json_response(self, 403, {"error": "Forbidden"})
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        contact_id = payload.get("contactId")
        if not contact_id:
            _json_response(self, 400, {"error": "contactId is required"})
            return
        ok = cancel_code(portal, int(contact_id))
        _json_response(self, 200, {"ok": ok})

    def _handle_bot_customers_unlink(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        if not self._is_admin(portal, token):
            _json_response(self, 403, {"error": "Forbidden"})
            return
        qs = parse_qs(urlparse(self.path).query)
        raw = (qs.get("contactId") or [""])[0]
        if not raw:
            _json_response(self, 400, {"error": "contactId is required"})
            return
        ok = remove_mapping(portal, int(raw))
        _json_response(self, 200, {"ok": ok})

    def _handle_bot_customers_set_nickname(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        if not self._is_admin(portal, token):
            _json_response(self, 403, {"error": "Forbidden"})
            return
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        contact_id = payload.get("contactId")
        nickname = str(payload.get("nickname") or "").strip()
        if not contact_id:
            _json_response(self, 400, {"error": "contactId is required"})
            return
        ok = set_nickname(portal, int(contact_id), nickname)
        _json_response(self, 200, {"ok": ok})

    def _handle_bot_customers_verify_code(self) -> None:
        """Called by the Telegram bot process (not browser). Uses TELEGRAM_BOT_TOKEN."""
        bot_token = str(os.environ.get("TELEGRAM_BOT_TOKEN") or "")
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
        portal = str(payload.get("portal") or "").strip()
        if not code or not chat_id or not portal:
            _json_response(self, 400, {"error": "code, chatId, and portal are required"})
            return
        mapping = verify_code(portal, code)
        if not mapping:
            _json_response(self, 404, {"error": "Invalid or expired code"})
            return
        set_verify_chat_id(portal, mapping["contactId"], int(chat_id))
        _json_response(self, 200, mapping)

    def _handle_check_admin(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        is_admin = self._is_admin(portal, token)
        _json_response(self, 200, {"isAdmin": is_admin})

    # ---------------- Bot endpoints (gated by TELEGRAM_BOT_TOKEN) ----------------

    @staticmethod
    def _bot_token() -> str:
        return TELEGRAM_BOT_TOKEN

    def _bot_verify_request(self) -> bool:
        """Check Authorization: Bearer <bot_token> header."""
        auth_header = self.headers.get("Authorization", "").strip()
        expected = self._bot_token()
        return bool(expected) and auth_header == f"Bearer {expected}"

    _bot_crm_session: dict[str, Any] = {}  # {"token": "...", "expires": time}

    def _bot_crm_token(self, portal: str) -> str | None:
        """Get a CRM session token for the bot user, caching it."""
        session = self._bot_crm_session
        if session.get("token") and session.get("expires", 0) > time.time():
            return session["token"]
        if not BOT_CRM_EMAIL or not BOT_CRM_PASSWORD:
            return None
        body = json.dumps({"userName": BOT_CRM_EMAIL, "password": BOT_CRM_PASSWORD}).encode("utf-8")
        req = urllib.request.Request(
            f"{portal}/api/2.0/authentication.json",
            data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                token = data.get("response", {}).get("token")
                if token:
                    session["token"] = token
                    session["expires"] = time.time() + 3000  # 50 min cache
                    return token
        except Exception:
            pass
        return None

    def _bot_crm_proxy(self, portal: str, method: str, api_path: str, query: str = "", timeout: int = 30) -> tuple[int, Any]:
        """Make a CRM API call using bot credentials."""
        token = self._bot_crm_token(portal)
        if not token:
            return 502, {"error": "Bot CRM auth failed"}
        url = f"{portal}{api_path}"
        if query:
            url = f"{url}?{query}"
        req = urllib.request.Request(
            url,
            headers={"Accept": "application/json", "Authorization": token},
            method=method,
        )
        try:
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=timeout) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            data = exc.read()
            try:
                return exc.code, json.loads(data.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return exc.code, {"error": str(exc)}
        except urllib.error.URLError as exc:
            return 502, {"error": str(exc.reason)}

    def _handle_bot_me(self) -> None:
        if not self._bot_verify_request():
            _json_response(self, 403, {"error": "Forbidden"})
            return
        qs = parse_qs(urlparse(self.path).query)
        raw_chat = (qs.get("chatId") or [""])[0]
        if not raw_chat:
            _json_response(self, 400, {"error": "chatId is required"})
            return
        portal = _portal_base(self)
        if not portal:
            _json_response(self, 400, {"error": "Portal not configured"})
            return
        mapping = get_mapping_by_chat(portal, int(raw_chat))
        if not mapping:
            _json_response(self, 404, {"error": "Not found"})
            return
        _json_response(self, 200, mapping)

    def _handle_bot_deals(self) -> None:
        try:
            if not self._bot_verify_request():
                _json_response(self, 403, {"error": "Forbidden"})
                return
            qs = parse_qs(urlparse(self.path).query)
            raw_contact = (qs.get("contactId") or [""])[0]
            if not raw_contact:
                _json_response(self, 400, {"error": "contactId is required"})
                return
            portal = _portal_base(self)
            if not portal:
                _json_response(self, 400, {"error": "Portal not configured"})
                return
            contact_id = int(raw_contact)

            # Get mapping to check notesCategoryId
            raw_chat = (qs.get("chatId") or [""])[0]
            notes_category_id = None
            if raw_chat:
                mapping = get_mapping_by_chat(portal, int(raw_chat))
                if mapping:
                    notes_category_id = mapping.get("notesCategoryId")

            # Fetch opportunities for this contact (no stageType filter — CRM param is unreliable)
            filter_params = urlencode({
                "startIndex": "0",
                "count": "500",
                "filterValue": "",
                "contactId": str(contact_id),
                "sortBy": "date_created",
                "sortOrder": "descending",
            })
            code, data = self._bot_crm_proxy(portal, "GET", "/api/2.0/crm/opportunity/filter", filter_params)
            if code >= 400:
                _json_response(self, code, data)
                return
            opportunities = data.get("response") if isinstance(data, dict) else []
            # Filter to only open-stage deals locally (stageType = 0 or null)
            open_opps = []
            for opp in (opportunities or []):
                if not isinstance(opp, dict):
                    continue
                _stage = opp.get("stage") or opp.get("Stage") or {}
                _st = _stage.get("stageType") if isinstance(_stage, dict) else None
                if _st not in (0, "0", "Open", None, ""):
                    continue
                open_opps.append(opp)

            # Early title search filter (before expensive history calls)
            search = (qs.get("search") or [""])[0].strip().lower()
            matched_opps = open_opps
            if search:
                matched_opps = [
                    opp for opp in open_opps
                    if search in str(opp.get("title") or opp.get("Title") or "").lower()
                ]

            # Fetch history only for matched deals
            deals = []
            for opp in matched_opps:
                try:
                    opp_id = opp.get("id") or opp.get("ID")
                    if not opp_id:
                        continue
                    title = str(opp.get("title") or opp.get("Title") or f"Deal #{opp_id}")
                    stage = str(opp.get("stageTitle") or opp.get("StageTitle") or "")
                    amount_raw = opp.get("amount") or opp.get("Amount")
                    try:
                        amount = float(amount_raw) if amount_raw else 0
                    except (TypeError, ValueError):
                        amount = 0
                    currency = str(opp.get("currency") or opp.get("Currency") or "")

                    # Fetch recent history (last 5 events)
                    hist_params = urlencode({
                        "entityType": "opportunity",
                        "entityId": str(opp_id),
                        "startIndex": "0",
                        "count": "5",
                        "sortBy": "created",
                        "sortOrder": "descending",
                    })
                    hcode, hdata = self._bot_crm_proxy(portal, "GET", "/api/2.0/crm/history/filter", hist_params, timeout=10)
                    events = []
                    if hcode < 400:
                        raw_events = hdata.get("response") if isinstance(hdata, dict) else []
                        if isinstance(raw_events, list):
                            for ev in raw_events:
                                if not isinstance(ev, dict):
                                    continue
                                ev_cat = ev.get("category") or ev.get("Category") or {}
                                cat_id = None
                                if isinstance(ev_cat, dict):
                                    cat_id = ev_cat.get("id") or ev_cat.get("ID") or ev_cat.get("categoryId") or ev_cat.get("CategoryId")
                                elif isinstance(ev_cat, (int, str)):
                                    try:
                                        cat_id = int(ev_cat)
                                    except (TypeError, ValueError):
                                        pass
                                content = str(ev.get("content") or ev.get("Content") or "").strip()
                                created = str(ev.get("created") or ev.get("Created") or "")
                                if notes_category_id:
                                    # Specific category: take only the first (most recent) matching note
                                    if cat_id == notes_category_id and content:
                                        events.append({
                                            "content": content[:500],
                                            "created": created,
                                        })
                                        break  # most recent match found, stop iterating
                                else:
                                    # All Notes: collect up to 5 content-bearing events
                                    if content and len(events) < 5:
                                        events.append({
                                            "content": content[:500],
                                            "created": created,
                                        })

                    deals.append({
                        "id": int(opp_id),
                        "title": title,
                        "stage": stage,
                        "amount": amount,
                        "currency": currency,
                        "latestUpdate": events[0] if events else None,
                    })
                except Exception as exc:
                    self.log_message("Error processing deal %s: %s", opp.get("id") or opp.get("ID"), exc)

            _json_response(self, 200, {"deals": deals})
        except Exception as exc:
            self.log_message("Fatal in _handle_bot_deals: %s", exc)
            _json_response(self, 502, {"error": "Internal error"})

    def _handle_health_check(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        reachable = False
        try:
            url = f"{portal.rstrip('/')}/api/2.0/people/@self.json"
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "Authorization": token},
                method="GET",
            )
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=15) as resp:
                if resp.status == 200:
                    reachable = True
        except Exception:
            reachable = False
        _json_response(self, 200, {
            "ok": reachable,
            "crmReachable": reachable,
            "portalUrl": portal,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
        })

    # ---------------- Presence / Team (user status, heartbeats, basic DMs, admin for kenc) ----------------

    def _handle_presence_users(self) -> None:
        """Return the CRM people list (mediated). Client caches this until next login.
        Uses the caller's token so permissions/visibility are correct.
        """
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        # Mediate the people list request (same as client would do directly to CRM)
        url = f"{portal.rstrip('/')}/api/2.0/people.json"
        req = urllib.request.Request(
            url,
            headers={"Accept": "application/json", "Authorization": token},
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=30) as resp:
                body = resp.read()
                ctype = resp.headers.get_content_type() or "application/json"
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
            _json_response(self, 502, {"error": f"Could not load users: {exc}"})
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_presence_get(self) -> None:
        """Live presence snapshot + merged user info + DM hints.
        Admin-only fields (last* activity) are only included when the requester is a CRM admin.
        """
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, user_id = auth

        is_admin = self._is_admin(portal, token)
        my_email = self._current_user_email(portal, token)

        # Base people list (small, mediated)
        people: list[dict[str, Any]] = []
        try:
            url = f"{portal.rstrip('/')}/api/2.0/people.json"
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "Authorization": token},
                method="GET",
            )
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=30) as resp:
                pdata = json.loads(resp.read().decode("utf-8"))
                people = pdata.get("response") or pdata.get("result") or []
                if not isinstance(people, list):
                    people = []
        except Exception:
            people = []

        # Presence overlays (from our store)
        overlays = get_portal_presence_snapshot(portal)
        # Clean up stale presence records (browser closed without beforeunload)
        clean_stale_presence_records(portal)

        # Build response list
        now = datetime.now(timezone.utc)
        out_users: list[dict[str, Any]] = []
        for p in people:
            if not isinstance(p, dict):
                continue
            uid = str(p.get("id") or p.get("ID") or p.get("userId") or p.get("UserId") or "")
            if not uid:
                continue
            ov = overlays.get(uid) or {}
            status = ov.get("status") or ""
            hb = self._parse_iso_datetime(ov.get("lastHeartbeat") or "")
            last_crm = self._parse_iso_datetime(ov.get("lastCrmActivity") or "")
            last_dash = self._parse_iso_datetime(ov.get("lastDashboardActivity") or "")

            online = False
            idle = False
            afd = False
            if hb:
                delta = (now - hb).total_seconds()
                online = delta < (10 * 60)  # 10 min window for "online"
                idle = delta > (2 * 60 * 60) and online  # >2h idle flag (visual only while "online")
                if not online:
                    # Has a (non-cleared) heartbeat record → had an active dashboard session.
                    # If within the ~3h auto-logout window, this is "tabbed away" (AFD), not signed out.
                    # Signed-out users have their lastHeartbeat cleared in _handle_logout.
                    # Very old (>3h) heartbeats without logout are treated as offline (aged out).
                    if delta < (3 * 60 * 60):
                        afd = True

            auto_status = ov.get("autoStatus") or ""
            needs_cleanup = False
            # Strip auto-status if user is not actively online or last dashboard activity is too old
            # (client-side 5-min timeout may not have fired if the browser was closed)
            if auto_status:
                if not online:
                    auto_status = ""
                    needs_cleanup = True
                elif last_dash and (now - last_dash).total_seconds() > PRESENCE_AUTO_STATUS_TIMEOUT_S:
                    auto_status = ""
                    needs_cleanup = True
            if needs_cleanup:
                clear_auto_status(portal, uid)

            row: dict[str, Any] = {
                "id": uid,
                "displayName": str(p.get("displayName") or p.get("DisplayName") or p.get("userName") or p.get("UserName") or uid),
                "email": str(p.get("email") or p.get("Email") or "").strip().lower(),
                "online": online,
                "idle": idle and online,
                "afd": afd,
                "status": status,
                "inferred": bool(ov.get("inferred") or False),
                "autoStatus": auto_status,
                "lastSeen": ov.get("lastHeartbeat") or ov.get("lastDashboardActivity") or "",
            }

            if is_admin:
                # Only for the admin user – extra details (never shown on the main "Team" list)
                row["admin"] = {
                    "lastHeartbeat": ov.get("lastHeartbeat") or "",
                    "lastCrmActivity": ov.get("lastCrmActivity") or "",
                    "lastDashboardActivity": ov.get("lastDashboardActivity") or "",
                    "lastHeartbeatMinutesAgo": int((now - hb).total_seconds() / 60) if hb else None,
                    "lastCrmMinutesAgo": int((now - last_crm).total_seconds() / 60) if last_crm else None,
                    "lastDashMinutesAgo": int((now - last_dash).total_seconds() / 60) if last_dash else None,
                }

            out_users.append(row)

        # Include overlay-only users who have heartbeats but aren't in the CRM people list
        # (e.g. when CRM is unreachable). Uses the user ID as display name fallback.
        for uid, ov in overlays.items():
            if uid == user_id: continue
            if not any(u.get("id") == uid for u in out_users):
                ov_hb = self._parse_iso_datetime(ov.get("lastHeartbeat") or "")
                ov_online = False
                ov_idle = False
                ov_afd = False
                if ov_hb:
                    delta = (now - ov_hb).total_seconds()
                    ov_online = delta < (10 * 60)
                    ov_idle = delta > (2 * 60 * 60) and ov_online
                    if not ov_online and delta < (3 * 60 * 60):
                        ov_afd = True
                ov_auto = ov.get("autoStatus") or ""
                ov_needs_cleanup = False
                if ov_auto:
                    if not ov_online:
                        ov_auto = ""
                        ov_needs_cleanup = True
                    else:
                        ov_last_dash = self._parse_iso_datetime(ov.get("lastDashboardActivity") or "")
                        if ov_last_dash and (now - ov_last_dash).total_seconds() > PRESENCE_AUTO_STATUS_TIMEOUT_S:
                            ov_auto = ""
                            ov_needs_cleanup = True
                if ov_needs_cleanup:
                    clear_auto_status(portal, uid)
                out_users.append({
                    "id": uid,
                    "displayName": uid,
                    "email": "",
                    "online": ov_online,
                    "idle": ov_idle and ov_online,
                    "afd": ov_afd,
                    "status": ov.get("status", ""),
                    "inferred": bool(ov.get("inferred", False)),
                    "autoStatus": ov_auto,
                    "lastSeen": ov.get("lastHeartbeat") or ov.get("lastDashboardActivity") or "",
                })

        # Also surface the caller's own presence record (for the modal to know "me")
        my_presence = load_user_presence(portal, user_id)
        my_last_read = load_user_last_read_dms(portal, user_id)

        # Apply same auto-status expiration to the caller's own record
        my_auto_status = my_presence.get("autoStatus", "")
        if my_auto_status:
            my_last_dash = self._parse_iso_datetime(my_presence.get("lastDashboardActivity") or "")
            if my_last_dash and (now - my_last_dash).total_seconds() > PRESENCE_AUTO_STATUS_TIMEOUT_S:
                my_auto_status = ""
                clear_auto_status(portal, user_id)

        _json_response(
            self,
            200,
            {
                "users": out_users,
                "me": {
                    "id": user_id,
                    "email": my_email,
                    "status": my_presence.get("status", ""),
                    "inferred": bool(my_presence.get("inferred") or False),
                    "autoStatus": my_auto_status,
                    "lastHeartbeat": my_presence.get("lastHeartbeat", ""),
                },
                "isAdmin": is_admin,
                "myRecentDms": get_recent_dms_for_user(portal, user_id, 50),
                "lastReadDms": my_last_read,
            },
        )

    def _handle_presence_heartbeat(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        offline = False
        visible = False
        try:
            body = _read_body(self)
            if body:
                payload = json.loads(body)
                offline = bool(payload.get("offline"))
                visible = bool(payload.get("visible"))
        except (json.JSONDecodeError, ValueError):
            pass
        touch_heartbeat(portal, user_id, offline=offline, visible=visible)
        _json_response(self, 200, {"ok": True})

    def _handle_presence_status(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        # Only update status if explicitly provided in the payload
        has_status = "status" in payload
        status_text = str(payload.get("status") or "")[:200] if has_status else None
        auto_status = payload.get("autoStatus")  # None if not provided
        inferred = bool(payload.get("inferred") or False)
        rec = set_status(portal, user_id, status_text, inferred=inferred, autoStatus=auto_status)
        _json_response(self, 200, {"ok": True, "status": rec.get("status", ""), "inferred": rec.get("inferred", False), "autoStatus": rec.get("autoStatus", "")})

    def _handle_presence_last_read(self) -> None:
        """Persist a last-read timestamp for a DM conversation (cross-device read state)."""
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON body"})
            return
        other = str(payload.get("with") or payload.get("other") or payload.get("to") or "").strip()
        at = str(payload.get("at") or payload.get("ts") or "")
        if not other:
            _json_response(self, 400, {"error": "with=<userId> is required"})
            return
        set_last_read_dm(portal, user_id, other, at or None)
        _json_response(self, 200, {"ok": True})

    def _handle_presence_dm_get(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        query = parse_qs(urlparse(self.path).query)
        with_id = (query.get("with") or [""])[0]
        if not with_id:
            _json_response(self, 400, {"error": "with=<userId> is required"})
            return
        offset_str = (query.get("offset") or [""])[0]
        offset = 0
        if offset_str:
            try:
                offset = int(offset_str)
            except ValueError:
                pass
        # Mark incoming messages as read (for read receipts) before returning
        mark_messages_read(portal, user_id, with_id)
        msgs, has_more = get_conversation(portal, user_id, with_id, offset=offset)
        _json_response(self, 200, {"messages": msgs, "has_more": has_more})

    def _handle_presence_dm_post(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
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
        reply_to = payload.get("reply_to")
        reply_text = payload.get("reply_text")
        msg = append_dm(portal, user_id, to_id, text, reply_to, reply_text)
        _json_response(self, 200, {"ok": True, "message": msg})

    def _handle_presence_dm_clear(self) -> None:
        auth = _require_auth(self)
        if not auth:
            return
        portal, _token, user_id = auth
        query = parse_qs(urlparse(self.path).query)
        with_id = (query.get("with") or [""])[0]
        if not with_id:
            _json_response(self, 400, {"error": "with=<userId> is required"})
            return
        clear_conversation(portal, user_id, with_id)
        _json_response(self, 200, {"ok": True})

    def _maybe_touch_crm_activity_for_current_request(self) -> None:
        """Best-effort resolution of the current user from the session cookie and touch CRM activity.
        Never sends error responses; used from the generic proxy path.
        """
        try:
            token = _session_token(self)
            if not token:
                return
            portal = _portal_base(self)
            if not portal:
                return
            # Resolve user id without using _require_auth (which would send 4xx/5xx on failure)
            user_id = _fetch_crm_user_id(portal, token)
            if user_id:
                touch_crm_activity(portal, user_id)
        except Exception:
            # Never let presence tracking break a real proxy response
            pass

    def _parse_iso_datetime(self, value: str):
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

    def _handle_batch_opportunity_tags(self) -> None:
        """Batch-fetch tags for multiple opportunity IDs in parallel.
        GET /api/batch-opportunity-tags?ids=1,2,3
        Returns {"tags": {"1": [...], "2": [...], ...}}
        """
        auth = _require_auth(self)
        if not auth:
            return
        portal, token, _user_id = auth
        qs = parse_qs(urlparse(self.path).query)
        raw = qs.get("ids", [None])[0]
        if not raw:
            _json_response(self, 400, {"error": "Missing ids parameter"})
            return
        ids = [x.strip() for x in raw.split(",") if x.strip().isdigit()]
        if not ids:
            _json_response(self, 400, {"error": "No valid ids provided"})
            return

        from concurrent.futures import ThreadPoolExecutor, as_completed
        result: dict[str, list[Any]] = {}
        base_url = portal.rstrip("/")

        def fetch_tags(opp_id: str) -> tuple[str, list[Any]]:
            url = f"{base_url}/api/2.0/crm/opportunity/tag/{opp_id}"
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "Authorization": token},
                method="GET",
            )
            try:
                with urllib.request.urlopen(req, context=_ssl_context(), timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    tags = data.get("response") or data.get("result") or data
                    if isinstance(tags, list):
                        return opp_id, tags
                    return opp_id, []
            except Exception:
                return opp_id, []

        with ThreadPoolExecutor(max_workers=12) as pool:
            futures = {pool.submit(fetch_tags, oid): oid for oid in ids}
            for fut in as_completed(futures):
                oid, tags = fut.result()
                result[oid] = tags

        _json_response(self, 200, {"tags": result})

    def _handle_crm_proxy(self, method: str) -> None:
        path = urlparse(self.path).path
        # Strip /crm-proxy/ prefix to get the actual CRM path
        target = path[len("/crm-proxy"):]  # e.g., /Default.aspx
        if not target.startswith("/"):
            target = "/" + target
        portal = _portal_base(self)
        if not portal:
            self.send_error(400, "Portal not configured")
            return
        jar = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        token = jar.get(SESSION_COOKIE)
        if token is None:
            self.send_error(401, "Not authenticated")
            return
        url = f"{portal}{target}"
        headers = {"Authorization": token.value, "Accept": "*/*"}
        req = urllib.request.Request(url, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=120) as resp:
                body = resp.read()
                ctype = resp.headers.get_content_type() or "text/html"
        except urllib.error.HTTPError as exc:
            body = exc.read()
            ctype = exc.headers.get_content_type() if exc.headers else "text/html"
            self.send_response(exc.code)
        except urllib.error.URLError as exc:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(str(exc.reason).encode("utf-8"))
            return
        else:
            self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        # Explicitly strip X-Frame-Options to allow iframe embedding
        self.end_headers()
        self.wfile.write(body)

    def _handle_api_get(self) -> None:
        api_path = urlparse(self.path).path

        # Presence / Team endpoints (before any other /api/ handling or proxy fallback).
        # Use exact match on the path (query is stripped by .path). This must come early
        # so direct /api/presence/* calls from the client are not treated as proxied CRM calls.
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
            # Unknown /api/presence/* path -> explicit 404 (do not fall through to proxy logic)
            self.send_error(404)
            return

        if api_path == "/api/event-log":
            self._handle_event_log_get()
            return
        if api_path == "/api/event-log/users":
            self._handle_event_log_users()
            return
        if api_path == "/api/event-log/all":
            self._handle_event_log_admin_get()
            return
        if api_path == "/api/health":
            self._handle_health_check()
            return

        if api_path == "/api/batch-opportunity-tags":
            self._handle_batch_opportunity_tags()
            return
        if api_path == "/api/user-profile":
            self._handle_user_profile_get()
            return
        if api_path == "/api/dashboard-notes":
            self._handle_dashboard_notes_get()
            return
        if api_path == "/api/calendar/feed":
            self._handle_calendar_feed()
            return
        if api_path == "/api/config":
            _json_response(
                self,
                200,
                {
                    "portalUrl": PORTAL_URL or DEFAULT_PORTAL,
                    "defaultPortalConfigured": bool(PORTAL_URL or DEFAULT_PORTAL),
                    "version": APP_VERSION,
                },
            )
            return
        if api_path == "/api/changelog":
            changelog_path = Path(__file__).parent / "CHANGELOG.md"
            if changelog_path.exists():
                body = changelog_path.read_text("utf-8")
            else:
                body = "# Changelog\n\nNo changelog available."
            self.send_response(200)
            self.send_header("Content-Type", "text/markdown; charset=utf-8")
            self.send_header("Content-Length", str(len(body.encode("utf-8"))))
            self.end_headers()
            self.wfile.write(body.encode("utf-8"))
            return
        if api_path == "/api/session":
            jar = cookies.SimpleCookie(self.headers.get("Cookie", ""))
            _json_response(self, 200, {"authenticated": SESSION_COOKIE in jar})
            return
        if api_path == "/api/check-admin":
            self._handle_check_admin()
            return
        if api_path == "/api/bot-customers":
            self._handle_bot_customers_list()
            return
        if api_path == "/api/bot/me":
            self._handle_bot_me()
            return
        if api_path == "/api/bot/deals":
            self._handle_bot_deals()
            return

        route = self._api_route()
        if not route:
            self.send_error(404)
            return
        api_path, query = route

        # Server-side response cache (GET only, specific endpoints)
        ttl = _proxy_cache_ttl(api_path)
        if ttl is not None:
            portal = _portal_base(self)
            token = _session_token(self) or ""
            ck = _cache_key("GET", api_path, query, portal, token)
            cached = _proxy_cache.get(ck)
            if cached is not None:
                status, body, ctype = cached
                self.send_response(status)
                self.send_header("Content-Type", ctype or "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("X-Proxy-Cache", "HIT")
                self.end_headers()
                self.wfile.write(body)
                return

        status, body, ctype = _proxy_request(self, "GET", api_path, query)

        # Cache successful GET responses
        if ttl is not None and 200 <= status < 400:
            portal = _portal_base(self)
            token = _session_token(self) or ""
            ck = _cache_key("GET", api_path, query, portal, token)
            _proxy_cache.set(ck, (status, body, ctype), ttl)

        # Best-effort: record CRM activity for presence (only when we can resolve the user without failing the response)
        if status < 400 and ("/crm/" in api_path.lower() or "/people/" in api_path.lower()):
            self._maybe_touch_crm_activity_for_current_request()
        self.send_response(status)
        self.send_header("Content-Type", ctype or "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_api_post_put(self, method: str) -> None:
        api_path = urlparse(self.path).path

        # Presence endpoints (before other /api/ or proxy fallback). Startswith guard + explicit 404
        # for unknown presence paths so they never leak to the CRM proxy logic.
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
            # Unknown /api/presence/* + method -> 404 (do not proxy)
            self.send_error(404)
            return

        if api_path == "/api/event-log" and method == "PUT":
            self._handle_event_log_put()
            return

        if api_path == "/api/user-profile" and method == "PUT":
            self._handle_user_profile_put()
            return
        if api_path == "/api/dashboard-notes" and method == "PUT":
            self._handle_dashboard_notes_put()
            return

        # Bot-customers endpoints
        if api_path.startswith("/api/bot-customers"):
            if api_path == "/api/bot-customers/generate-code" and method == "POST":
                self._handle_bot_customers_generate_code()
                return
            if api_path == "/api/bot-customers/cancel-code" and method == "POST":
                self._handle_bot_customers_cancel_code()
                return
            if api_path == "/api/bot-customers/verify-code" and method == "POST":
                self._handle_bot_customers_verify_code()
                return
            if api_path == "/api/bot-customers/mapping" and method == "DELETE":
                self._handle_bot_customers_unlink()
                return
            if api_path == "/api/bot-customers/nickname" and method == "PUT":
                self._handle_bot_customers_set_nickname()
                return
            self.send_error(404)
            return

        route = self._api_route()
        if not route:
            self.send_error(404)
            return
        api_path, query = route
        body = _read_body(self)
        incoming_ct = self.headers.get("Content-Type", "")
        proxy_ct = None
        if body and incoming_ct:
            if "multipart/form-data" in incoming_ct.lower():
                proxy_ct = incoming_ct
            elif "application/json" in incoming_ct.lower():
                proxy_ct = "application/json"
            elif "application/x-www-form-urlencoded" in incoming_ct.lower():
                proxy_ct = incoming_ct
        status, resp_body, ctype = _proxy_request(
            self, method, api_path, query, body if body else None, content_type=proxy_ct
        )
        if status < 400 and ("/crm/" in api_path.lower() or "/people/" in api_path.lower()):
            self._maybe_touch_crm_activity_for_current_request()
        # Invalidate proxy cache on successful mutations so long TTLs are safe.
        if status < 400:
            p = api_path.lower()
            if "/crm/opportunity/tag" in p:
                _proxy_cache.invalidate_prefix("GET:/api/2.0/crm/opportunity/tag")
                _proxy_cache.invalidate_prefix("GET:/api/2.0/crm/opportunity/filter")
                # Also invalidate the single-opp cache line for the affected opportunity
                m = re.search(r"/crm/opportunity/(\d+)", p)
                if m:
                    _proxy_cache.invalidate_prefix(f"GET:/api/2.0/crm/opportunity/{m.group(1)}")
            elif "/crm/opportunity/stage" in p:
                _proxy_cache.invalidate_prefix("GET:/api/2.0/crm/opportunity/stage")
            elif "/crm/opportunity/customfield" in p or "/customfield/" in p:
                _proxy_cache.invalidate_prefix("GET:/api/2.0/crm/opportunity/")  # nuke all opp caches (rare mutation)
            elif "/crm/opportunity/" in p and method in ("PUT", "POST", "DELETE"):
                # Opp update — invalidate filter results + this specific opp's single-opp cache line
                _proxy_cache.invalidate_prefix("GET:/api/2.0/crm/opportunity/filter")
                _proxy_cache.invalidate_prefix(f"GET:{api_path}")
            elif "/crm/history" in p:
                _proxy_cache.invalidate_prefix("GET:/api/2.0/crm/history")
        self.send_response(status)
        self.send_header("Content-Type", ctype or "application/json")
        self.send_header("Content-Length", str(len(resp_body)))
        self.end_headers()
        self.wfile.write(resp_body)


def main() -> None:
    if not PUBLIC.is_dir():
        raise SystemExit(f"Missing public directory: {PUBLIC}")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), KanbanHandler)
    print(f"CRM Kanban dashboard: http://127.0.0.1:{PORT}")
    if PORTAL_URL:
        print(f"OnlyOffice portal (default): {PORTAL_URL}")
    else:
        print("Set ONLYOFFICE_PORTAL_URL or enter portal URL in the login screen.")
    server.serve_forever()


if __name__ == "__main__":
    main()