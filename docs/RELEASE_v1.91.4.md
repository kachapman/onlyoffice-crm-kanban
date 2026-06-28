# Release v1.91.4

**Tag:** `v1.91.4`  
**Date:** 2026-06-27  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.91.4 is a mobile UI + presence reliability hotfix.

## Changes

### Added
- **Nickname field for bot customer mappings.** New text input to label invite codes (e.g. "Office manager"). Displayed in Existing Mappings list with ✎ inline edit. New `PUT /api/bot-customers/nickname` endpoint. (`FEAT-025`)
- **Rich text (HTML) in bot messages.** All bot replies use `parse_mode="HTML"`. CRM note content with `<b>`, `<i>` renders as formatted text. Plain-text fields HTML-escaped.
- **Crash banner: 15s grace period after tab resume.** Suppresses false-positive amber banner from stale-connection failures due to browser throttle during background.

### Changed
- **Bot project summary cleaned up.** No latest note preview or amount in summary list — only title + status. Full details shown on drill-down.

### Fixed
- **Mobile: bot & event-log buttons stacked below sign-out** (second row, right-aligned). No longer overlap header elements.
- **Mobile: opp preview modal fills screen width.** No more right-side cutoff.
- **Presence: stale autoStatus no longer leaks for offline users.** After merge of cache + snapshot, `autoStatus`/`status`/`inferred` cleared for any entry not currently `online`.
- **Presence: team roster no longer blanks on poll failure.** `state.presenceData` is preserved across failed fetches — tile/modal stays populated. Amber banner still shown.

### Files changed
- `public/app.js`, `public/styles.css`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`, `docs/RELEASE_v1.91.4.md`

## Deploy steps (on production droplet)
```
git pull
docker compose build
docker compose up -d
```
Hard-refresh browser (Ctrl+Shift+R) for new static assets.
