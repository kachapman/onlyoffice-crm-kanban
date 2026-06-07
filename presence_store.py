"""Per-user (and cross-user) presence / status / basic DMs for the dashboard (portal + CRM user id).

Modeled closely after user_profile_store.py for consistency (safe segmenting, per-portal dirs,
load/save, version, retention where applicable).
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "user-presence"
MESSAGES_DIR = ROOT / "data" / "presence-messages"
PRESENCE_VERSION = 1

# Modest cap for DM history per conversation in v1 (keeps files small; we return the most recent N)
DM_HISTORY_LIMIT = 100


def _safe_segment(value: str, fallback: str = "unknown") -> str:
    seg = re.sub(r"[^\w.-]+", "_", str(value or "").strip())[:120]
    return seg or fallback


def presence_file_path(portal: str, user_id: str) -> Path:
    portal_dir = DATA_DIR / _safe_segment(portal, "portal")
    return portal_dir / f"{_safe_segment(user_id, 'user')}.json"


def _conversation_key(a: str, b: str) -> str:
    """Canonical key for a conversation between two users (sorted)."""
    a = _safe_segment(str(a or ""), "u")
    b = _safe_segment(str(b or ""), "u")
    if a > b:
        a, b = b, a
    return f"{a}__{b}"


def conversation_file_path(portal: str, user_a: str, user_b: str) -> Path:
    key = _conversation_key(user_a, user_b)
    portal_dir = MESSAGES_DIR / _safe_segment(portal, "portal")
    return portal_dir / f"{key}.json"


def _empty_presence() -> dict[str, Any]:
    return {
        "version": PRESENCE_VERSION,
        "updatedAt": "",
        "status": "",  # template string or custom text (shown next to name)
        "lastHeartbeat": "",  # last client heartbeat (for online / idle calc)
        "lastCrmActivity": "",  # last time a CRM-ish request was proxied for this user
        "lastDashboardActivity": "",  # last explicit dashboard activity / heartbeat
    }


def _parse_iso_datetime(value: str) -> datetime | None:
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
    except ValueError:
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_user_presence(portal: str, user_id: str) -> dict[str, Any]:
    path = presence_file_path(portal, user_id)
    if not path.is_file():
        return _empty_presence()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _empty_presence()
    if not isinstance(data, dict):
        return _empty_presence()

    presence = _empty_presence()
    presence["status"] = str(data.get("status") or "")[:200]  # modest cap for display
    presence["lastHeartbeat"] = str(data.get("lastHeartbeat") or "")[:80]
    presence["lastCrmActivity"] = str(data.get("lastCrmActivity") or "")[:80]
    presence["lastDashboardActivity"] = str(data.get("lastDashboardActivity") or "")[:80]
    presence["updatedAt"] = str(data.get("updatedAt") or "")
    return presence


def save_user_presence(portal: str, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    path = presence_file_path(portal, user_id)
    path.parent.mkdir(parents=True, exist_ok=True)

    updated_at = str(payload.get("updatedAt") or "").strip()
    if not updated_at:
        updated_at = _now_iso()

    cleaned = {
        "version": PRESENCE_VERSION,
        "updatedAt": updated_at,
        "status": str(payload.get("status") or "")[:200],
        "lastHeartbeat": str(payload.get("lastHeartbeat") or "")[:80],
        "lastCrmActivity": str(payload.get("lastCrmActivity") or "")[:80],
        "lastDashboardActivity": str(payload.get("lastDashboardActivity") or "")[:80],
    }
    path.write_text(json.dumps(cleaned, indent=2), encoding="utf-8")
    return cleaned


def touch_heartbeat(portal: str, user_id: str) -> dict[str, Any]:
    """Update lastHeartbeat (and lastDashboardActivity) for the user. Called on client heartbeats/activity."""
    existing = load_user_presence(portal, user_id)
    now = _now_iso()
    existing["lastHeartbeat"] = now
    existing["lastDashboardActivity"] = now
    return save_user_presence(portal, user_id, existing)


def touch_crm_activity(portal: str, user_id: str) -> dict[str, Any]:
    """Record that this user performed a CRM action (via the dashboard proxy)."""
    existing = load_user_presence(portal, user_id)
    now = _now_iso()
    existing["lastCrmActivity"] = now
    # Also bump dashboard activity since the action came through the dashboard
    existing["lastDashboardActivity"] = now
    return save_user_presence(portal, user_id, existing)


def set_status(portal: str, user_id: str, status: str) -> dict[str, Any]:
    """Set the user's current status string (template or custom)."""
    existing = load_user_presence(portal, user_id)
    existing["status"] = str(status or "")[:200]
    existing["updatedAt"] = _now_iso()
    return save_user_presence(portal, user_id, existing)


