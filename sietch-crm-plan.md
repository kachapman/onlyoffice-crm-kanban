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

## Non-negotiables (CRITICAL - do not violate)

- **Preserve all current CRM data and layout as if we are still using the OnlyOffice API.** 
  - Same note types (history_categories), opportunities, note history (with embedded emails in history events), contacts, tasks, stages, tags, custom/user fields, etc.
  - When in doubt, refer to last known production version (main branch) details for what the user is displaying and using in deal tiles, preview modals, feed, etc.
  - All links, data, and functionality must continue to work.
- **Do not change anything that does not explicitly need to be changed.**
- **Implement/replace all OO API dependent functionality** with local DB equivalents (v2 API, etc.) without breaking existing data or UI.
- Example: Implement a contacts section/tile/admin support so old contacts data can be imported and all contact-based functionality (in deals, customer bot modal, previews, etc.) still functions.
- **Focus first on making the CRM fully functional with the new DB and UI changes.** Move data sync / full import to later phase.
- **Git version and update docs after every significant change** so context is not lost.
- Preserve exact hover behavior on deal tiles (mouse over lights up borders) from production.

---

## Current state

- `new-crm` is the working branch.
- The dashboard runs standalone with PostgreSQL (sietch_crm), native auth, v2 API, Document Server.
- One-time import of OnlyOffice data completed (1191 opps, 38898 history, 11 users, 16 contacts, 18 stages, 21 tags defs). Data KEPT (no wipe). Tags/tasks per-opp not transferred in bulk export; will be addressed via future read-only enrich/sync (not blocking functionality).
- Focus: make Sietch fully functional standalone first (create/edit deals, no reliance on OO for core). Import diagnosis deprioritized; move through phases per plan, revisit import/sync later.
- Bot (bot@vanguardadj.com / FRi3tz4yWXrMTEZ) and other admins (e.g. kenc) work for login.
- Admin UIs (branding etc) auto-available to isAdmin users (no extra login).
- Local run: use venv + DB_HOST=127.0.0.1 if needed; server binds 0.0.0.0 and prints LAN URLs.

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

Goal: Fix the remaining UI/JS bugs so the dashboard is usable against the local v2 API. (Additional fixes applied to ensure create/edit works with imported data.)

- [x] **Kanban display:** ...
- [x] **JS `localeCompare` crashes:** All calls (including missed Map entry sorts in user selects for create/edit/notify/task filters) now use `String(...)` coercion defensively.
- [x] **Card title interaction:** ...
- [x] **Create/edit fixes:** Server create now accepts stageType (no longer hardcodes 0). JS user selects fixed to prevent a[1].localeCompare errors during open/create/edit modals. 
- [x] **Branding save:** ...
- [x] **Team tile active-user filter:** ...

### Phase 2: UI Enhancements + Features

| Sub-phase | Status | Notes |
|-----------|--------|-------|
| 2A: Search modal expansion | ✅ | Filters (stage, owner), batch ops (add/remove tag, set stage, export selected), rich results, select-all, row-click preview. |
| 2B: Project card click behavior | ✅ | Cards click → preview (side/full) or edit; Phase 1 follow-up completed. |
| 2C: Unified Admin Modal | ✅ | Vertical sidebar tabs (overview/sync/users/stages/custom-fields/contacts/tags/branding/bot/logs); custom fields read-only, tags add, contacts/stages add+search, sync stubs; icons per non-neg. Projects managed via search modal (filters + batch ops). |
| 2D: Tile layout refactoring | 🟡 | CSS grid (spans, double-height, responsive), native drag-drop + hints + layout buttons; SortableJS/FLIP/terminal theme per big plan not yet. |
| 2E: Photo gallery | 🔲 | Backend + DB + quota/EXIF/folders ready; no frontend UI (no Photos tab in preview, no gallery/lightbox). |
| 2F: Notification drawer | 🔲 | Feed tile + keyword filter exists; no slide-out drawer with inline replies. |
| 2G: User profile/account modal | 🔲 | /api/user-profile exists for sync; no dedicated modal for edit (name/email/pw/prefs/pic). |

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

