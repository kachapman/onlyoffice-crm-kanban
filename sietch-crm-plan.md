# Sietch CRM v3 Migration Plan

**Branch:** `new-crm` (pushed to `git@github.com:kachapman/onlyoffice-crm-kanban.git`)  
**Target:** Fully replace the OnlyOffice CRM dependency with a self-contained PostgreSQL-backed Sietch CRM, then cut over from `main`.

This document is the single source of truth for phases, progress, and open decisions. It is updated after every commit.

---

## Decisions already confirmed

| Question | Answer |
|----------|--------|
| Plan file name | `sietch-crm-plan.md` (this file) |
| Branch | `new-crm` until cutover |
| Card title click | Opens the preview modal. No CRM deep-link needed (we are migrating away from OnlyOffice CRM). |
| Export format | One JSON file per entity type (`contacts.json`, `opportunities.json`, `stages.json`, `tags.json`, `tasks.json`, `history.json`, `files.json`). Easier to inspect, transfer, and retry partial imports. |
| File attachments in export | Metadata + URLs by default. Downloads can be fetched during import if still reachable. |
| Hourly sync | Bidirectional during the transition period. |
| Document handling | OnlyOffice Document Server (already integrated) for future document viewing/editing. |
| sortablejs | CDN `<script>` tag (keep vanilla JS). |
| Profile pictures | Phase 2G. |
| Calendar WebDAV | Deferred. |
| Email classifier | Deferred until after deployment. Branch: `email_scanner`. |
| Testing | Automatic tests during local test-server deployment preferred; manual testing also acceptable. |

---

## Current state

- `new-crm` is the working branch. Latest commit: `9bb823c` — CSV import and project-list fix.
- The dashboard already runs standalone with PostgreSQL, native auth, v2 API, and a self-hosted OnlyOffice Document Server.
- Bot credentials (`bot@vanguardadj.com` / `FRi3tz4yWXrMTEZ`) have been verified to obtain a token from the live CRM.
- Local deployment is on `chapmanserver` via `podman-compose` (Docker unavailable on this machine), dashboard at `0.0.0.0:8766`, DB at `127.0.0.1:5432`.
- A test admin exists for local testing: `admin@example.com` / `admin123`.

---

## Migration strategy

**Option A — API migration via bot credentials.**

1. Export all CRM data via the OnlyOffice API using the bot credentials on the CRM droplet.
2. Transfer the exported JSON files to the dashboard droplet.
3. Import the JSON into local PostgreSQL.
4. Run `migrate_dashboard_data.py` to remap local profile data (notes, tiles, etc.) to the new PostgreSQL user IDs.
5. During the transition period, run a **hourly bidirectional sync** with OnlyOffice to keep both systems in sync.
6. Once the dashboard is fully self-contained and verified, stop the sync and decommission the OnlyOffice CRM dependency.

---

## Phases

### Phase 1: Foundation + Core CRM (mostly complete)

| Sub-phase | Status | Notes |
|-----------|--------|-------|
| 1A: Infrastructure | ✅ | `init.sql`, `db.py`, `docker-compose.yml`, `Dockerfile`, `.env`/`config.example.env` all created. |
| 1B: Auth system | ✅ | `auth.py`, `smtp_client.py`, login/logout/reset endpoints, session cookies. |
| 1C: Migration script | ✅ | `migrate_from_onlyoffice.py` created. Needs `--export-only` mode for Phase 2. |
| 1D: Core API endpoints | ✅ | `server.py` rewritten to direct DB queries. |
| 1E: Frontend API path swaps | ✅ | `app.js` API paths swapped. |
| 1F: Threaded replies | ✅ | API endpoints and UI exist. |
| 1G: Bot + Presence | ✅ | Bot and presence adapted to local DB. Telegram notification dispatch exists. |

### Phase 1 follow-up fixes (done)

Goal: Fix the remaining UI/JS bugs so the dashboard is usable against the local v2 API.

- [x] **Kanban display:** Fixed in `app.js`: added `resolveOppStageId`/`resolveOppStageType`, updated `isOpenOpportunity`, `stageTypeKey`, `groupOpportunities`, `sortCards`.
- [x] **JS `localeCompare` crashes:** All calls now use `String(...)` coercion.
- [x] **Card title interaction:** Removed preview button from `renderCard`; title link now calls `openOpportunityPreviewModal`. Also updated feed notification title behavior for consistency. Removed unused `CARD_ICON_PREVIEW_SCREEN`.
- [x] **Branding save:** Moved `POST /api/branding` to `_handle_api_post_put` in `server.py`. Added `db.query_one` helper and `logger` definition.
- [x] **Team tile active-user filter:** Server presence endpoints already filter `WHERE is_active = TRUE`. Frontend: `loadPortalUsers` now captures `isActive`, and `renderPresenceUserList` filters inactive users. Verified via `/api/v2/users`.