def get_portal_presence_snapshot(portal: str) -> dict[str, dict[str, Any]]:
    """Return {user_id: presence_dict, ...} for all known presence records under this portal.
    Used by the /api/presence endpoint to build the live overlay.
    Scans the per-portal directory (small number of users).
    """
    portal_dir = DATA_DIR / _safe_segment(portal, "portal")
    result: dict[str, dict[str, Any]] = {}
    if not portal_dir.is_dir():
        return result
    for p in portal_dir.glob("*.json"):
        try:
            uid = p.stem  # the safe_segment(user) part; caller maps back if needed
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                # Return a clean view (no secrets)
                result[uid] = {
                    "status": str(data.get("status") or "")[:200],
                    "lastHeartbeat": str(data.get("lastHeartbeat") or "")[:80],
                    "lastCrmActivity": str(data.get("lastCrmActivity") or "")[:80],
                    "lastDashboardActivity": str(data.get("lastDashboardActivity") or "")[:80],
                    "updatedAt": str(data.get("updatedAt") or ""),
                }
        except (json.JSONDecodeError, OSError):
            continue
    return result


# ---------------- DM / conversation helpers (simple append-only for v1) ----------------

def _load_conversation(path: Path, limit: int = DM_HISTORY_LIMIT) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        msgs = data.get("messages") if isinstance(data, dict) else []
        if not isinstance(msgs, list):
            return []
        # Return the most recent N
        return msgs[-limit:]
    except (json.JSONDecodeError, OSError):
        return []


def _save_conversation(path: Path, messages: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Keep only the last DM_HISTORY_LIMIT to bound growth
    trimmed = messages[-DM_HISTORY_LIMIT:]
    payload = {"version": PRESENCE_VERSION, "messages": trimmed}
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def append_dm(portal: str, from_id: str, to_id: str, text: str, reply_to: str = None, reply_text: str = None) -> dict[str, Any]:
    """Append a message to the conversation between from_id and to_id.
    Optional reply_to is the ts of the message being replied to.
    reply_text is an embedded snippet of the replied-to message (for self-contained quotes).
    Returns the saved message record.
    """
    if not from_id or not to_id or from_id == to_id:
        return {}
    path = conversation_file_path(portal, from_id, to_id)
    msgs = _load_conversation(path)

    # Robustness for reply context: if only a reply_to (ts pointer) was provided
    # (e.g. older clients or direct calls), resolve the text snippet right now
    # while the original message is still in the loaded recent list. This ensures
    # the stored record for the reply message *always* carries an embedded
    # reply_text, so the history renderer can show the quoted context reliably
    # even after history is trimmed or on later re-opens (including for sent
    # messages in the bubbles). Client-provided reply_text is preferred.
    if reply_to and not reply_text:
        for cand in reversed(msgs):
            if cand and str(cand.get("ts")) == str(reply_to):
                reply_text = str(cand.get("text") or "")[:100]
                break

    msg = {
        "from": str(from_id),
        "to": str(to_id),
        "text": str(text or "")[:2000],  # modest per-message cap
        "ts": _now_iso(),
        "reply_to": reply_to,
        "reply_text": reply_text,
        "read": False,
        "read_at": None,
    }
    msgs.append(msg)
    _save_conversation(path, msgs)
    return msg


def get_conversation(portal: str, user_a: str, user_b: str, limit: int = DM_HISTORY_LIMIT) -> list[dict[str, Any]]:
    """Return the most recent messages between user_a and user_b (chronological)."""
    if not user_a or not user_b:
        return []
    path = conversation_file_path(portal, user_a, user_b)
    return _load_conversation(path, limit)


def get_recent_dms_for_user(portal: str, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Best-effort: scan recent conversations involving this user and return the latest messages.
    For v1 this is a simple scan of the messages dir (fine for small teams).
    Returns messages newest-first limited to `limit`.
    """
    portal_dir = MESSAGES_DIR / _safe_segment(portal, "portal")
    if not portal_dir.is_dir():
        return []
    all_msgs: list[dict[str, Any]] = []
    uid = str(user_id)
    for p in portal_dir.glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            msgs = data.get("messages") if isinstance(data, dict) else []
            if isinstance(msgs, list):
                for m in msgs:
                    if isinstance(m, dict) and (m.get("from") == uid or m.get("to") == uid):
                        all_msgs.append(m)
        except (json.JSONDecodeError, OSError):
            continue
    # Sort by ts desc, take top N
    all_msgs.sort(key=lambda m: str(m.get("ts") or ""), reverse=True)
    return all_msgs[:limit]


def clear_conversation(portal: str, user_a: str, user_b: str) -> None:
    """Delete the persisted conversation history between the two users (both directions use same file)."""
    if not user_a or not user_b:
        return
    path = conversation_file_path(portal, user_a, user_b)
    try:
        if path.is_file():
            path.unlink()
    except OSError:
        pass


def mark_messages_read(portal: str, reader_id: str, other_id: str) -> None:
    """Mark all incoming messages (from other_id) as read for the reader.
    Persists the change so the sender can see read receipts.
    """
    if not reader_id or not other_id:
        return
    path = conversation_file_path(portal, reader_id, other_id)
    msgs = _load_conversation(path)
    modified = False
    for m in msgs:
        if isinstance(m, dict) and str(m.get("from")) == str(other_id) and not m.get("read"):
            m["read"] = True
            m["read_at"] = _now_iso()
            modified = True
    if modified:
        _save_conversation(path, msgs)