### Research item: OnlyOffice CRM import phase (for future sync/enrich)
- Consider still using the export script path (`migrate_from_onlyoffice.py --export-only` + `import_json_export.py`), but ensure **every deal is ID'd by its unique OnlyOffice number** (the `id` from the opp object, as shown in `https://office.publicadjustermidwest.com/Products/CRM/Deals.aspx?id=828`).
- Store the OO id (as `external_id` or similar column on `opportunities`) during import. Future API sync (Phase 4) can then reliably locate + match the correct deal inside Sietch by this stable id instead of title (e.g. "Storyboard on Ramada (Steve Krajczar)").
- Also address current export limitation: bulk opp export (via `/filter`) + import currently misses per-opportunity **tags** and **user/custom field values** (only global tag list and custom field *definitions* are exported). Extend export (parallel to how per-opp history is pulled) to capture full `tags` + `customFieldList` so they survive roundtrip or can be used in later sync.

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
- 2026-07-19: Phase 1 follow-up fixes committed (kanban fields, `localeCompare`, card title→preview, branding POST route, active-user filter). Verified locally.
- 2026-07-19: Started Phase 2 export tooling: `--export-only` + `import_json_export.py` skeleton added to `migrate_from_onlyoffice.py`. Fixed user_id=1 fallback in profile migration. Footer made static (bottom of content flow).
- Quick logo update: Replaced dashboard logos with new assets/sietch-logo-2-nobg*.png (nobg2 for pure logo in header/branding defaults; nobg1 for footers that had logo + name text beside it). Updated all references in HTML, server.py, init.sql, README. Progress: Phase 1 fixes complete (localeCompare, create/edit now functional). Issues encountered: import left tags/tasks incomplete (deprioritized per direction); multiple title matches possible for future enrich (will use external_id). Continuing to Phase 2C admin console expansion.
- Advanced 2C: normalized /api/v2/me to camelCase (consistent isAdmin etc); added live Overview (shows current user from session) + functional Users tab (lists all users read-only via /api/v2/users with admin badges). Sync tabs remain stubbed. Header buttons (mail, add-tile, bookmarks) + sign-out fixed with early listener attach + robust show/hide (part of making UI functional before deeper 2C tabs).
- Consulted plan: still in Phase 2 / 2C focus (admin tabs filling, contacts). Phase 1 + research item complete. Moving forward on 2C.
- 2C contacts tab: enhanced with live search, dynamic list from /api/v2/contacts, basic add contact form (uses existing POST). Read-only display for import preservation; supports func in deals/bot.
- 2026-07-18: `60d880b` — Add dashboard-local data migration tooling.
- 2026-07-18: `b7d091b` — Expose dashboard on `0.0.0.0` and DB on `127.0.0.1:5432`.
- 2026-07-18: `0fb82e3` — Fix local deployment for Podman.
- 2026-07-18: `4e1ecde` — Phase 1F/2E: Document Server integration.
- (Earlier commits: Phase 1A-1D foundation, Phase 1E API swap, Phase 1G bot/presence.)

---

## Next action

Non-negotiables in place. Admin: button position fixed, tabs with icons (current order), contacts stub added for preserve, redirects for old modals. Header static "Sietch CRM [ver]". Logos static. Flashing fixed to original hover (no re-render). Git committed + docs updated after changes.

Header core buttons (mail/add-tile/bookmarks) + sign-out now functional. 2C admin contacts tab enhanced (search + add). Continue filling admin tabs content (move forms, e.g. stages), ensure contacts full for func, keep all preserve rules. Sync moved later. Focus functional new DB/UI. Advance Phase 2C.

Update AGENTS/CHANGELOG/plan after every change.
