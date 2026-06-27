# Vanguard CRM Dashboard (Standalone)

**Current version:** 1.2.0 — see [CHANGELOG.md](./CHANGELOG.md) and [docs/RELEASE_v1.2.md](./docs/RELEASE_v1.2.md).

**This is a completely standalone web dashboard** for viewing and organizing OnlyOffice CRM opportunities, tasks, notifications, and notes.

It is deliberately kept separate from OnlyOffice so there is no possibility of it affecting or breaking the OnlyOffice Community Server installation. The dashboard runs on its own server (DigitalOcean droplet) and talks to the CRM exclusively through the public API via its own proxy layer.

`server.py` (and `test-server.py`) are **local development and testing tools only**. They are never used in production. All real usage happens after code is pushed to GitHub and pulled on the production dashboard droplet.

## Architecture (high level)
- Standalone dashboard (vanilla JS UI + Python proxy) hosted on its own droplet.
- OnlyOffice CRM runs on a separate droplet.
- Local test servers on the developer's machine are used exclusively for verifying changes before `git push`.

## Run (local development / testing only)

```bash
cd <project-root>
cp -n config.example.env .env   # edit .env with your test portal if desired
./start.sh
```

Default URL: http://127.0.0.1:8765 (override with `PORT` in `.env`).

The client-side mutation queue / offline resilience (for transient CRM/proxy failures) is fully implemented and complete. For testing the queue features, use the special chaos test server instead:

```bash
python test-server.py
```

(See the top of `test-server.py` for console commands to toggle simulated 5xx failures, delays, etc.)

## Deploy (production)

See **[DEPLOY.md](./DEPLOY.md)** for updating the DigitalOcean server after a GitHub commit.

Workflow: Edit + test locally → `git push` → on the production droplet: `git pull`, rebuild, restart.

## Important
- This project is **not** an OnlyOffice module and is never installed into the OnlyOffice Community Server.
- The `onlyoffice-module/` directory (if present) is legacy/separate and not part of the running dashboard.
- Local servers exist solely for safe testing of the standalone dashboard code.

## Dashboard tiles

Use **Add Tile** to add an **Opportunity Group** (kanban), **Calendar** tile (ICS feed), or **Notes** tile (markdown). Calendar tiles load a public ICS URL via `GET /api/calendar/feed?url=…` and show a monthly grid. Calendar tiles auto-refresh on the same schedule as Tasks (hourly, unless the dashboard has been idle for 3 hours).

Other built-in tiles: **Feed** (CRM notifications), **Tasks**, **Team presence** (status, DMs), **CRM Mail inbox** (quick view).

**All dashboard settings** (groups, layout, calendars, notes, templates, feed preferences) auto-save to the server (`PUT /api/user-profile`) per CRM user + portal under `data/user-profiles/` in Docker (not committed to git).

## Documentation

- **[DEPLOY.md](./DEPLOY.md)** — update the production server after a GitHub commit
- **[docs/PRODUCTION_SERVER_NOTES.txt](./docs/PRODUCTION_SERVER_NOTES.txt)** — droplet-only config (estimate-nginx, DNS, certs; not overwritten by git pull)
- **[FUTURE_FEATURES.md](./FUTURE_FEATURES.md)** — roadmap and feature ideas
- **[Toaster_Features](./Toaster_Features)** — suggested dashboard tiles/widgets
- **[ISSUES.md](./ISSUES.md)** — tracked bugs and follow-up work

## Configuration

| Variable | Purpose |
|----------|---------|
| `ONLYOFFICE_PORTAL_URL` | CRM portal base URL |
| `PORT` | Local HTTP port (default 8765) |
