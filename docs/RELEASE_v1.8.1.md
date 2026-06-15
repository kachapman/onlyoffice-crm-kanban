# Release v1.8.1

**Tag:** `v1.8.1`  
**Date:** 2026-06-14  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.8.1 fixes multiple production issues reported after the v1.8.0 release:

1. **Deal caching** — stale data after edits/refresh
2. **Email width** — expanded emails rendered in narrow strip
3. **UI freeze** — tab-return freeze from IntersectionObserver burst
4. **Attachment note indicator** — no visible feedback when CRM is down
5. **Quote font readability** — serif too tight at small size
6. **Preview modal stale data** — manual refresh still returned cached data
7. **Amber border lost after edit** — card styling disappeared after deal edit
8. **Changelog popup** — new feature to show release notes on first login

No breaking changes.

---

## Fixes

### Deal caching (refreshAll, refreshGroup, server proxy)
- `refreshAll()` no longer rehydrates stale IndexedDB data after clearing — hydration moved to `initCaches()` on initial load only.
- `enableCachePersistence()` now idempotent (prevents double-wrapping on repeated refreshAll calls).
- Server-side cache invalidation expanded to `DELETE` mutations and single-opp cache lines on tag changes.
- Tile refresh button (`⟳`) and `refreshGroup({ force: true })` explicitly clear the filter result cache before fetching.

### Email width
- `.mail-detail`, `.opp-preview-mail-embed`, `.opp-preview-mail-body` now have `width: 100%`.
- Mail inbox modal now uses `.opp-preview-mail-embed` class (CSS rules apply correctly).

### UI freeze (tab return)
- 50ms debounced batch collector for IntersectionObserver callbacks.
- `visibilitychange` listener disconnects all observers when hidden, re-observes after 500ms delay when returning.
- `enqueueOpportunityCustomFieldEnrich()` skips work when `document.visibilityState === 'hidden'`.

### Attachment note indicator
- `createOpportunityHistoryEvent()` returns `{ queued: true }` / `{ success: true }`.
- Callers (`submitDealEditForm`, `submitQuickNoteForm`) show toast when note is queued.
- Note queue indicator styled with amber background for visibility.

### Quote font
- Changed from "Instrument Serif" (decorative italic serif) to DM Sans (sans-serif).
- Size: 0.85rem, weight: 500, line-height: 1.45. Italic style.

### Preview modal stale data
- Added `bustCache(path)` helper: appends `?_t=Date.now()` to API paths.
- Preview refresh button (`⟳`) passes `force=true` through the entire fetch chain, bypassing the 30s server proxy cache.

### Amber border lost after deal edit
- `fetchOpportunityForUpdate()` returns core opp data but **no tags**.
- Added `await enrichOpportunitiesTags([updatedOpp])` in both `submitDealEditForm` and `submitQuickNoteForm` before rendering the card.
- Card styling (`.card--high-priority` for "High Priority" tag) is now preserved.

---

## New Feature

### Changelog popup
- Modal shown **once per version** on first login after an update.
- Fetches `CHANGELOG.md` via `GET /api/changelog` (new server endpoint).
- Renders markdown using the existing `renderBasicMarkdown()` function.
- Dismissed by Close button, Escape key, or backdrop click.
- Persistence: `localStorage.setItem("changelog_seen_version", version)`.
- Does not show again until the version changes.

---

## Files Changed
- `public/app.js` — caching, observer batching, note indicators, cache busting, tag enrichment, changelog modal
- `public/styles.css` — email width, quote font, note queue indicator, changelog modal styles
- `public/index.html` — changelog modal markup
- `server.py` — cache invalidation rules, new `/api/changelog` endpoint
- `VERSION`, `README.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/GITHUB_RELEASES.md`
- `docs/RELEASE_v1.8.1.md` — this file

---

## Deploy Notes
- Standard deploy: `git pull`, `docker compose build`, `docker compose up -d`
- Browser hard-refresh recommended after deploy (static JS/CSS cached)
- Verify: `curl -s https://dashboard.vanguardadj.com/api/config` should return `"version": "1.8.1"`
