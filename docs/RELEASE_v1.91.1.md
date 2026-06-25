# Release v1.91.1

**Tag:** `v1.91.1`  
**Date:** 2026-06-25  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.91.1 ships bugfixes for the v1.91.0 features (event log persistence, GUID validation on notes with attachments) without new functionality.

## Changes

### Fixed
- **Event log no longer clears on hard refresh:** `loadEventLogFromStorage()` is now called during `init()` so the localStorage backup is applied before the server merge runs. Previously, `applyUserProfile()` ignored the `eventLog` field and the default state was always `[]`, so on hard refresh the log was empty until the server sync completed (and if the server sync had previously failed, entries were permanently lost).
- **GUID validation error on notes with attachments + notify users:** When posting a note with attachments AND users to notify, the `notifyUserList` was serialized as a JSON array string (`["guid1","guid2"]`). OnlyOffice's .NET model binder tried to parse the entire string as a single GUID, causing "Guid should contain 32 digits with 4 dashes." Fixed by sending `notifyUserList=guid1&notifyUserList=guid2` (individual form-urlencoded params matching ASP.NET MVC's `List<Guid>` convention).
- **GUID validation hardened:** `validNotifyUserList` now filters with `isGuid()` instead of `filter(Boolean)`, silently rejecting non-GUID values before they reach the API (applies to JSON path only; form-urlencoded path now uses `params.append`).
- **File ID validation hardened:** `validFileIds` now validates numeric format (`/^\d+$/`), rejecting non-numeric file IDs before they are sent.

### Files changed
- `public/app.js`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`, `docs/RELEASE_v1.91.1.md`, `docs/GITHUB_RELEASES.md`

## Deploy steps (on production droplet)
```
docker compose build
docker compose up -d
```
Then hard-refresh the browser (Ctrl+Shift+R) to pick up static assets.
