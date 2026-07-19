#!/usr/bin/env python3
"""Migrate dashboard-local JSON files (profiles, notes, presence, DMs, event logs) from old
OnlyOffice/CRM user IDs to the new PostgreSQL user IDs.

Run this on the new server after the CRM migration has populated the users table with
external_user_id values. The script reads from a source data directory (usually a copy of
the old dashboard's `data/` folder) and writes into the current project's `data/` directory.

Example:
    rsync -avz old-server:/path/to/new-crm/data/ /tmp/old-crm-data/
    python3 migrate_dashboard_data.py --source /tmp/old-crm-data --portal vanguard
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 not found. Install with: pip install psycopg2-binary")


# ── Configuration ──────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent
TARGET_DATA_DIR = ROOT / "data"


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _db_conn(args: argparse.Namespace) -> Any:
    return psycopg2.connect(
        host=args.db_host,
        port=args.db_port,
        dbname=args.db_name,
        user=args.db_user,
        password=args.db_password,
    )


def _load_user_maps(conn: Any) -> tuple[dict[str, int], dict[str, int]]:
    """Return (external_user_id -> id, email -> id)."""
    cur = conn.cursor()
    cur.execute("SELECT id, email, external_user_id FROM users")
    by_external: dict[str, int] = {}
    by_email: dict[str, int] = {}
    for row in cur.fetchall():
        user_id, email, external = row
        if external:
            by_external[str(external).strip()] = user_id
        if email:
            by_email[str(email).strip().lower()] = user_id
    cur.close()
    return by_external, by_email


# ── File helpers ─────────────────────────────────────────────────────────────────

def _safe_segment(value: str, fallback: str = "unknown") -> str:
    seg = re.sub(r"[^\w.-]+", "_", str(value or "").strip())[:120]
    return seg or fallback


def _load_json(path: Path) -> Any:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _resolve_user_id(raw: str, by_external: dict[str, int], by_email: dict[str, int]) -> int | None:
    raw = str(raw or "").strip()
    if not raw:
        return None
    # Direct external_user_id match
    if raw in by_external:
        return by_external[raw]
    # Normalized external_user_id
    normalized = _safe_segment(raw)
    if normalized in by_external:
        return by_external[normalized]
    # Email match
    email_key = raw.lower()
    if email_key in by_email:
        return by_email[email_key]
    # If the file name was already sanitized from an email, try to reconstruct it
    if "_" in normalized and "@" not in normalized:
        # Try replacing the last underscore with @ for common email sanitization
        reconstructed = normalized.replace("_", "@", 1)
        if reconstructed.lower() in by_email:
            return by_email[reconstructed.lower()]
    return None


# ── Migration routines ──────────────────────────────────────────────────────────

def _migrate_simple_files(source_dir: Path, target_dir: Path, subdir: str, portal: str,
                          by_external: dict[str, int], by_email: dict[str, int], dry_run: bool) -> int:
    """Migrate files of the form <portal>/<user_id>.json in subdir."""
    src = source_dir / subdir / _safe_segment(portal, "portal")
    dst = target_dir / subdir / _safe_segment(portal, "portal")
    count = 0
    if not src.is_dir():
        print(f"  [skip] {subdir}: source directory not found: {src}")
        return 0
    for old_path in src.iterdir():
        if not old_path.is_file() or not old_path.suffix == ".json":
            continue
        old_name = old_path.stem
        new_id = _resolve_user_id(old_name, by_external, by_email)
        if new_id is None:
            print(f"  [warn] {subdir}: no user mapping for {old_name}, skipping")
            continue
        new_path = dst / f"{new_id}.json"
        if not dry_run:
            _save_json(new_path, _load_json(old_path))
        print(f"  {subdir}: {old_name} -> {new_id}")
        count += 1
    return count


def _migrate_presence_messages(source_dir: Path, target_dir: Path, portal: str,
                               by_external: dict[str, int], by_email: dict[str, int], dry_run: bool) -> int:
    """Migrate conversation files <a>__<b>.json, mapping both participants."""
    subdir = "presence-messages"
    src = source_dir / subdir / _safe_segment(portal, "portal")
    dst = target_dir / subdir / _safe_segment(portal, "portal")
    count = 0
    if not src.is_dir():
        print(f"  [skip] {subdir}: source directory not found: {src}")
        return 0
    for old_path in src.iterdir():
        if not old_path.is_file() or not old_path.suffix == ".json":
            continue
        name = old_path.stem
        parts = name.split("__", 1)
        if len(parts) != 2:
            print(f"  [warn] {subdir}: unexpected filename {old_path.name}, skipping")
            continue
        a, b = parts
        new_a = _resolve_user_id(a, by_external, by_email)
        new_b = _resolve_user_id(b, by_external, by_email)
        if new_a is None or new_b is None:
            print(f"  [warn] {subdir}: cannot map both participants in {old_path.name}, skipping")
            continue
        # Canonical key (sorted) to match presence_store.py behavior
        key_a, key_b = (new_a, new_b) if str(new_a) <= str(new_b) else (new_b, new_a)
        new_path = dst / f"{key_a}__{key_b}.json"
        if not dry_run:
            _save_json(new_path, _load_json(old_path))
        print(f"  {subdir}: {name} -> {key_a}__{key_b}")
        count += 1
    return count


def _migrate_bot_customers(source_dir: Path, target_dir: Path, portal: str,
                           by_external: dict[str, int], by_email: dict[str, int], dry_run: bool) -> int:
    """Update userId fields in bot-customers/store.json mappings."""
    subdir = "bot-customers"
    src = source_dir / subdir / _safe_segment(portal, "portal") / "store.json"
    dst = target_dir / subdir / _safe_segment(portal, "portal") / "store.json"
    if not src.is_file():
        print(f"  [skip] {subdir}: source file not found: {src}")
        return 0
    data = _load_json(src)
    if data is None:
        print(f"  [warn] {subdir}: could not read {src}")
        return 0
    mappings = data.get("mappings", []) if isinstance(data, dict) else []
    count = 0
    for m in mappings:
        if not isinstance(m, dict):
            continue
        old_user_id = m.get("userId")
        if old_user_id is None:
            continue
        new_id = _resolve_user_id(str(old_user_id), by_external, by_email)
        if new_id is None:
            print(f"  [warn] bot-customers: no mapping for userId {old_user_id}")
            continue
        m["userId"] = new_id
        count += 1
    if not dry_run:
        _save_json(dst, data)
    print(f"  bot-customers: updated {count} mappings")
    return count


# ── Main ─────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Migrate dashboard-local JSON files to new user IDs")
    parser.add_argument("--source", required=True, help="Path to old dashboard data/ directory")
    parser.add_argument("--portal", default="vanguard", help="Portal string used in old filenames")
    parser.add_argument("--db-host", default=os.getenv("DB_HOST", "localhost"))
    parser.add_argument("--db-port", default=os.getenv("DB_PORT", "5432"))
    parser.add_argument("--db-name", default=os.getenv("DB_NAME", "sietch_crm"))
    parser.add_argument("--db-user", default=os.getenv("DB_USER", "sietch"))
    parser.add_argument("--db-password", default=os.getenv("DB_PASSWORD", ""))
    parser.add_argument("--dry-run", action="store_true", help="Print planned changes without writing files")
    args = parser.parse_args()

    source_dir = Path(args.source).resolve()
    if not source_dir.is_dir():
        sys.exit(f"Source directory not found: {source_dir}")

    print(f"Connecting to PostgreSQL at {args.db_host}:{args.db_port}/{args.db_name}...")
    conn = _db_conn(args)
    by_external, by_email = _load_user_maps(conn)
    conn.close()
    print(f"Loaded {len(by_external)} external-user mappings and {len(by_email)} email mappings.")

    if not by_external and not by_email:
        sys.exit("No user mappings found. Run the CRM migration first so users.external_user_id is populated.")

    target_dir = TARGET_DATA_DIR
    print(f"\nMigrating from {source_dir} to {target_dir}")
    if args.dry_run:
        print("DRY RUN: no files will be written\n")

    total = 0
    total += _migrate_simple_files(source_dir, target_dir, "user-profiles", args.portal, by_external, by_email, args.dry_run)
    total += _migrate_simple_files(source_dir, target_dir, "dashboard-notes", args.portal, by_external, by_email, args.dry_run)
    total += _migrate_simple_files(source_dir, target_dir, "user-presence", args.portal, by_external, by_email, args.dry_run)
    total += _migrate_simple_files(source_dir, target_dir, "event-logs", args.portal, by_external, by_email, args.dry_run)
    total += _migrate_presence_messages(source_dir, target_dir, args.portal, by_external, by_email, args.dry_run)
    total += _migrate_bot_customers(source_dir, target_dir, args.portal, by_external, by_email, args.dry_run)

    print(f"\nDone. Migrated {total} file(s)/mapping(s).")


if __name__ == "__main__":
    main()
