#!/usr/bin/env python3
"""DEV ONLY: standalone proxy for UI testing.

Production: install onlyoffice-module/ into Community Server (see INSTALL.txt).
The board is then served by Workspace at /Products/OpportunityBoard/Default.aspx.
"""

from __future__ import annotations

import json
import os
import re
import ssl
import urllib.error
import urllib.request
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

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
DEFAULT_PORTAL = PORTAL_URL or "https://office.vanguardadj.com"
SSL_VERIFY = os.environ.get("ONLYOFFICE_SSL_VERIFY", "true").lower() not in (
    "0",
    "false",
    "no",
)
SESSION_COOKIE = "oo_token"


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
) -> tuple[int, bytes, str]:
    portal = _portal_base(handler)
    if not portal:
        return 400, b'{"error":"Portal URL not configured. Set ONLYOFFICE_PORTAL_URL or send X-OnlyOffice-Portal header."}', "application/json"

    jar = cookies.SimpleCookie(handler.headers.get("Cookie", ""))
    token = jar.get(SESSION_COOKIE)
    if token is None:
        return 401, b'{"error":"Not authenticated"}', "application/json"

    path = api_path if api_path.startswith("/") else f"/{api_path}"
    if not path.endswith(".json"):
        path = f"{path}.json"
    url = f"{portal}{path}"
    if query:
        url = f"{url}?{query}"

    headers = {
        "Accept": "application/json",
        "Authorization": token.value,
    }
    if body:
        headers["Content-Type"] = "application/json"
    elif method in ("PUT", "POST", "DELETE"):
        body = b"{}"
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=_ssl_context()) as resp:
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
        super().do_GET()

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
        super().do_POST()

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

    def _handle_api_get(self) -> None:
        if self.path == "/api/config":
            _json_response(
                self,
                200,
                {
                    "portalUrl": PORTAL_URL or DEFAULT_PORTAL,
                    "defaultPortalConfigured": bool(PORTAL_URL or DEFAULT_PORTAL),
                },
            )
            return
        if self.path == "/api/session":
            jar = cookies.SimpleCookie(self.headers.get("Cookie", ""))
            _json_response(self, 200, {"authenticated": SESSION_COOKIE in jar})
            return

        route = self._api_route()
        if not route:
            self.send_error(404)
            return
        api_path, query = route
        status, body, ctype = _proxy_request(self, "GET", api_path, query)
        self.send_response(status)
        self.send_header("Content-Type", ctype or "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_api_post_put(self, method: str) -> None:
        route = self._api_route()
        if not route:
            self.send_error(404)
            return
        api_path, query = route
        body = _read_body(self)
        status, resp_body, ctype = _proxy_request(self, method, api_path, query, body or None)
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