# Release v1.91.5

**Tag:** `v1.91.5`  
**Date:** 2026-06-27  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.91.5 is a hotfix that closes the remaining stale autoStatus leak in the dashboard Team tile.

## Changes

### Fixed
- **Presence: stale autoStatus also stripped in Team tile.** The v1.91.4 cleanup only ran in the modal roster (`renderPresenceUserList`). The embedded dashboard tile (`renderPresenceTileCompact`) now clears `autoStatus`/`status`/`inferred` for offline users before rendering each row, so "Reviewing: … · last seen 23h ago" no longer appears.

### Files changed
- `public/app.js`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`, `docs/RELEASE_v1.91.5.md`

## Deploy steps (on production droplet)
```
git pull
docker compose build
docker compose up -d
```
Hard-refresh browser (Ctrl+Shift+R) for new static assets.
