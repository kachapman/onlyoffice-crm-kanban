# AGENTS.md — Vanguard CRM Kanban Dashboard (onlyoffice-crm-kanban)

**Current version:** 1.90.0 (see CHANGELOG.md)  
**Last session summary (for next resume):** Domain migration to publicadjustermidwest.com in progress. v1.90.0 pushed and tagged; dashboard droplet is checked out at tag v1.90.0 in detached HEAD. Production .env still points to old domain so CRM access remains live. DNS already propagated. Notification mail-cache work (v1.88.0) was rolled back and removed from main. Next task: execute CRM droplet cutover — recreate onlyoffice-community-server container with LETS_ENCRYPT_DOMAIN=office.publicadjustermidwest.com and update portal domain in CRM settings. See docs/CUTOVER_RUNBOOK.md section 2 and docs/MIGRATE_DOMAINS.md Appendix A for exact commands. Ubuntu OS updates on CRM server are postponed until after migration is stable.

This file is auto-loaded by Grok into the system prompt for every session in this directory tree. It provides persistent project context so you do **not** need a full "pick up where we left off" explanation or complete re-exploration on every new session. (See also user-guide 12-project-rules.md and 17-sessions.md.)

**Always:** 
- Resume prior work via TUI welcome screen (recent sessions for this cwd), `/load`, `grok --resume <id>`, or `-c` (continue most recent). Chat history + prior state is preserved in `~/.grok/sessions/...`.
- Still use tools (list_dir / read_file / grep / run_terminal_command for git etc.) to inspect *current* code state — files + docs are the source of truth.
- For new sessions: `cd <project-root>` (sets workspace/cwd for rules + session grouping).

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
   - Errors: showToast(msg, true) only for non-transient; 5xx/unreachable now shows persistent right amber crash banner (text: "CRM is temporarily unreachable and may have crashed. Refresh again in 30 seconds or contact system administrator."); onCRMSuccess() hides it. Tiles always render (CRM pulls show empty content).
  - New tile type (if adding): follow checklist in Toaster_Features (add to HTML+JS chooser, persist in profile py + frontend, refresh policy, empty states, update docs).
  - Modals: reuse .modal / .modal-card / backdrop / data-*-dismiss / escape; openDealEditModal, confirmDialog.
  - History/feed: unwrapHistoryEvents, /api/2.0/crm/history/filter (entityType=opportunity), applyFeedKeywordFilter.
  - Groups: fetchOpportunitiesForGroup + buildFilterQuery, renderCard, setupGroupToolbar (templates, remove, filters).
   - After mutations (incl. note create/delete from side editor): renderXXX() + scheduleUserProfileSave() + optional openOpportunityPreviewModal refresh for side context.
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

## How to Run / Test / Deploy
- **Dev (normal):** `cd ~/crm-kanban && cp -n config.example.env .env && ./start.sh` (or `python3 server.py`). Opens http://127.0.0.1:8765. Login with your OnlyOffice CRM credentials (sets the `oo_token` cookie used by the proxy).
- **Special test server (for mutation queue / offline resilience testing):** `python test-server.py`. This version supports controllable chaos mode (via `/api/test/chaos`) so you can simulate 5xx errors, delays, and network problems. (The client-side mutation queue / offline resilience is a completed implementation.)
- **Test changes:** Browser + DevTools (Network tab for proxy/crm calls, Application → Local Storage for queue/profile, offline mode or the test server's chaos toggle). Always test both happy path and failure/retry scenarios for any new resilience code. Have test groups, tasks (with descriptions), history events, etc.
- **No tests:** No automated suite; manual + visual + simulated failure testing.
- **Deploy:** See docs/UPDATE_AND_DEPLOY.txt (stop local server, edit, test locally, git commit + push). Then on the production droplet follow the safe pull + rebuild steps in docs/DEPLOY_v1.1_VERIFY_STEPS.md. Never skip the VERIFY blocks.
- **Debug:** server.py (or test-server.py) logs, browser console, `grep` in the codebase, read the exact function. The mutation queue processor runs in the browser (localStorage + background timer + online/visibility listeners).
- **Profile data:** `data/user-profiles/...` (gitignored); survives restarts on both local and production.

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