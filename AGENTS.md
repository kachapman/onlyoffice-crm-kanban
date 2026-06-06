# AGENTS.md — Vanguard CRM Kanban Dashboard (onlyoffice-crm-kanban)

**Current version:** 1.2.0 (see CHANGELOG.md, docs/RELEASE_v1.2.md)  
**Production:** https://dashboard.vanguardadj.com  
**Repo:** https://github.com/kachapman/onlyoffice-crm-kanban (or local)

This file is auto-loaded by Grok into the system prompt for every session in this directory tree. It provides persistent project context so you do **not** need a full "pick up where we left off" explanation or complete re-exploration on every new session. (See also user-guide 12-project-rules.md and 17-sessions.md.)

**Always:** 
- Resume prior work via TUI welcome screen (recent sessions for this cwd), `/load`, `grok --resume <id>`, or `-c` (continue most recent). Chat history + prior state is preserved in `~/.grok/sessions/...`.
- Still use tools (list_dir / read_file / grep / run_terminal_command for git etc.) to inspect *current* code state — files + docs are the source of truth.
- For new sessions: `cd /home/zionad/crm-kanban` first (sets workspace/cwd for rules + session grouping).

## Project Overview & Architecture (high level, reuse these)
- Vanilla JS dashboard (no framework) + Python proxy for OnlyOffice CRM (Community Server / Workspace).
- **Frontend (public/):** 
  - index.html (modals, tiles, chrome)
  - app.js (main; state, rendering, api wrapper, profile sync, modals for deal-edit/create/quick-note/preview, group kanban, feed, tasks, calendars, notes)
  - styles.css
  - Static assets (favicons, ship logos)
- **Backend (dev/prod proxy):** server.py (proxies /api/proxy/* to portal, handles /api/user-profile, /api/calendar/feed, /api/dashboard-notes, auth via oo_token cookie).
- **Persistence (per CRM user + portal):** 
  - user_profile_store.py (data/user-profiles/.../*.json; versioned; supports groups, calendarTiles, notesTiles, groupTemplates, tileLayout, hiddenFeedKeys, feedKeywordFilter)
  - notes_store.py (for notes tiles content)
  - LocalStorage fallbacks + debounce server saves (scheduleUserProfileSave).
- **Tiles:** Opportunity groups (kanban with filters/stages/tags/red), fixed panels (feed/notifications, tasks), addable (calendars ICS, notes markdown). See Toaster_Features for ideas.
- **Key patterns to ALWAYS reuse:**
  - Profile: buildUserProfilePayload, applyUserProfile, loadUserProfileFromServer (prefers server), saveGroupsToStorage/scheduleUserProfileSave/saveUserProfileToServer, strip*RuntimeFields.
  - Tiles/layout: bindTileChrome, applyTileBodyCollapsed/applyTileLayoutClasses, createLayoutButtons, attachTileCollapseButton, tileLayout in state.
  - API: `api(path, opts)` + parseApiError (throws on !ok); all CRM calls go through /api/proxy + X-OnlyOffice-Portal header.
  - Errors: showToast(msg, true); upgrade CRM 5xx to crash notifier.
  - New tile type (if adding): follow checklist in Toaster_Features (add to HTML+JS chooser, persist in profile py + frontend, refresh policy, empty states, update docs).
  - Modals: reuse .modal / .modal-card / backdrop / data-*-dismiss / escape; openDealEditModal, confirmDialog.
  - History/feed: unwrapHistoryEvents, /api/2.0/crm/history/filter (entityType=opportunity), applyFeedKeywordFilter.
  - Groups: fetchOpportunitiesForGroup + buildFilterQuery, renderCard, setupGroupToolbar (templates, remove, filters).
  - After mutations: renderXXX() + scheduleUserProfileSave() + optional refreshAll() or loadXXX().
- **Custom fields on create (ISSUE-001/FEAT-002):** Partial changes landed (CREATE_OPP_USER_FIELDS_ENABLED=false; create omits customFieldList; 300ms delay before per-field POSTs; probe script has variants A/B). UI disabled. Do **not** enable or change without explicit user request + live verification (native capture + probe + end-to-end in CRM). See ISSUES.md + FUTURE_FEATURES.md.
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

See CHANGELOG.md and docs/RELEASE_v1.2.md. Custom fields research remains disabled. AccuLynx research stays in FUTURE_FEATURES under Other ideas (not implemented). 

For the previous post-v1.1 list and implementation notes, consult the git history / session artifacts around the v1.2 commits.

Legacy open items (lower priority unless asked): complete custom fields (verify + enable), FEAT-003 attachments, new toasters (stale deals, closing this week, etc.), FEAT-022 docs tile.

## How to Run / Test / Deploy
- **Dev:** `./start.sh` (or python3 server.py after sourcing .env with ONLYOFFICE_PORTAL_URL). Opens http://127.0.0.1:8765. Login flow sets oo_token cookie for proxy.
- **Test changes:** Browser + DevTools (Network for proxy/crm calls, reload for persist). Have test groups, tasks (with desc), history (incl. mail links), calendars, templates. Verify per-item in approved plan (persist by quick reload, crash via network override, etc.).
- **No tests:** No automated suite; manual + visual.
- **Deploy:** See docs/UPDATE_AND_DEPLOY.txt (git push, server pull/build, verify steps in docs/DEPLOY_v1.1_VERIFY_STEPS.md). Use scheduleUserProfileSave for user data safety.
- **Debug:** server.py logs (some suppressed for GET /api), browser console, `grep` for the thing, read the exact function.
- **Profile data:** data/user-profiles/... (gitignored); survives restarts.

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

(Generated as part of post-1.1 work to solve repeated context gathering.)