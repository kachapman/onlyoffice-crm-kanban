"""Per-user notification cache backed by CRM Mail API.

Stores parsed CRM notification emails for 30 days, capped at 500 per user.
Background fetcher populates cache; HTTP endpoints serve it instantly.

Path layout: data/notifications/<portal>/<user_id>.json
"""

from __future__ import annotations

import json
import re
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "notifications"
NOTIFICATION_VERSION = 1
NOTIFICATION_RETENTION_DAYS = 30
NOTIFICATION_CAP = 500

# Per-user locks prevent concurrent background fetches.
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _safe_segment(value: str, fallback: str = "unknown") -> str:
    seg = re.sub(r"[^\w.-]+", "_", str(value or "").strip())[:120]
    return seg or fallback


def _user_lock(portal: str, user_id: str) -> threading.Lock:
    key = f"{_safe_segment(portal)}::{_safe_segment(user_id)}"
    with _locks_guard:
        if key not in _locks:
            _locks[key] = threading.Lock()
        return _locks[key]


def notification_file_path(portal: str, user_id: str) -> Path:
    portal_dir = DATA_DIR / _safe_segment(portal, "portal")
    return portal_dir / f"{_safe_segment(user_id, 'user')}.json"


def _empty_cache() -> dict[str, Any]:
    return {
        "version": NOTIFICATION_VERSION,
        "updatedAt": "",
        "lastFetchAt": "",
        "lastSuccessfulFetchAt": "",
        "isFetching": False,
        "events": [],
        "fetchError": None,
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_notifications(portal: str, user_id: str) -> dict[str, Any]:
    """Load the user's notification cache from disk."""
    path = notification_file_path(portal, user_id)
    if not path.exists():
        return _empty_cache()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return _empty_cache()
        data.setdefault("version", NOTIFICATION_VERSION)
        data.setdefault("updatedAt", "")
        data.setdefault("lastFetchAt", "")
        data.setdefault("lastSuccessfulFetchAt", "")
        data.setdefault("isFetching", False)
        data.setdefault("events", [])
        data.setdefault("fetchError", None)
        return data
    except (json.JSONDecodeError, OSError):
        return _empty_cache()


def save_notifications(portal: str, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Atomically persist the notification cache."""
    path = notification_file_path(portal, user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    data["version"] = NOTIFICATION_VERSION
    data["updatedAt"] = _now_iso()
    fd = None
    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        fd = None  # closed by os.fdopen
        Path(tmp_path).rename(path)
        tmp_path = None
    finally:
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                pass
        if tmp_path is not None:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except OSError:
                pass
    return data


import os  # noqa: E402 — used by save_notifications tempfile


def prune_old_events(data: dict[str, Any]) -> dict[str, Any]:
    """Remove events older than NOTIFICATION_RETENTION_DAYS."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=NOTIFICATION_RETENTION_DAYS)
    cutoff_iso = cutoff.isoformat()
    events = data.get("events") or []
    data["events"] = [e for e in events if (e.get("date") or "") >= cutoff_iso]
    return data


def cap_events(data: dict[str, Any]) -> dict[str, Any]:
    """Keep at most NOTIFICATION_CAP events (newest first)."""
    events = data.get("events") or []
    if len(events) > NOTIFICATION_CAP:
        data["events"] = events[:NOTIFICATION_CAP]
    return data


def dedupe_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate events by (opportunityId, date, author, text_prefix)."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for e in events:
        key = "|".join([
            str(e.get("id") or e.get("opportunityId") or ""),
            str(e.get("date") or ""),
            str(e.get("author") or ""),
            str(e.get("text") or "")[:80],
        ])
        if key not in seen:
            seen.add(key)
            out.append(e)
    return out


def merge_events(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge incoming events with existing, dedupe, sort newest-first, prune+cap."""
    combined = dedupe_events(incoming + existing)
    # Sort by date descending (newest first)
    combined.sort(key=lambda e: e.get("date") or "", reverse=True)
    return combined


def acquire_fetch_lock(portal: str, user_id: str) -> bool:
    """Try to acquire the per-user fetch lock (non-blocking).

    Returns True if lock was acquired (caller should release it later).
    """
    lock = _user_lock(portal, user_id)
    return lock.acquire(blocking=False)


def release_fetch_lock(portal: str, user_id: str) -> None:
    """Release the per-user fetch lock."""
    lock = _user_lock(portal, user_id)
    try:
        lock.release()
    except RuntimeError:
        pass


def mark_fetch_start(portal: str, user_id: str) -> dict[str, Any]:
    """Mark the cache as currently being fetched."""
    data = load_notifications(portal, user_id)
    data["isFetching"] = True
    data["fetchError"] = None
    return save_notifications(portal, user_id, data)


def mark_fetch_complete(portal: str, user_id: str, error: str | None = None) -> dict[str, Any]:
    """Mark the fetch as complete (with or without error)."""
    data = load_notifications(portal, user_id)
    data["isFetching"] = False
    data["lastFetchAt"] = _now_iso()
    if error:
        data["fetchError"] = error
    else:
        data["lastSuccessfulFetchAt"] = _now_iso()
        data["fetchError"] = None
    return save_notifications(portal, user_id, data)


def mark_cache_stale(portal: str, user_id: str) -> None:
    """Force the cache to appear stale so the next read triggers a refresh."""
    data = load_notifications(portal, user_id)
    data["lastFetchAt"] = ""
    save_notifications(portal, user_id, data)
