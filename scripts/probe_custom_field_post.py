#!/usr/bin/env python3
"""Probe the OnlyOffice CRM custom field POST endpoint directly.

Usage:
  python3 scripts/probe_custom_field_post.py <oppId> <fieldId> <fieldValue>

Requires .env with:
  PORTAL_URL=https://your-crm.example.com
  AUTH_TOKEN=your_auth_token_here

Or set env vars directly.
"""

import json
import os
import sys
import urllib.request
import urllib.error

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

PORTAL = os.environ.get("PORTAL_URL") or os.environ.get("ONLYOFFICE_PORTAL_URL")
TOKEN = os.environ.get("AUTH_TOKEN") or os.environ.get("ONLYOFFICE_TOKEN")
if not PORTAL:
    PORTAL = input("PORTAL_URL (e.g. https://crm.example.com): ").strip()
if not TOKEN:
    TOKEN = input("AUTH_TOKEN (from DevTools Application > Cookies > asc_auth_key): ").strip()

def probe(method, url, body=None, headers=None):
    if headers is None:
        headers = {}
    req_headers = {
        "Accept": "application/json",
        "Authorization": TOKEN,
    }
    req_headers.update(headers)
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read(), resp.headers.get_content_type()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), exc.headers.get_content_type() if exc.headers else ""

def try_all(opp_id, field_id, value):
    base = f"{PORTAL}/api/2.0/crm/opportunity/{opp_id}/customfield/{field_id}"
    val_str = str(value)
    qs = f"fieldValue={urllib.request.quote(val_str)}"

    variants = [
        # 1: query string, no body
        ("V1 query string", "POST", f"{base}?{qs}", None, {}),
        # 2: .json suffix + query string
        ("V2 .json+qs", "POST", f"{base}.json?{qs}", None, {}),
        # 3: JSON body {fieldValue}
        ("V3 json {fieldValue}", "POST", base,
         json.dumps({"fieldValue": val_str}).encode("utf-8"),
         {"Content-Type": "application/json"}),
        # 4: form-urlencoded body
        ("V4 form fieldValue", "POST", base,
         f"fieldValue={urllib.request.quote(val_str)}".encode("utf-8"),
         {"Content-Type": "application/x-www-form-urlencoded"}),
        # 5: JSON body {value}
        ("V5 json {value}", "POST", base,
         json.dumps({"value": val_str}).encode("utf-8"),
         {"Content-Type": "application/json"}),
        # 6: JSON body {id, value}
        ("V6 json {id,value}", "POST", base,
         json.dumps({"id": field_id, "value": val_str}).encode("utf-8"),
         {"Content-Type": "application/json"}),
        # 7: raw string body
        ("V7 raw string", "POST", base,
         val_str.encode("utf-8"),
         {"Content-Type": "text/plain"}),
    ]

    results = []
    for name, method, url, body, headers in variants:
        print(f"\n--- {name} ---")
        print(f"  URL: {url[:200]}")
        print(f"  Method: {method}")
        print(f"  Body: {(body or b'<none>')[:200]}")
        print(f"  Headers: {headers}")
        try:
            status, resp_body, ctype = probe(method, url, body=body, headers=headers)
            print(f"  Status: {status}")
            print(f"  Content-Type: {ctype}")
            print(f"  Response: {resp_body[:500]}")
            results.append((name, status, resp_body, True))
        except Exception as e:
            print(f"  ERROR: {e}")
            results.append((name, -1, str(e), False))

    return results

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 scripts/probe_custom_field_post.py <oppId> <fieldId> <fieldValue>")
        print("")
        print("First, get a known opp ID and field ID from the CRM.")
        print("Set PORTAL_URL and AUTH_TOKEN in .env or env vars.")
        sys.exit(1)

    opp_id = sys.argv[1]
    field_id = int(sys.argv[2])
    value = sys.argv[3]

    print(f"Probing CRM: {PORTAL}")
    print(f"Opportunity ID: {opp_id}")
    print(f"Field ID: {field_id}")
    print(f"Field Value: {value!r}")
    print(f"Auth token: {TOKEN[:40]}...")

    try_all(opp_id, field_id, value)
