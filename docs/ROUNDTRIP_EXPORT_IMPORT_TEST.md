# Round-Trip Export / Import Test (Phase 2)

Goal: Export live OnlyOffice CRM data via bot API → transfer portable JSON → import into new Sietch Postgres → verify → optionally remap old dashboard JSON data.

This is the safe, portable path (Option A) before full cutover + hourly sync.

## Prerequisites
- Bot credentials that work: `bot@vanguardadj.com` / `FRi3tz4yWXrMTEZ` (confirmed to generate token against https://office.publicadjustermidwest.com)
- Network access from the export machine to the OnlyOffice portal (HTTPS).
- On the import machine: Python 3 + psycopg2-binary (`pip install psycopg2-binary`), and network access to the target Postgres (usually `127.0.0.1:5432` when port is exposed for migration).
- The new-crm branch checked out (or at least the two scripts).
- Target Postgres DB has the schema from `init.sql` applied.
- (Optional but recommended) A clean test DB or snapshot so you can repeat the test.

## 1. Get the scripts onto the machines

### Recommended: git (keeps everything in sync)
On **both** the export host and the import host:

```bash
cd ~
git clone git@github.com:kachapman/onlyoffice-crm-kanban.git sietch-migration || true
cd sietch-migration
git fetch origin
git checkout new-crm
git pull origin new-crm
```

If you only want the scripts, you can also just scp them:

```bash
# from your laptop
scp migrate_from_onlyoffice.py import_json_export.py migrate_dashboard_data.py user@export-host:/opt/sietch/
scp migrate_from_onlyoffice.py import_json_export.py migrate_dashboard_data.py user@import-host:/opt/sietch/
```

On the target hosts, make sure Python can find psycopg2 for the import side:

```bash
pip3 install psycopg2-binary
# or inside the venv / container if that's how you run the new CRM
```

## 2. Run the export (on a host that can talk to OnlyOffice CRM)

You can run this:
- On your laptop (if it can reach office.publicadjustermidwest.com)
- On chapmanserver
- Directly on the OnlyOffice droplet (safest for prod runs)

```bash
cd ~/sietch-migration   # or wherever you put the scripts

python3 migrate_from_onlyoffice.py \
  --portal-url https://office.publicadjustermidwest.com \
  --email bot@vanguardadj.com \
  --password FRi3tz4yWXrMTEZ \
  --export-only \
  --export-dir ./crm_export_$(date +%Y%m%d_%H%M)
```

What you get (one JSON per entity type, portable):
- users.json
- stages.json
- tags.json
- custom_fields.json
- contacts.json
- opportunities.json
- tasks.json
- history.json
- export_manifest.json

This does **not** touch any local DB.

When it finishes, note the directory name.

## 3. Transfer the JSON to the import host

```bash
# from the export machine
scp -r crm_export_2026... user@import-host:/tmp/

# or from your laptop if you pulled it down first
```

On the import host you now have `/tmp/crm_export_...` (or wherever you put it).

## 4. Run the import (against the target Postgres)

Point at the **new** Sietch DB (the one the new dashboard will use).

Use the same DB settings you have in `.env` or docker-compose for the new CRM.

Dry-run first (highly recommended):

```bash
cd ~/sietch-migration

python3 import_json_export.py \
  --source /tmp/crm_export_2026... \
  --db-host 127.0.0.1 \
  --db-port 5432 \
  --db-name sietch_crm \
  --db-user sietch \
  --db-password 'yourpassword' \
  --dry-run
```

Real run (removes --dry-run):

```bash
python3 import_json_export.py \
  --source /tmp/crm_export_2026... \
  --db-host 127.0.0.1 \
  --db-port 5432 \
  --db-name sietch_crm \
  --db-user sietch \
  --db-password 'yourpassword'
```

It will:
- Create users with `external_user_id` set to the old CRM id
- Create stages, tags, custom field defs, contacts
- Create opportunities (with stage/contact/responsible mapping)
- Create tasks
- Create history events (with category lookup/creation)
- Print counts

## 5. (Optional) Remap old dashboard-local data

If you have a copy of the old `data/` directory (user-profiles, dashboard-notes, user-presence, etc.) from the old dashboard, run:

```bash
python3 migrate_dashboard_data.py \
  --source /path/to/old/data \
  --portal vanguard \
  --db-host 127.0.0.1 \
  --db-port 5432 \
  --db-name sietch_crm \
  --db-user sietch \
  --db-password 'yourpassword' \
  --dry-run
```

Remove `--dry-run` when happy. This uses the `external_user_id` that the JSON import just populated.

## 6. Verify the round-trip

### Quick counts via psql (or the exposed DB)
```bash
psql -h 127.0.0.1 -p 5432 -U sietch -d sietch_crm -c "
SELECT 'users' as t, count(*) FROM users
UNION ALL SELECT 'opportunities', count(*) FROM opportunities
UNION ALL SELECT 'tasks', count(*) FROM tasks
UNION ALL SELECT 'history_events', count(*) FROM history_events
UNION ALL SELECT 'contacts', count(*) FROM contacts;
"
```

Compare roughly against what you know from the live CRM (or from a previous CSV export).

Sample some data:
```sql
SELECT id, title, external_user_id FROM users ORDER BY id LIMIT 5;
SELECT id, title, stage_id, responsible_user_id FROM opportunities ORDER BY id LIMIT 3;
SELECT id, opportunity_id, content FROM history_events ORDER BY id LIMIT 3;
```

### Start the new dashboard against the imported DB and look around
- Make sure the server is using the right DB (via .env or env vars).
- Log in as an imported user (they will have `must_change_password` = true; you can reset via the auth flow or manually in DB for testing).
- Check:
  - Team roster (users)
  - Kanban / project list (opportunities + stages)
  - Tasks tile / modal
  - History / feed in a deal preview (history events)
  - Tags on cards
  - Any custom fields you care about

## 7. Cleanup / repeat
- For repeated tests, drop the DB and re-init.sql, or use a separate test DB.
- Keep the JSON export around — it's the portable artifact.
- Once a test looks good, you can do the real run on the production new-CRM DB.

## Common gotchas
- Auth fails → double-check bot password and that the bot account is still enabled in OnlyOffice.
- DB connection from outside container → make sure port 5432 is published as 127.0.0.1:5432 on the host (as we did for migration).
- Missing tables → run the latest init.sql against the target DB first.
- Duplicate key on re-import → the scripts are mostly idempotent on email/title, but history may create duplicates on re-run. Use a fresh DB for clean tests.
- Custom field *values* on opportunities and deep per-opp tags are not yet in the bulk export. They can be added later if needed (or handled in the full non-export migration path).
- After import, old dashboard JSON data (tiles, notes, etc.) will still be keyed by old user IDs until you run `migrate_dashboard_data.py`.

## One-liner summary for the real migration day
1. On OnlyOffice droplet (or access machine): git pull new-crm, run export-only with bot.
2. scp the export dir to the new CRM host.
3. On new CRM host: python import_json_export.py ... (no --dry-run).
4. python migrate_dashboard_data.py ... (if copying old data dir).
5. Restart/reload the new dashboard, smoke test a few deals + history + tasks.
6. (Later) turn on sync worker, let users validate, cut over.

Let me know the output of a test run (especially the counts) and we can iterate on any gaps.
