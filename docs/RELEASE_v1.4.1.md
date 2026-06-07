# Release v1.4.1

**Tag:** `v1.4.1`  
**Date:** 2026-06-08  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.4.1 is a patch release to fix a deployment-time regression introduced in the v1.4.0 tag.

The v1.4.0 Dockerfile did not copy `presence_store.py` into the production image. Because `server.py` does `from presence_store import ...` (required for the Team/Presence feature), the dashboard container would crash on startup with a ModuleNotFoundError. This manifested as a crash loop ("Restarting (1)") and nginx 502 Bad Gateway after `docker compose up --build` on the production droplet.

The fix ensures all Python modules required by server.py are explicitly copied. A note was added to the deployment docs to prevent this class of issue in the future.

No functional changes to the application itself.

---

## Deployment / Docker Hotfix

- Dockerfile: Added `presence_store.py` to the COPY line:
  ```
  COPY server.py ics_calendar.py notes_store.py user_profile_store.py presence_store.py ./
  ```
- This matches the modules imported by server.py for the full presence feature (roster, DMs, status, inbox, indicators, etc.).
- On the live server the hotfix was applied by editing the checked-out Dockerfile + `docker compose build --no-cache` + `up -d` (container was in detached tag state).
- Added explicit verification in docs/UPDATE_AND_DEPLOY.txt:
  - After build: `docker compose logs dashboard` (no import errors)
  - Local health: `curl http://127.0.0.1:8765/api/config`
  - From nginx container: `docker exec estimate-nginx wget -qO- http://vanguard-crm-dashboard:8765/api/config`
  - Reminder to keep Dockerfile COPY in sync with any new .py files added to server.py.

## Documentation & Housekeeping

- Version bumped to 1.4.1 everywhere (VERSION, AGENTS.md, README.md, CHANGELOG.md, new RELEASE_v1.4.1.md, docs/GITHUB_RELEASES.md, docs/UPDATE_AND_DEPLOY.txt).
- New release notes and updated deploy checklist to call out the "include all server.py dependencies in Dockerfile" rule.

This ensures that future releases (or re-deploys of v1.4.x) will not produce 502s due to missing Python modules after the presence features landed.

See the v1.4.0 notes for the main features (local kanban title bar, column color + slide via edit, stable Presence demo indicator, inbox unread shading, etc.).

**No other code changes.** Pure build/docs fix.
