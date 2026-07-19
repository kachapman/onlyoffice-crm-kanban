#!/usr/bin/env python3
"""Import portable JSON export (produced by migrate_from_onlyoffice.py --export-only) into Sietch CRM PostgreSQL.

Usage:
    python import_json_export.py --source ./crm_export_json --db-host ... 
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 not found. pip install psycopg2-binary")


def _load_json(path: Path) -> Any:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _db_conn(args: argparse.Namespace):
    return psycopg2.connect(
        host=args.db_host,
        port=args.db_port,
        dbname=args.db_name,
        user=args.db_user,
        password=args.db_password,
    )


def _insert_stages(conn, stages: list[dict]) -> dict[str, int]:
    """Insert stages, return crm_id -> v3 id map (using title as key for now)."""
    if not stages:
        return {}
    cur = conn.cursor()
    crm_to_v3: dict[str, int] = {}
    for s in stages:
        if not isinstance(s, dict):
            continue
        title = s.get("title") or s.get("Title") or "Stage"
        color = s.get("color") or "#4f8cff"
        sort = s.get("sortOrder") or s.get("sort_order") or 0
        stype = s.get("stageType") or s.get("stage_type") or 0
        prob = s.get("probability") or 0
        cur.execute(
            """INSERT INTO stages (title, color, sort_order, stage_type, probability)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (title) DO UPDATE SET color=EXCLUDED.color
               RETURNING id""",
            (title, color, sort, stype, prob),
        )
        vid = cur.fetchone()[0]
        crm_id = str(s.get("id") or s.get("ID") or title)
        crm_to_v3[crm_id] = vid
    conn.commit()
    return crm_to_v3


def _insert_contacts(conn, contacts: list[dict], user_map: dict) -> dict[str, int]:
    """Basic contact import. Returns crm_id -> v3 id."""
    if not contacts:
        return {}
    cur = conn.cursor()
    crm_to_v3: dict[str, int] = {}
    for c in contacts:
        if not isinstance(c, dict):
            continue
        crm_id = str(c.get("id") or c.get("ID") or "")
        name = c.get("displayName") or c.get("title") or "Contact"
        email = c.get("email") or ""
        # Minimal insert
        cur.execute(
            """INSERT INTO contacts (display_name, email, created_at)
               VALUES (%s, %s, NOW())
               ON CONFLICT (email) DO NOTHING
               RETURNING id""",
            (name, email or None),
        )
        row = cur.fetchone()
        if row:
            vid = row[0]
            if crm_id:
                crm_to_v3[crm_id] = vid
    conn.commit()
    return crm_to_v3


def main():
    parser = argparse.ArgumentParser(description="Import JSON export from OnlyOffice into Sietch CRM")
    parser.add_argument("--source", required=True, help="Path to directory containing users.json, opportunities.json, ...")
    parser.add_argument("--db-host", default=os.getenv("DB_HOST", "localhost"))
    parser.add_argument("--db-port", default=os.getenv("DB_PORT", "5432"))
    parser.add_argument("--db-name", default=os.getenv("DB_NAME", "sietch_crm"))
    parser.add_argument("--db-user", default=os.getenv("DB_USER", "sietch"))
    parser.add_argument("--db-password", default=os.getenv("DB_PASSWORD", ""))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    src = Path(args.source)
    if not src.is_dir():
        sys.exit(f"Source dir not found: {src}")

    print(f"Loading export from {src}...")

    users = _load_json(src / "users.json") or []
    stages = _load_json(src / "stages.json") or []
    contacts = _load_json(src / "contacts.json") or []
    opps = _load_json(src / "opportunities.json") or []
    tasks = _load_json(src / "tasks.json") or []
    history = _load_json(src / "history.json") or []

    print(f"  users: {len(users)}, stages: {len(stages)}, contacts: {len(contacts)}, opps: {len(opps)}")

    if args.dry_run:
        print("Dry run — not writing to DB.")
        return

    conn = _db_conn(args)
    conn.autocommit = False

    try:
        print("Importing stages...")
        stage_map = _insert_stages(conn, stages)
        print(f"  stages: {len(stage_map)}")

        print("Importing contacts (basic)...")
        contact_map = _insert_contacts(conn, contacts, {})
        print(f"  contacts: {len(contact_map)}")

        # TODO: full opportunity, history, task, tag, user remapping import
        # For Phase 2 initial: the export files are the portable artifact.
        # Full importer can be expanded similarly to import_csv_export.py

        conn.commit()
        print("\nImport skeleton complete (expand for full entities).")
    except Exception as exc:
        conn.rollback()
        print(f"Import failed: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
