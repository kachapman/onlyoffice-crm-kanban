#!/usr/bin/env python3
"""
Local Test / Chaos Server for Mutation Queue (Offline Resilience)

Purpose:
  Allows you to test the new client-side mutation queue without needing the
  real OnlyOffice CRM to be up or network conditions to be bad.

  - Fakes authentication (any login works).
  - Serves the dashboard static files.
  - Proxies/mocks /api/proxy/* calls.
  - Has a controllable "chaos" mode that makes CRM mutation calls fail with
    configurable HTTP status (e.g. 503) and optional delay. This triggers the
    queue in the browser.

Usage:
  1. (Optional) cp config.example.env .env   # only needed if you also want real proxying sometimes
  2. python test-server.py
  3. Open http://127.0.0.1:8765 (or the PORT you set)
  4. Log in with any username/password (test mode accepts everything).
  5. In the browser console, toggle chaos:

     // Make CRM writes fail (this should cause actions to queue)
     fetch('/api/test/chaos', {
       method: 'POST',
       headers: {'Content-Type': 'application/json'},
       body: JSON.stringify({enabled: true, status: 503, delay: 300})
     }).then(r => r.json()).then(console.log);

  6. Perform actions that mutate CRM data:
       - Create a task (header button or tasks tile)
       - Quick note
       - Edit a deal (change stage, due date, tags, add note)
       - (If using kanban drag) move a card between stages

     You should see:
       - The UI update optimistically (card moves, task appears, etc.)
       - "Action queued for sync..." toast
       - The "#mutation-sync-status" badge in the header showing "N pending"

  7. Turn chaos off to let the queue processor replay:

     fetch('/api/test/chaos', {
       method: 'POST',
       headers: {'Content-Type': 'application/json'},
       body: JSON.stringify({enabled: false})
     }).then(r => r.json()).then(console.log);

     You should see "Synced: ..." toasts, the badge clear, and (if the test
     server returns success) the processor considers the mutations done.

  8. Other useful console commands:

     // See current state
     fetch('/api/test/chaos').then(r=>r.json()).then(console.log)

     // Force an immediate processor run (the queue also runs on 'online',
     // visibility, and a 5s interval)
     // (no direct trigger exposed, just toggle or wait)

  The server also supports the normal /api/user-profile etc. so groups,
  layout, templates, etc. continue to work for a realistic test session.

  When chaos is OFF, CRM proxy calls return a generic success so the queue
  processor sees non-error responses and clears items. When you have a real
  PORTAL_URL in .env you can also let it proxy for end-to-end when chaos=off.

This is derived from server.py for compatibility with the existing dashboard.
"""

from __future__ import annotations

import json
import os
import re
import time
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from user_profile_store import load_user_profile, save_user_profile  # reuse if present
from event_log_store import append_event_log, load_event_log, list_users_with_logs  # reuse if present

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"

# --- Chaos / failure injection state (controllable via /api/test/chaos) ---
# This is what lets you test the mutation queue reliably.
CHAOS = {
    "enabled": False,
    "status": 503,
    "delay": 0,          # milliseconds
    "message": "Simulated CRM / proxy failure (for mutation queue testing)",
}

# In-memory test profile so the dashboard is usable without a real backend
_TEST_PROFILE = {
    "groups": [],
    "tileLayout": {"order": [], "widths": {}, "heights": {}, "collapsed": {}},
    "calendarTiles": [],
    "notesTiles": [],
    "groupTemplates": [],
    "hiddenFeedKeys": [],
    "feedKeywordFilter": "",
}

SESSION_COOKIE = "oo_token"
PORT = int(os.environ.get("PORT", "8765"))


def _json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
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


class TestChaosHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        # Reduce noise for /api/ calls during testing
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
            self._handle_test_login()
            return
        if self.path == "/api/logout":
            self._handle_logout()
            return
        if self.path == "/api/test/chaos":
            self._handle_chaos_control()
            return
        if self.path.startswith("/api/"):
            self._handle_api_post_put("POST")
            return
        super().do_POST()

    def do_PUT(self) -> None:
        if self.path == "/api/test/chaos":
            self._handle_chaos_control()
            return
        if self.path.startswith("/api/"):
            self._handle_api_post_put("PUT")
            return
        self.send_error(405)

    def do_DELETE(self) -> None:
        if self.path.startswith("/api/"):
            self._handle_api_post_put("DELETE")
            return
        self.send_error(405)

    # --- Test login (any credentials work) ---
    def _handle_test_login(self) -> None:
        # Always succeed in test mode. This lets you test the queue without
        # a real OnlyOffice instance or valid credentials.
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            payload = {}

        portal = (payload.get("portalUrl") or "https://test.local").strip().rstrip("/")

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")

        cookie = cookies.SimpleCookie()
        cookie[SESSION_COOKIE] = "test-token-for-queue-testing"
        cookie[SESSION_COOKIE]["path"] = "/"
        cookie[SESSION_COOKIE]["httponly"] = True
        cookie[SESSION_COOKIE]["samesite"] = "Lax"
        self.send_header("Set-Cookie", cookie.output(header="").strip())

        body_out = json.dumps({
            "ok": True,
            "portalUrl": portal,
            "expires": "2099-01-01T00:00:00Z",
            "testMode": True,
        }).encode("utf-8")
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

    def _handle_chaos_control(self) -> None:
        """GET or POST to control failure injection.

        POST body example:
        {
          "enabled": true,
          "status": 503,
          "delay": 1200,           // milliseconds
          "message": "Testing queue"
        }

        GET returns current state.
        """
        if self.command == "GET":
            _json_response(self, 200, {
                "enabled": CHAOS["enabled"],
                "status": CHAOS["status"],
                "delay": CHAOS["delay"],
                "message": CHAOS["message"],
            })
            return

        # POST / PUT
        try:
            payload = json.loads(_read_body(self) or b"{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON"})
            return

        if "enabled" in payload:
            CHAOS["enabled"] = bool(payload["enabled"])
        if "status" in payload:
            try:
                CHAOS["status"] = int(payload["status"])
            except (TypeError, ValueError):
                pass
        if "delay" in payload:
            try:
                CHAOS["delay"] = max(0, int(payload["delay"]))
            except (TypeError, ValueError):
                pass
        if "message" in payload and isinstance(payload["message"], str):
            CHAOS["message"] = payload["message"]

        _json_response(self, 200, {
            "ok": True,
            "current": {
                "enabled": CHAOS["enabled"],
                "status": CHAOS["status"],
                "delay": CHAOS["delay"],
                "message": CHAOS["message"],
            }
        })

    def _is_crm_path(self, api_path: str) -> bool:
        return "/crm/" in (api_path or "").lower()

    def _handle_event_log_test(self, method: str) -> None:
        portal = "https://test.local"
        user_id = self._test_user_id()
        if method == "GET":
            events = load_event_log(portal, user_id)
            _json_response(self, 200, {"events": events})
            return
        if method == "PUT":
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                _json_response(self, 400, {"error": "Invalid JSON"})
                return
            entries = payload.get("events")
            if not isinstance(entries, list):
                _json_response(self, 400, {"error": "events array is required"})
                return
            events = append_event_log(portal, user_id, entries)
            _json_response(self, 200, {"ok": True, "events": events})
            return

    def _handle_event_log_users_test(self) -> None:
        users = list_users_with_logs("https://test.local")
        _json_response(self, 200, {"users": users})

    def _handle_event_log_admin_test(self) -> None:
        query = urlparse(self.path).query
        user_id = ""
        for part in query.split("&"):
            if part.startswith("userId="):
                user_id = part[7:]
                break
        if not user_id:
            _json_response(self, 400, {"error": "userId is required"})
            return
        events = load_event_log("https://test.local", user_id)
        _json_response(self, 200, {"events": events})

    def _handle_health_test(self) -> None:
        _json_response(self, 200, {
            "ok": True,
            "crmReachable": True,
            "portalUrl": "https://test.local",
            "checkedAt": "2026-06-24T00:00:00+00:00",
            "testMode": True,
        })

    def _handle_api_get(self) -> None:
        path = urlparse(self.path).path

        if path == "/api/event-log":
            self._handle_event_log_test("GET")
            return
        if path == "/api/event-log/users":
            self._handle_event_log_users_test()
            return
        if path == "/api/event-log/all":
            self._handle_event_log_admin_test()
            return
        if path == "/api/health":
            self._handle_health_test()
            return

        if path == "/api/user-profile":
            # Return a usable test profile
            _json_response(self, 200, _TEST_PROFILE)
            return
        if path == "/api/dashboard-notes":
            _json_response(self, 200, {"tiles": _TEST_PROFILE.get("notesTiles", [])})
            return
        if path == "/api/config":
            _json_response(self, 200, {
                "portalUrl": "https://test.local",
                "defaultPortalConfigured": True,
                "testMode": True,
            })
            return
        if path == "/api/session":
            _json_response(self, 200, {"authenticated": True, "testMode": True})
            return
        if path == "/api/test/chaos":
            self._handle_chaos_control()
            return

        # Proxy path (or other)
        route = self._get_proxy_route()
        if not route:
            self.send_error(404)
            return

        api_path, query = route

        if CHAOS["enabled"] and self._is_crm_path(api_path):
            if CHAOS["delay"]:
                time.sleep(CHAOS["delay"] / 1000.0)
            body = json.dumps({"error": CHAOS["message"], "testMode": True}).encode("utf-8")
            self.send_response(CHAOS["status"])
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # When not in chaos, return a generic success for reads so the UI stays happy.
        # Real mutations are usually POST/PUT so they go through _handle_api_post_put.
        body = json.dumps({"response": [], "testMode": True}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_api_post_put(self, method: str) -> None:
        path = urlparse(self.path).path

        if path == "/api/event-log" and method == "PUT":
            self._handle_event_log_test("PUT")
            return

        if path == "/api/user-profile" and method == "PUT":
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                payload = {}
            # Merge into our test profile (very basic)
            _TEST_PROFILE.update(payload)
            _json_response(self, 200, {"ok": True, "testMode": True, **_TEST_PROFILE})
            return

        if path == "/api/dashboard-notes" and method == "PUT":
            try:
                payload = json.loads(_read_body(self) or b"{}")
            except json.JSONDecodeError:
                payload = {}
            tiles = payload.get("tiles", [])
            _TEST_PROFILE["notesTiles"] = tiles
            _json_response(self, 200, {"ok": True, "tiles": tiles, "testMode": True})
            return

        if path == "/api/test/chaos":
            self._handle_chaos_control()
            return

        route = self._get_proxy_route()
        if not route:
            self.send_error(404)
            return

        api_path, query = route
        body = _read_body(self)

        if CHAOS["enabled"] and self._is_crm_path(api_path):
            if CHAOS["delay"]:
                time.sleep(CHAOS["delay"] / 1000.0)
            resp_body = json.dumps({"error": CHAOS["message"], "testMode": True}).encode("utf-8")
            self.send_response(CHAOS["status"])
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)
            return

        # Chaos off -> pretend the mutation succeeded.
        # This is what lets the queue processor see a successful replay.
        resp_body = json.dumps({
            "ok": True,
            "response": {"id": "test-123", "testMode": True},
            "testMode": True,
        }).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp_body)))
        self.end_headers()
        self.wfile.write(resp_body)

    def _get_proxy_route(self):
        match = re.match(r"^/api/proxy(/.*)$", urlparse(self.path).path)
        if not match:
            return None
        api_path = match.group(1)
        parsed = urlparse(self.path)
        return api_path, parsed.query

    def end_headers(self) -> None:
        path = urlparse(self.path).path
        if re.search(r"/favicon\.(ico|png)$", path, re.I):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()


def main() -> None:
    if not PUBLIC.is_dir():
        raise SystemExit(f"Missing public/ directory: {PUBLIC}")

    # Make sure we have a runnable profile for the dashboard to load groups etc.
    # (The real server uses per-user files; here we just keep it in memory.)

    server = ThreadingHTTPServer(("0.0.0.0", PORT), TestChaosHandler)
    print(f"CRM Kanban TEST server (chaos mode for queue testing)")
    print(f"  URL:   http://127.0.0.1:{PORT}")
    print(f"  Login: Use any username/password (test mode fakes auth)")
    print()
    print("Control chaos from browser console:")
    print('  fetch("/api/test/chaos", {method:"POST", headers:{"Content-Type":"application/json"},')
    print('         body: JSON.stringify({enabled:true, status:503, delay:400})})')
    print()
    print("Turn it back to normal:")
    print('  fetch("/api/test/chaos", {method:"POST", headers:{"Content-Type":"application/json"},')
    print('         body: JSON.stringify({enabled:false})})')
    print()
    print("Current state:")
    print('  fetch("/api/test/chaos").then(r => r.json()).then(console.log)')
    print()
    server.serve_forever()


if __name__ == "__main__":
    main()
