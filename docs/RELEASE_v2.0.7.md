# Release v2.0.7

**Tag:** `v2.0.7`  
**Date:** 2026-06-30  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v2.0.7 is a hotfix release that fixes preview-modal rendering of pasted email content in Email-category notes and prevents UUIDs from appearing as usernames in the Team presence tile.

## Changes

### Fixed
- **Preview modal: pasted email content now renders for Email-category notes.** Email-category history events were always collapsed to the generic "An email has been received." summary, even when a user pasted real content into the note. A new `shouldRenderMailSummary()` helper ensures the summary is shown only for genuine linked emails (messageId present / mail payload) or the CRM placeholder text; otherwise the actual content renders normally.
- **Presence/Team tile: no more UUID display names.** When a CRM user record lacks `displayName` and `userName`, the server now falls back through `email`, `firstName`+`lastName` before using the raw user id. The Team tile also uses the same robust `getPresenceUserLabel()` helper as the modal roster.

### Files changed
- `public/app.js`, `server.py`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`, `docs/RELEASE_v2.0.7.md`

## Deploy steps (on production droplet)

```bash
git pull
docker compose build --no-cache
docker compose up -d
systemctl restart crm-telegram-bot
```

Hard-refresh browser (Ctrl+Shift+R) for new static assets.
