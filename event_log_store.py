"""Server-side persistence for dashboard event logs (per portal + CRM user).

Entries are retained for 7 days (rolling) with a hard cap of 1,000 entries.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "event-logs"

MAX_ENTRIES = 1000
RETENTION_DAYS = 7


def _safe_segment(value: str, fallback: str = "unknown") -> str:
    seg = re.sub(r"[^\w.-]+", "_", str(value or "").strip())[:120]
    return seg or fallback


def event_log_path(portal: str, user_id: str) -> Path:
    portal_dir = DATA_DIR / _safe_segment(portal, "portal")
    return portal_dir / f"{_safe_segment(user_id, 'user')}.json"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts)
    except ValueError:
        return None


def load_event_log(portal: str, user_id: str) -> list[dict[str, Any]]:
    path = event_log_path(portal, user_id)
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    entries = data.get("events") if isinstance(data, dict) else data
    if not isinstance(entries, list):
        return []
    out = []
    cutoff = _now() - timedelta(days=RETENTION_DAYS)
    for item in entries:
        if not isinstance(item, dict):
            continue
        ts = _parse_ts(item.get("timestamp"))
        if ts is None or ts < cutoff:
            continue
        out.append(item)
    return out


def append_event_log(portal: str, user_id: str, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not entries:
        return load_event_log(portal, user_id)

    path = event_log_path(portal, user_id)
    path.parent.mkdir(parents=True, exist_ok=True)

    existing = load_event_log(portal, user_id)
    now = _now()
    cutoff = now - timedelta(days=RETENTION_DAYS)

    cleaned = []
    for item in entries:
        if not isinstance(item, dict):
            continue
        ts = _parse_ts(item.get("timestamp")) or now
        if ts < cutoff:
            continue
        cleaned.append({
            "id": str(item.get("id") or ""),
            "timestamp": ts.isoformat(),
            "type": str(item.get("type") or ""),
            "oppId": item.get("oppId"),
            "oppTitle": str(item.get("oppTitle") or ""),
            "message": str(item.get("message") or ""),
            "success": bool(item.get("success", True)),
        })

    merged = cleaned + existing
    merged.sort(key=lambda x: _parse_ts(x.get("timestamp")) or now, reverse=True)
    if len(merged) > MAX_ENTRIES:
        merged = merged[:MAX_ENTRIES]

    payload = {"events": merged, "version": 1}
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return merged


def list_users_with_logs(portal: str) -> list[str]:
    portal_dir = DATA_DIR / _safe_segment(portal, "portal")
    if not portal_dir.is_dir():
        return []
    users = []
    for path in portal_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        entries = data.get("events") if isinstance(data, dict) else data
        if isinstance(entries, list) and len(entries) > 0:
            users.append(path.stem)
    users.sort()
    return users
