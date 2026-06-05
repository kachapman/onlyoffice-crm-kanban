THIS WAS MADE BY A CLANKER. LOOK ON IT YE MIGHTY AND DESPAIR. 

# CRM Kanban (Workspace dashboard)

**Current version:** 1.1.0 — see [CHANGELOG.md](./CHANGELOG.md), [docs/RELEASE_v1.1.md](./docs/RELEASE_v1.1.md), and server deploy [docs/DEPLOY_v1.1_VERIFY_STEPS.md](./docs/DEPLOY_v1.1_VERIFY_STEPS.md).

Local test portal for Vanguard CRM opportunities, tasks, and notifications. Serves static UI from `public/` and proxies OnlyOffice CRM API calls via `server.py`.

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
