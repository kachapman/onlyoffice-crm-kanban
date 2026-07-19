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
    """Insert stages, return crm_id -> v3 id map."""
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


def _insert_tags(conn, tags: list[dict]) -> dict[str, int]:
    """Import tag definitions."""
    if not tags:
        return {}
    cur = conn.cursor()
    crm_to_v3: dict[str, int] = {}
    for t in tags:
        if not isinstance(t, dict):
            continue
        title = str(t.get("title") or t.get("Title") or t.get("name") or "").strip()
        if not title:
            continue
        cur.execute(
            """INSERT INTO tag_definitions (title, color)
               VALUES (%s, %s)
               ON CONFLICT (title) DO NOTHING
               RETURNING id""",
            (title, "#4f8cff"),
        )
        row = cur.fetchone()
        if row:
            crm_id = str(t.get("id") or t.get("ID") or title)
            crm_to_v3[crm_id] = row[0]
    conn.commit()
    return crm_to_v3


def _insert_users(conn, users: list[dict]) -> dict[str, int]:
    """Import users from export, set external_user_id to original CRM id."""
    if not users:
        return {}
    cur = conn.cursor()
    crm_to_v3: dict[str, int] = {}
    count = 0
    for u in users:
        if not isinstance(u, dict):
            continue
        email = str(u.get("email") or u.get("Email") or "").strip().lower()
        if not email:
            continue
        display_name = str(u.get("displayName") or u.get("DisplayName") or u.get("userName") or "").strip()
        first_name = str(u.get("firstName") or u.get("FirstName") or "").strip()
        last_name = str(u.get("lastName") or u.get("LastName") or "").strip()
        is_admin = bool(u.get("isAdmin") or u.get("IsAdmin"))
        crm_id = str(u.get("id") or u.get("ID") or "")

        cur.execute(
            """INSERT INTO users (email, external_user_id, display_name, first_name, last_name, is_admin, must_change_password)
               VALUES (%s, %s, %s, %s, %s, %s, TRUE)
               ON CONFLICT (email) DO UPDATE SET
                   external_user_id = EXCLUDED.external_user_id,
                   display_name = EXCLUDED.display_name,
                   first_name = EXCLUDED.first_name,
                   last_name = EXCLUDED.last_name,
                   is_admin = EXCLUDED.is_admin
               RETURNING id""",
            (email, crm_id or None, display_name or None, first_name or None, last_name or None, is_admin),
        )
        vid = cur.fetchone()[0]
        if crm_id:
            crm_to_v3[crm_id] = vid
        count += 1
    conn.commit()
    print(f"  users: {count}")
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


def _insert_opportunities(conn, opps: list[dict], stage_map: dict[str, int], contact_map: dict[str, int], user_map: dict[str, int]) -> dict[str, int]:
    """Import opportunities, mapping relations. Returns old_opp_id -> new_id."""
    if not opps:
        return {}
    cur = conn.cursor()
    opp_map: dict[str, int] = {}
    count = 0
    for o in opps:
        if not isinstance(o, dict):
            continue
        crm_id = str(o.get("id") or o.get("ID") or "")
        title = str(o.get("title") or o.get("Title") or "(Untitled)").strip()

        # Stage
        stage_data = o.get("stage") or o.get("Stage") or {}
        stage_crm_id = str(stage_data.get("id") or stage_data.get("ID") or o.get("stageId") or o.get("StageId") or "")
        stage_id = stage_map.get(stage_crm_id)

        # Contact
        contact_data = o.get("contact") or o.get("Contact") or {}
        contact_crm_id = str(contact_data.get("id") or contact_data.get("ID") or "")
        contact_id = contact_map.get(contact_crm_id)

        # Responsible
        resp_data = o.get("responsible") or o.get("Responsible") or {}
        resp_crm_id = str(resp_data.get("id") or resp_data.get("ID") or "")
        responsible_id = user_map.get(resp_crm_id)

        bid_value = None
        for k in ("bidValue", "BidValue", "value", "Value"):
            if k in o and o[k] is not None:
                try:
                    bid_value = float(o[k])
                except:
                    pass
                break

        due = None
        for k in ("expectedCloseDate", "ExpectedCloseDate", "dueDate"):
            if o.get(k):
                due = str(o[k])[:10]
                break

        desc = o.get("description") or o.get("Description") or ""
        if isinstance(desc, str):
            desc = desc.strip() or None

        stage_type = 0
        try:
            st = o.get("stageType") or o.get("StageType") or (stage_data.get("stageType") if isinstance(stage_data, dict) else 0)
            stage_type = int(st) if st is not None else 0
        except:
            pass

        cur.execute(
            """INSERT INTO opportunities (title, description, stage_id, stage_type, bid_value,
                   expected_close_date, contact_id, responsible_user_id, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
               RETURNING id""",
            (title, desc, stage_id, stage_type, bid_value, due, contact_id, responsible_id),
        )
        vid = cur.fetchone()[0]
        if crm_id:
            opp_map[crm_id] = vid
        count += 1
    conn.commit()
    print(f"  opportunities: {count}")
    return opp_map


