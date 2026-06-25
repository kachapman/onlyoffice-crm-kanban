# Release v1.91.2

**Tag:** `v1.91.2`  
**Date:** 2026-06-25  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.91.2 fixes a ~10 second UI hang after deal edits (especially from the bookmark preview). 

## Changes

### Fixed
- **Dashboard no longer hangs ~10s after deal edit.** Root cause: `submitDealEditForm` called `refreshAll()` in the post-edit chain, which cleared all caches, re-fetched every CRM API endpoint, rebuilt every group tile DOM from scratch, then triggered background tile loads that rebuilt group boards a second time. Replaced with a targeted board + preview + bookmark refresh running in **parallel**.
- **Post-edit preview history capped at 2 pages (100 items).** `fetchAllOpportunityHistory` now accepts a `maxPages` option. Auto-refreshes after edit/note pass `quick: true` → 2 pages max. Initial preview opens still get the full 10 pages (500 items).
- **Quick note post-save chain also parallelized** (same `Promise.all` pattern).

### Technical details
- Removed `refreshAll()` from `submitDealEditForm` (was line 9255).
- Replaced sequential `.then()` chain in both `submitDealEditForm` and `submitQuickNoteForm` with `Promise.all()` so preview refresh, board inline update, and bookmark tab refresh run concurrently.
- Added optional `maxPages` param to `fetchAllOpportunityHistory`, threaded as `quick` flag through `fetchOpportunityPreviewData` and `openOpportunityPreviewModal`.

### Files changed
- `public/app.js`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`, `docs/RELEASE_v1.91.2.md`, `docs/GITHUB_RELEASES.md`

## Deploy steps (on production droplet)
```
git pull
docker compose build
docker compose up -d
```
Hard-refresh browser (Ctrl+Shift+R) for new static assets.
