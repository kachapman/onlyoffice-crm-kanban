# AGENTS.md — Sietch CRM (new-crm branch)

**Current version:** 3.0.0 (released 2026-07-18; see CHANGELOG.md)  
**Last session summary (for next resume):** Phase 2A continued: search popup now opens to Projects tab (not "search"). Projects tab = search input + stage/owner filters + batch ops. Tags tab = separate tab for tag selector + Search by Tag. Tab switching triggers data load (performSearchPopupQuery for projects, performSearchPopupTagQuery for tags). Error display scoped per-tab. Tag selector deduplicated. renderSearchPopupResults now takes container param. activateSearchPopupTab handles projects/tags/preview logic. Commit 7de588f pushed. CHANGELOG updated. Next: Phase 2D/2E/2F/2G or test+deploy.

This file is auto-loaded by Grok into the system prompt for every session in this directory tree. It provides persistent project context so you do **not** need a full "pick up where we left off" explanation or complete re-exploration on every new session. (See also user-guide 12-project-rules.md and 17-sessions.md.)

**Always:** 
- Resume prior work via TUI welcome screen (recent sessions for this cwd), `/load`, `grok --resume <id>`, or `-c` (continue most recent). Chat history + prior state is preserved in `~/.grok/sessions/...`.
- Still use tools (list_dir / read_file / grep / run_terminal_command for git etc.) to inspect *current* code state — files + docs are the source of truth.
- For new sessions: `cd <project-root>` (sets workspace/cwd for rules + session grouping).

## Non-negotiables (ALWAYS FOLLOW - prevent breaking)
- Preserve ALL current CRM data and layout **as if we are still using the OnlyOffice API**.
  - Same note types (history_categories), opportunities, note history (embedded emails in history events), contacts, tasks, stages, tags, custom/user fields, etc.
  - When in doubt, refer to last known production version details (git show main:...) to see what user is displaying/using in deal tiles and preview modals.
  - Make sure links, data, functionality still work exactly.
- **Do not change anything that does not explicitly need to be changed.**
- Implement/replace **all** functionality/fields/modals that required OO API calls with local DB/v2 equivalents.
- Example: Add contacts support (section/tile/admin) so old contacts data imports and contact-based func (deals, bot modal, etc.) works.
- Focus functional first with new DB/UI. Move full data sync/import to later phase.
- After every change: run git status --short && git diff --stat; update AGENTS.md last summary + CHANGELOG; commit with git.
- For admin: icons in tabs (exact same SVGs next to titles), no separate buttons. Keep current tab order.
- Hover on tiles: exact original production (mouse over lights borders, no re-render/flash).
- Sync: timestamp based (full + delta), bot creds (show fields default hidden), pull all via history etc.
- Header: static "Sietch CRM [version]". Footer/logo/favicon/name static (overwrite old). Watermark/header logo = customizable.
- Git version + docs after changes.

## Project Overview & Architecture (high level, reuse these)
- Vanilla JS dashboard (no framework) + Python backend for Sietch CRM.
- **Frontend (public/):** 
  - index.html (modals, tiles, chrome)
  - app.js (main; state, rendering, api wrapper, profile sync, modals for deal-edit/create/quick-note/preview, group kanban, feed, tasks, calendars, notes)
  - styles.css
  - Static assets (favicons, ship logos)