def _insert_history_basic(conn, history: list[dict], opp_map: dict[str, int], user_map: dict[str, int]) -> int:
    """Basic history import. Looks for content and links to opportunity."""
    if not history:
        return 0
    cur = conn.cursor()
    count = 0
    for h in history:
        if not isinstance(h, dict):
            continue
        opp_data = h.get("opportunity") or h.get("Opportunity") or {}
        opp_crm_id = str(opp_data.get("id") or opp_data.get("ID") or h.get("opportunityId") or "")
        opp_id = opp_map.get(opp_crm_id)
        if not opp_id:
            continue

        content = h.get("content") or h.get("Content") or h.get("note") or str(h)[:200]
        created = h.get("created") or h.get("createOn") or None

        # Try to find a category, default to 1 (Note) if exists
        cat_id = 1
        try:
            cur.execute("SELECT id FROM history_categories LIMIT 1")
            row = cur.fetchone()
            if row:
                cat_id = row[0]
        except:
            pass

        author_id = None
        author_data = h.get("createdBy") or h.get("author") or {}
        if isinstance(author_data, dict):
            a_id = str(author_data.get("id") or author_data.get("ID") or "")
            author_id = user_map.get(a_id)

        cur.execute(
            """INSERT INTO history_events (opportunity_id, category_id, content, created_by, created_at)
               VALUES (%s, %s, %s, %s, COALESCE(%s, NOW()))""",
            (opp_id, cat_id, str(content)[:2000], author_id, created),
        )
        count += 1
    conn.commit()
    print(f"  history events: {count}")
    return count


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
    tags = _load_json(src / "tags.json") or []
    contacts = _load_json(src / "contacts.json") or []
    opps = _load_json(src / "opportunities.json") or []
    tasks = _load_json(src / "tasks.json") or []
    history = _load_json(src / "history.json") or []

    print(f"  users: {len(users)}, stages: {len(stages)}, tags: {len(tags)}, contacts: {len(contacts)}, opps: {len(opps)}")

    if args.dry_run:
        print("Dry run — not writing to DB.")
        return

    conn = _db_conn(args)
    conn.autocommit = False

    try:
        print("Importing users...")
        user_map = _insert_users(conn, users)

        print("Importing stages...")
        stage_map = _insert_stages(conn, stages)
        print(f"  stages: {len(stage_map)}")

        print("Importing tags...")
        _insert_tags(conn, tags)

        print("Importing contacts...")
        contact_map = _insert_contacts(conn, contacts, user_map)
        print(f"  contacts: {len(contact_map)}")

        print("Importing opportunities...")
        opp_map = _insert_opportunities(conn, opps, stage_map, contact_map, user_map)

        print("Importing history events (basic)...")
        _insert_history_basic(conn, history, opp_map, user_map)

        conn.commit()
        print("\nImport complete for core entities.")
    except Exception as exc:
        conn.rollback()
        print(f"Import failed: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
