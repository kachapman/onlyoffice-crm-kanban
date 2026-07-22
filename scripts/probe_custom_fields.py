#!/usr/bin/env python3
"""Probe CRM opportunity custom-field API (requires ONLYOFFICE_USER + ONLYOFFICE_PASSWORD in env)."""

from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env"
PORTAL = os.environ.get("ONLYOFFICE_PORTAL_URL", "https://office.publicadjustermidwest.com").rstrip("/")
USER = os.environ.get("ONLYOFFICE_USER", "")
PASSWORD = os.environ.get("ONLYOFFICE_PASSWORD", "")


def load_env() -> None:
    if not ENV.is_file():
        return
    for line in ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def request(method: str, path: str, token: str, body: dict | None = None, query: str = "") -> tuple[int, dict]:
    url = f"{PORTAL}{path}.json"
    if query:
        url = f"{url}?{query}"
    data = None
    headers = {"Accept": "application/json", "Authorization": token}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, {"error": raw[:500]}
    try:
        return 200, json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return 200, {"raw": raw[:500]}


def main() -> int:
    load_env()
    global USER, PASSWORD, PORTAL
    USER = os.environ.get("ONLYOFFICE_USER", USER)
    PASSWORD = os.environ.get("ONLYOFFICE_PASSWORD", PASSWORD)
    PORTAL = os.environ.get("ONLYOFFICE_PORTAL_URL", PORTAL).rstrip("/")

    if not USER or not PASSWORD:
        print("Set ONLYOFFICE_USER and ONLYOFFICE_PASSWORD in environment or .env", file=sys.stderr)
        return 1

    status, auth = request(
        "POST",
        "/api/2.0/authentication",
        "",
        {"userName": USER, "password": PASSWORD},
    )
    token = auth.get("response", {}).get("token")
    if not token:
        print("Auth failed:", status, auth)
        return 1

    _, defs = request("GET", "/api/2.0/crm/opportunity/customfield/definitions", token)
    items = defs.get("response") or defs.get("response", [])
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list):
        items = []
    print(f"Definitions: {len(items)} fields")
    sample = next((f for f in items if (f.get("fieldType") or f.get("FieldType")) in (0, "TextField", 0)), items[0] if items else None)
    if not sample:
        print("No custom fields to test")
        return 0
    field_id = sample.get("id") or sample.get("ID")
    label = sample.get("label") or sample.get("Label")
    print(f"Sample field: id={field_id} label={label!r}")

    _, stages = request("GET", "/api/2.0/crm/opportunity/stage", token)
    stage_list = stages.get("response") or []
    stage_id = (stage_list[0] or {}).get("id") if stage_list else 1

    create_body = {
        "contactid": 0,
        "members": [],
        "title": "API custom-field probe",
        "description": "delete me",
        "responsibleid": USER if len(USER) == 36 else str(auth.get("response", {}).get("id", USER)),
        "bidType": 0,
        "bidValue": 0,
        "bidCurrencyAbbr": "USD",
        "perPeriodValue": 1,
        "stageid": stage_id,
        "successProbability": 0,
        "actualCloseDate": None,
        "expectedCloseDate": None,
        "customFieldList": [{"Key": int(field_id), "Value": "probe-create-list"}],
        "isPrivate": False,
        "accessList": [],
        "isNotify": False,
    }
    _, created = request("POST", "/api/2.0/crm/opportunity", token, create_body)
    opp_id = (created.get("response") or {}).get("id")
    print(f"Created opportunity id={opp_id}")

    if not opp_id:
        print("Create response:", json.dumps(created, indent=2)[:800])
        return 1

    import urllib.parse

    test_val = "probe-post-field"
    q = urllib.parse.urlencode({"fieldValue": test_val})
    st, post_res = request("POST", f"/api/2.0/crm/opportunity/{opp_id}/customfield/{field_id}", token, body=None, query=q)
    print(f"POST customfield query-only: status={st}")

    _, fields = request("GET", f"/api/2.0/crm/opportunity/{opp_id}/customfield", token)
    flist = fields.get("response") or []
    print("Stored values:", json.dumps(flist, indent=2)[:1200])
    return 0


if __name__ == "__main__":
    sys.exit(main())