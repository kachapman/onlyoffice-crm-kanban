"""Per-user dashboard profiles (portal + CRM user id)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "user-profiles"
LEGACY_NOTES_DIR = ROOT / "data" / "dashboard-notes"
PROFILE_VERSION = 2


def _safe_segment(value: str, fallback: str = "unknown") -> str:
    seg = re.sub(r"[^\w.-]+", "_", str(value or "").strip())[:120]
    return seg or fallback


def profile_file_path(portal: str, user_id: str) -> Path:
    portal_dir = DATA_DIR / _safe_segment(portal, "portal")
    return portal_dir / f"{_safe_segment(user_id, 'user')}.json"


def _empty_profile() -> dict[str, Any]:
    return {
        "version": PROFILE_VERSION,
        "updatedAt": "",
        "groups": [],
        "tileLayout": {"order": [], "widths": {}, "heights": {}, "collapsed": {}},
        "calendarTiles": [],
        "notesTiles": [],
        "groupTemplates": [],
        "hiddenFeedKeys": [],
        "feedKeywordFilter": "",
    }


def _clean_notes_tiles(tiles: Any) -> list[dict[str, Any]]:
    if not isinstance(tiles, list):
        return []
    out = []
    for item in tiles:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        updated_at = str(item.get("updatedAt") or "").strip()
        if not updated_at:
            updated_at = datetime.now(timezone.utc).isoformat()
        out.append(
            {
                "id": str(item["id"]),
                "name": str(item.get("name") or "Notes")[:200],
                "content": str(item.get("content") or ""),
                "viewMode": "preview" if item.get("viewMode") == "preview" else "edit",
                "updatedAt": updated_at,
            }
        )
    return out


def _clean_calendar_tiles(tiles: Any) -> list[dict[str, Any]]:
    if not isinstance(tiles, list):
        return []
    out = []
    for item in tiles:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        out.append(
            {
                "id": str(item["id"]),
                "name": str(item.get("name") or "Calendar")[:200],
                "feedUrl": str(item.get("feedUrl") or "")[:4000],
                "timezone": str(item.get("timezone") or "")[:80],
                "viewYear": int(item.get("viewYear") or 0) or None,
                "viewMonth": int(item.get("viewMonth") or 0) or None,
            }
        )
        if out[-1]["viewYear"] is None:
            del out[-1]["viewYear"]
        if out[-1]["viewMonth"] is None:
            del out[-1]["viewMonth"]
    return out


def _clean_groups(groups: Any) -> list[dict[str, Any]]:
    if not isinstance(groups, list):
        return []
    out = []
    for g in groups:
        if not isinstance(g, dict) or not g.get("id"):
            continue
        row = {k: v for k, v in g.items() if k not in ("opportunities", "_el", "_setFiltersCollapsed")}
        row["id"] = str(row["id"])
        out.append(row)
    return out


def _migrate_legacy_notes(portal: str, user_id: str, profile: dict[str, Any]) -> dict[str, Any]:
    if profile.get("notesTiles"):
        return profile
    legacy_path = LEGACY_NOTES_DIR / _safe_segment(portal, "portal") / f"{_safe_segment(user_id, 'user')}.json"
    if not legacy_path.is_file():
        return profile
    try:
        data = json.loads(legacy_path.read_text(encoding="utf-8"))
        tiles = data.get("tiles") if isinstance(data, dict) else []
        if isinstance(tiles, list) and tiles:
            profile["notesTiles"] = _clean_notes_tiles(tiles)
    except (json.JSONDecodeError, OSError):
        pass
    return profile


def load_user_profile(portal: str, user_id: str) -> dict[str, Any]:
    path = profile_file_path(portal, user_id)
    if not path.is_file():
        profile = _empty_profile()
        return _migrate_legacy_notes(portal, user_id, profile)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _migrate_legacy_notes(portal, user_id, _empty_profile())
    if not isinstance(data, dict):
        return _empty_profile()
    profile = _empty_profile()
    profile["groups"] = _clean_groups(data.get("groups"))
    layout = data.get("tileLayout")
    if isinstance(layout, dict):
        profile["tileLayout"] = {
            "order": list(layout.get("order") or []),
            "widths": dict(layout.get("widths") or {}),
            "heights": dict(layout.get("heights") or {}),
            "collapsed": dict(layout.get("collapsed") or {}),
        }
    profile["calendarTiles"] = _clean_calendar_tiles(data.get("calendarTiles"))
    profile["notesTiles"] = _clean_notes_tiles(data.get("notesTiles"))
    templates = data.get("groupTemplates")
    profile["groupTemplates"] = templates if isinstance(templates, list) else []
    hidden = data.get("hiddenFeedKeys")
    profile["hiddenFeedKeys"] = [str(k) for k in hidden] if isinstance(hidden, list) else []
    profile["feedKeywordFilter"] = str(data.get("feedKeywordFilter") or "")[:500]
    profile["updatedAt"] = str(data.get("updatedAt") or "")
    return _migrate_legacy_notes(portal, user_id, profile)


def save_user_profile(portal: str, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    path = profile_file_path(portal, user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    updated_at = str(payload.get("updatedAt") or "").strip()
    if not updated_at:
        updated_at = datetime.now(timezone.utc).isoformat()
    cleaned = {
        "version": PROFILE_VERSION,
        "updatedAt": updated_at,
        "groups": _clean_groups(payload.get("groups")),
        "tileLayout": payload.get("tileLayout")
        if isinstance(payload.get("tileLayout"), dict)
        else _empty_profile()["tileLayout"],
        "calendarTiles": _clean_calendar_tiles(payload.get("calendarTiles")),
        "notesTiles": _clean_notes_tiles(payload.get("notesTiles")),
        "groupTemplates": payload.get("groupTemplates")
        if isinstance(payload.get("groupTemplates"), list)
        else [],
        "hiddenFeedKeys": payload.get("hiddenFeedKeys")
        if isinstance(payload.get("hiddenFeedKeys"), list)
        else [],
        "feedKeywordFilter": str(payload.get("feedKeywordFilter") or "")[:500],
    }
    path.write_text(json.dumps(cleaned, indent=2), encoding="utf-8")
    return cleaned