- **Backend:** server.py (v2 REST API, auth, document storage, Document Server proxy, user profiles, notes, calendars, presence, bot integration).
- **Database:** PostgreSQL 16 (init.sql schema, db.py connection layer).
- **Document Server:** OnlyOffice Document Server (standalone Docker container for viewing/editing Word, Excel, PowerPoint files).
- **Auth:** auth.py (PBKDF2 password hashing, session cookies, password reset via SMTP).
- **Persistence (per CRM user):** 
  - user_profile_store.py (data/user-profiles/.../*.json; versioned; supports groups, calendarTiles, notesTiles, groupTemplates, tileLayout, hiddenFeedKeys, feedKeywordFilter)
  - notes_store.py (for notes tiles content)
  - LocalStorage fallbacks + debounce server saves (scheduleUserProfileSave).
- **Tiles:** Opportunity groups (kanban with filters/stages/tags/red), fixed panels (feed/notifications, tasks), addable (calendars ICS, notes markdown). See Toaster_Features for ideas.
- **Key patterns to ALWAYS reuse:**
  - Profile: buildUserProfilePayload, applyUserProfile, loadUserProfileFromServer (prefers server), saveGroupsToStorage/scheduleUserProfileSave/saveUserProfileToServer, strip*RuntimeFields.
  - Tiles/layout: bindTileChrome, applyTileBodyCollapsed/applyTileLayoutClasses, createLayoutButtons, attachTileCollapseButton, tileLayout in state.
  - API: `api(path, opts)` + parseApiError (throws on !ok); all CRM calls go through v2 API endpoints directly (no proxy).
  - New tile type (if adding): follow checklist in Toaster_Features (add to HTML+JS chooser, persist in profile py + frontend, refresh policy, empty states, update docs).
  - Modals: reuse .modal / .modal-card / backdrop / data-*-dismiss / escape; openDealEditModal, confirmDialog.
  - History/feed: unwrapHistoryEvents, /api/v2/projects/{id}/history, applyFeedKeywordFilter.
  - Groups: fetchOpportunitiesForGroup + buildFilterQuery, renderCard, setupGroupToolbar (templates, remove, filters).
- **Custom fields on create (ISSUE-001/FEAT-002):** Fully implemented and enabled (CREATE_OPP_USER_FIELDS_ENABLED=true). customFieldList with {key,value} camelCase added to create body. See ISSUES.md for root cause.
- **Do not:** Duplicate docs (link to FUTURE_FEATURES.md, ISSUES.md, Toaster_Features, docs/UPDATE_AND_DEPLOY.txt, README). No new abstractions unless the task requires. Prefer minimal changes following existing.

## Post-v1.2 shipped items (for reference)
All items from the explicit post-1.1 testing list + live feedback were completed for v1.2.0:
- Tile collapse/minimize (notes, calendar, groups with half/quarter width preserved while collapsed) + calendar double-height scaling.
- Immediate persistence on group remove.
- Tasks rows show description.
- Keyword filter: comma-separated = AND (every token required).
- Preview stays open on edit-from-preview.
- White favicon/logo.
- Friendly message for linked-email "not found".
- Full tasks-list modal (cabinet icon button, open+completed, show-completed toggle, check/uncheck via /close+/reopen, New Task, deep links, light readability styling).
- Template management: delete-only modal with × per template (no edit/rename).
- CRM crash/5xx banner (exact wording, 30s guidance, throttle, auto-clear, api() trigger).
- AGENTS.md added.
- FUTURE_FEATURES cleanup (crash item removed because shipped).

**v1.4.5 additions (most recent session work — read this first on next resume):**
- Side-by-side "quick edit" / note popup from opp preview: opens left of preview (desktop) or fixed top (mobile); both fully interactive; auto-refresh of preview history on submit; new manual ⟳ refresh button left of ✎; × delete on note history items in preview (confirm + DELETE /history/{id}).
- Presence AFD: "Away from dashboard" (subtle gray dot + section) for tab-away but active session vs true "offline" only on sign-out (server clears hb on /logout); 3h auto-logout; "Last CRM (proxy)" confirmed only from real proxied calls.
- Feed: today's notifications get subtle white left border line (`.feed-item-today`).
- Crash resilience: on 502/5xx (api + presence), persistent right-side amber banner ("CRM temporarily unreachable... refresh in 30s or contact admin"); no raw toasts; tiles *all* render (CRM ones empty/no-content, local features work); banner hides only on successful CRM response.
- Quick note side submit now reliably refreshes preview.
- **Mobile fixes (3):** bot/event-log buttons stacked below sign-out (Option A, bot swapped to rightmost on mobile); opp preview modal fills screen width; presence stale autoStatus leak fixed (modal + tile) + poll failure no longer wipes team roster. See CHANGELOG.md.
- All changes in v1.4.5 release notes + full deploy checklist followed (local close, git tag/push, prod docker + VERIFY blocks). Update AGENTS on every release.

See CHANGELOG.md and docs/RELEASE_v1.2.md. AccuLynx research stays in FUTURE_FEATURES under Other ideas (not implemented). 

For the previous post-v1.1 list and implementation notes, consult the git history / session artifacts around the v1.2 commits.

Legacy open items (lower priority unless asked): FEAT-003 attachments, new toasters (stale deals, closing this week, etc.), FEAT-022 docs tile.

## Architecture & Deployment Context
- The **dashboard** (this entire project) runs on its own DigitalOcean Ubuntu droplet (production: https://dashboard.publicadjustermidwest.com, currently 159.89.229.126). It serves the vanilla JS UI from `public/` and acts as an API proxy (`server.py`) that forwards CRM calls to the OnlyOffice server while handling user profiles, notes, calendars, and auth.
- The **OnlyOffice CRM** (Community Server / Workspace) runs on a **completely separate** DigitalOcean droplet. The two servers communicate over public HTTPS.
- **Local testing workflow (mandatory before any push):**
  - All development and verification happens on the developer's machine (this laptop).
  - Use `./start.sh` (normal dev server) or `python test-server.py` (special chaos/failure simulation server) for local testing.
  - The local servers are **only for testing features and fixes**. They are never used in production.
  - After local verification (browser + DevTools, including simulated failures for the mutation queue), commit and `git push`.
  - On the production dashboard droplet: `git pull`, `docker compose build`, `docker compose up -d` (see docs/UPDATE_AND_DEPLOY.txt and docs/DEPLOY_v1.1_VERIFY_STEPS.md for the exact safe checklist).
- **Critical separation rule:** This project is a **standalone dashboard**. It is deliberately kept completely separate from OnlyOffice so there is zero risk of it affecting or breaking the OnlyOffice Community Server installation. The `onlyoffice-module/` directory (if present) is legacy/separate and not used for the main dashboard. Local test servers exist solely to allow safe iteration on the JS + proxy code before deploying the standalone dashboard.
- **Production shared-hosting note:** The dashboard droplet also runs other web apps. As of 2026-07, public traffic for `dashboard.publicadjustermidwest.com` is handled by the **host's nginx** (systemd service at `/etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com`), **not** the Docker `estimate-nginx` container. The dashboard container binds to `127.0.0.1:8765`. The dashboard is in a separate Compose project but joins `estimate-enhancer_estimate-network` (harmless). **Required for uploads:** `client_max_body_size 100m; proxy_request_buffering off; proxy_read_timeout 120s;` in the host site file. Always read `docs/DASHBOARD_INFRASTRUCTURE.md` (especially the 2026-07 section) before touching nginx on the host. The old `/opt/estimate-enhancer/nginx.conf` is historical for this domain.

## How to Run / Test / Deploy
- **Dev (normal):** `cd ~/crm-kanban && cp -n config.example.env .env && ./start.sh` (or `DB_HOST=127.0.0.1 ./.venv/bin/python3 server.py` if needed). Server prints LAN URLs on start (binds 0.0.0.0). Login with your credentials (session-cookie auth).
- **Special test server (for chaos/failure testing):** `python test-server.py`. Supports controllable chaos mode via `/api/test/chaos`.
- **Test changes:** Browser + DevTools (Network tab for API calls, Application → Local Storage for profile). Always test both happy path and failure scenarios.
- **No tests:** No automated suite; manual + visual testing.
- **Agent memory rule (critical):** After every feature or fix, explicitly confirm the exact files changed, run `git status --short && git diff --stat`, write a one-line summary in AGENTS.md under "Last session summary", and ensure the CHANGELOG entry exists before ending the session.
- **Deploy:** See docs/UPDATE_AND_DEPLOY.txt (stop local server, edit, test locally, git commit + push). Then on the production droplet: `git pull`, `docker compose build`, `docker compose up -d`.
- **Debug:** server.py logs, browser console, `grep` in the codebase.
- **Profile data:** `data/user-profiles/...` (gitignored); survives restarts.

## Coding Conventions (follow existing)
- Vanilla JS + CSS; no new libs.
- Reuse helpers (formatMoney, unwrap, escapeHtml, crmOpportunityUrl, historyEventDate, customField* etc.).
- State in `state = { groups, ... }`; render functions are idempotent (find or create tile).
- After state change that should persist: the *ToStorage() + scheduleUserProfileSave().
- Comments for non-obvious (esp. CRM API quirks).
- Update docs (FUTURE/ISSUES/CHANGELOG) when adding/fixing.
- For new features: add to Add Tile if applicable; document in Toaster_Features/FUTURE.
- Keep changes minimal and isolated.
- On edit: prefer search_replace for precision; read first.

## Other
- Acculynx research findings live in FUTURE_FEATURES.md (do not lose them).
- When in doubt on priority: user's explicit list > FUTURE suggested order.
- For sessions: prefer resume over new. If new session, AGENTS.md + tools get you oriented fast.
- Questions during work: use ask_user_question for narrow choices.

Update this file when conventions or priorities change.

## Known agent failure mode
- Repeatedly forgets completed work (backdate HTML, changelog entries, etc.).
- Either overwrites or never commits verified changes.
- Going forward: every feature/fix must be explicitly confirmed on disk, `git status --short && git diff --stat` run, a one-line summary written here, and the CHANGELOG entry added before the session ends. No arguing; the record is the source of truth.

(Generated as part of post-1.1 work to solve repeated context gathering.)