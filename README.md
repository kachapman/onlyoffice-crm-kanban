THIS WAS MADE BY A CLANKER. LOOK ON IT YE MIGHTY AND DESPAIR. 

# Vanguard CRM Dashboard (Standalone)

**Current version:** 1.7.0 — see [CHANGELOG.md](./CHANGELOG.md), [docs/RELEASE_v1.7.0.md](./docs/RELEASE_v1.7.0.md), and server deploy [docs/UPDATE_AND_DEPLOY.txt](./docs/UPDATE_AND_DEPLOY.txt).

**This is a completely standalone web dashboard** for viewing and organizing OnlyOffice CRM opportunities, tasks, notifications, and notes.

It is deliberately kept separate from OnlyOffice so there is no possibility of it affecting or breaking the OnlyOffice Community Server installation. The dashboard runs on its own server (DigitalOcean droplet) and talks to the CRM exclusively through the public API via its own proxy layer.

`server.py` (and `test-server.py`) are **local development and testing tools only**. They are never used in production. All real usage happens after code is pushed to GitHub and pulled on the production dashboard droplet.

## Architecture (high level)
- Standalone dashboard (vanilla JS UI + Python proxy) hosted on its own droplet.
- OnlyOffice CRM runs on a separate droplet.
- Local test servers on the developer's machine are used exclusively for verifying changes before `git push`.

## Run (local development / testing only)
```bash
cd ~/crm-kanban
cp -n config.example.env .env   # edit .env with your test portal if desired
./start.sh
```

Default URL: http://127.0.0.1:8765

The client-side mutation queue / offline resilience (for transient CRM/proxy failures) is fully implemented and complete. For testing the queue features, use the special chaos test server instead:
```bash
python test-server.py
```
(See the top of `test-server.py` for console commands to toggle simulated 5xx failures, delays, etc.)

## Deploy (production)
See **[docs/UPDATE_AND_DEPLOY.txt](./docs/UPDATE_AND_DEPLOY.txt)** and **[docs/DEPLOY_v1.1_VERIFY_STEPS.md](./docs/DEPLOY_v1.1_VERIFY_STEPS.md)**.

Workflow: Edit + test locally on this machine → `git push` → on the production dashboard droplet: `git pull`, rebuild, restart. Local test servers are stopped before pushing.

## Important
- This project is **not** an OnlyOffice module and is never installed into the OnlyOffice Community Server.
- The `onlyoffice-module/` directory (if present) is legacy/separate and not part of the running dashboard.
- Local servers exist solely for safe testing of the standalone dashboard code.

## Run (local development)

```bash
./start.sh
```

Default URL: http://127.0.0.1:8765 (override with `PORT` in `.env`). Copy `config.example.env` to `.env` and set `ONLYOFFICE_PORTAL_URL` if needed.

## Deploy (production)

See **[DEPLOY.md](./DEPLOY.md)** for Docker on DigitalOcean, Bluehost DNS (`dashboard.vanguardadj.com`), GitHub push/pull, and HTTPS.

## Dashboard tiles

Use **Add Tile** to add an **Opportunity Group** (kanban) or a **Calendar** tile. Calendar tiles load a public ICS URL (Proton subscribe link or any HTTPS feed) via `GET /api/calendar/feed?url=…` and show a monthly grid. Calendar tiles auto-refresh on the same schedule as Tasks (hourly, unless the dashboard has been idle for 3 hours).

**All dashboard settings** (groups, layout, calendars, notes, templates, feed preferences) auto-save to the server (`PUT /api/user-profile`) per CRM user + portal under `data/user-profiles/` in Docker (not committed to git).

## Documentation

- **[docs/UPDATE_AND_DEPLOY.txt](./docs/UPDATE_AND_DEPLOY.txt)** — step-by-step: edit locally → GitHub → update server
- **[docs/PRODUCTION_SERVER_NOTES.txt](./docs/PRODUCTION_SERVER_NOTES.txt)** — droplet-only config (estimate-nginx, DNS, certs; not overwritten by git pull)
- **[FUTURE_FEATURES.md](./FUTURE_FEATURES.md)** — roadmap (tile preview popup, custom fields, note attachments)
- **[Toaster_Features](./Toaster_Features)** — suggested dashboard tiles/widgets (CRM-inspired)
- **[ISSUES.md](./ISSUES.md)** — tracked bugs and follow-up work (e.g. New Opportunity custom user fields)

## Configuration

| Variable | Purpose |
|----------|---------|
| `ONLYOFFICE_PORTAL_URL` | CRM portal base URL |
| `PORT` | Local HTTP port (default 8765) |
