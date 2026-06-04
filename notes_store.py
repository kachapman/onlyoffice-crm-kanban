"""Server-side persistence for dashboard notes tiles (per portal + CRM user)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "dashboard-notes"


def _safe_segment(value: str, fallback: str = "unknown") -> str:
    seg = re.sub(r"[^\w.-]+", "_", str(value or "").strip())[:120]
    return seg or fallback


def notes_file_path(portal: str, user_id: str) -> Path:
    portal_dir = DATA_DIR / _safe_segment(portal, "portal")
    return portal_dir / f"{_safe_segment(user_id, 'user')}.json"


def load_notes_tiles(portal: str, user_id: str) -> list[dict[str, Any]]:
    path = notes_file_path(portal, user_id)
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    tiles = data.get("tiles") if isinstance(data, dict) else data
    if not isinstance(tiles, list):
        return []
    out = []
    for item in tiles:
        if isinstance(item, dict) and item.get("id"):
            out.append(item)
    return out


def save_notes_tiles(portal: str, user_id: str, tiles: list[dict[str, Any]]) -> None:
    path = notes_file_path(portal, user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    cleaned = []
    for item in tiles:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        updated_at = str(item.get("updatedAt") or "").strip()
        if not updated_at:
            updated_at = datetime.now(timezone.utc).isoformat()
        cleaned.append(
            {
                "id": str(item["id"]),
                "name": str(item.get("name") or "Notes")[:200],
                "content": str(item.get("content") or ""),
                "viewMode": "preview" if item.get("viewMode") == "preview" else "edit",
                "updatedAt": updated_at,
            }
        )
    payload = {"tiles": cleaned, "version": 1}
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")