### Phase 2: UI Enhancements + Features

| Sub-phase | Status | Notes |
|-----------|--------|-------|
| 2A: Search modal expansion | 🔲 | Add filters, batch ops, rich results. |
| 2B: Project card click behavior | 🔲 | Will be done in Phase 1 follow-up. |
| 2C: Unified Admin Modal | 🔲 | Single tabbed admin panel (Projects, Users, Stages, Custom Fields, Contacts, Event Log, Bot Customers, Sync Status). |
| 2D: Tile layout refactoring | 🔲 | CSS grid, responsive breakpoints, drag-and-drop (SortableJS CDN). |
| 2E: Photo gallery | 🔲 | Upload, thumbnails, EXIF, lightbox, quota. |
| 2F: Notification drawer | 🔲 | Slide-out drawer with replies. |
| 2G: User profile/account modal | 🔲 | Name, email, phone, display name, profile picture, password change, notification prefs. |

### Phase 3: Email + IMAP

- 3A: IMAP sync module (`imap_sync.py`, `mail_accounts`, `mail_messages`, `mail_deal_links`).
- 3B: Mail UI tile, link to project, thread view.

**Deferred until after deployment.**

### Phase 4: Bidirectional Sync

- 4A: `sync_worker.py` background service, hourly sync.
- 4B: Sync monitor tab in admin modal.

**Status:** Tables (`sync_watermarks`, `opportunity_changes`) already exist in `init.sql`. Sync worker not yet implemented.

### Phase 5: Cutover + Decommission

- 5A: Beta deployment on `crm.publicadjustermidwest.com`.
- 5B: Gradual user migration.
- 5C: Archive OnlyOffice droplet, redirect dashboard domain, remove sync tables/code.

---

## Files to create

| File | Purpose | Phase |
|------|---------|-------|
| `sietch-crm-plan.md` | This plan | ongoing |
| `import_json_export.py` | Import exported JSON into PostgreSQL | 2 (export tooling) |
| `sync_worker.py` | Hourly bidirectional sync | 4 |
| `imap_sync.py` | IMAP email sync | 3 (deferred) |

## Files to modify

| File | Changes |
|------|---------|
| `public/app.js` | Phase 1 follow-up: kanban fields, `localeCompare`, card title click, active-user filter. |
| `server.py` | Phase 1 follow-up: move `POST /api/branding` to `_handle_api_post_put`. Phase 2C: admin handlers. Phase 4: sync endpoints. |
| `public/index.html` | Phase 2C: Unified Admin Modal. Phase 2E: photo tab. Phase 2G: profile modal. |
| `public/styles.css` | Phase 2C: admin theme. Phase 2D: grid layout. |
| `migrate_from_onlyoffice.py` | Phase 2: add `--export-only` mode. |
| `migrate_dashboard_data.py` | Phase 2: fix user ID mapping. |
| `AGENTS.md` | Updated after every session. |
| `CHANGELOG.md` | Updated after every release/fix. |

---

## Progress log

- 2026-07-19: Created `sietch-crm-plan.md` with confirmed decisions from chat history.
- 2026-07-18: `9bb823c` — CSV import and project-list fix.
- 2026-07-18: `7f28153` — Fix projects list stage/contact field indices and add CSV import script.
- 2026-07-18: `a2e8cb2` — Fix JS syntax error after `uploadAttachmentForNote` refactor.
- 2026-07-19: Phase 1 follow-up fixes committed (kanban fields, `localeCompare`, card title→preview, branding POST route, active-user filter). Verified locally: branding save works, `/api/v2/projects` returns top-level `stageId`/`stageType`, `/api/v2/users` returns `isActive`.
- 2026-07-18: `60d880b` — Add dashboard-local data migration tooling.
- 2026-07-18: `b7d091b` — Expose dashboard on `0.0.0.0` and DB on `127.0.0.1:5432`.
- 2026-07-18: `0fb82e3` — Fix local deployment for Podman.
- 2026-07-18: `4e1ecde` — Phase 1F/2E: Document Server integration.
- (Earlier commits: Phase 1A-1D foundation, Phase 1E API swap, Phase 1G bot/presence.)

---

## Next action

Phase 1 follow-up complete. Next: Phase 2 export tooling (`--export-only` mode + `import_json_export.py`).

Update AGENTS.md and commit.
