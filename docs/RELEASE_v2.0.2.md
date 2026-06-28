# Release v2.0.2

**Tag:** `v2.0.2`  
**Date:** 2026-06-27  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v2.0.2 is a hotfix that closes the remaining stale autoStatus leak in the dashboard Team tile.

## Changes

### Fixed
- **Presence: stale autoStatus also stripped in Team tile.** The v2.0.1 cleanup only ran in the modal roster (`renderPresenceUserList`). The embedded dashboard tile (`renderPresenceTileCompact`) now clears `autoStatus`/`status`/`inferred` for offline users before rendering each row, so "Reviewing: … · last seen 23h ago" no longer appears.

### Files changed
- `public/app.js`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`, `docs/RELEASE_v2.0.2.md`

## Deploy steps (on production droplet)
```
git pull
docker compose build
docker compose up -d
```
Hard-refresh browser (Ctrl+Shift+R) for new static assets.
