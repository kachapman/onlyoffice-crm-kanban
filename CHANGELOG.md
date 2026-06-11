# Changelog

All notable changes to the CRM Kanban dashboard are documented here.

## [1.6.1] — 2026-06-11

### FEAT-003: Attachments on event notes
- Full support for attaching files (≤25 MB each) when creating event notes from Deal Edit and Quick Note (including side-by-side from preview and prefill from notes tile).
- Native CRM upload flow: client uploads via proxied UploadProgress.ashx (multipart, using current UserID), then history create uses form-urlencoded with repeated `fileId[]`.
- Text is always priority (note sent even if some/all uploads fail; per-fail error toast).
- Pre-submit selected files: plain filename (size) list with × remove (no icons).
- Right-side status list in header (near mutation-sync-status): shows pending + all completed note actions; success = checkmark, fail = ✕; completed items auto-clear after exactly 10 seconds.
- Reuses existing preview attachment rendering, queue resilience (history items), rich note editor, and currentUserId.
- Server proxy updated to correctly forward form-urlencoded (for history) and multipart (for uploads) so attachments work through the deployed dashboard (extra hop).
- Hotfix for production uploads: added `X-OnlyOffice-Portal` header to the direct `UploadProgress.ashx` fetch (was missing, causing attachments to fail on the droplet proxy while local and text notes succeeded). Confirmed working after nginx client_max_body_size + proxy buffering config.

### Additional fixes
- Mobile vertical stacking of deal preview + deal/quick-note editor: improved dynamic measurement, ResizeObserver, and constraints in `layoutSideBySideDealEditAndPreview` to prevent overlap at top when stacked.
- Hanging after deal edits and event notes (prod): deferred the preview re-open in `submitDealEditForm` (was immediate heavy fetch+render); board refreshes already deferred. (Does not happen on local test server.)
- Added version number (v1.6.1) next to "Sign out" button (in header meta, to the right of portal URL, properly spaced).
- Rolled back "show empty stages" checkbox visibility for tag-sorted groups (the change had broken group tiles rendering); now only shown for stage groupBy as before.

See AGENTS.md for implementation details. These (plus proxy support for attachments on server) are released as v1.6.1.

## [1.7.0] — 2026-06-11

### FEAT-002: Custom user fields on opportunity create (ISSUE-001 — FIXED)
- Custom fields on new opportunity create now actually persist in CRM. Root cause: `collectCreateOppCustomFieldValues()` used `[data-custom-field-id]` which matched the wrapper `<div>` (set by `renderCreateOppCustomFields`) instead of the actual `<input>`/`<select>`/`<textarea>`, so `.value` was always `undefined` and every field was silently skipped.
- Fix: finds the wrapper div by data attribute, then queries `input, select, textarea` inside it to get the real user-entered value.
- Also corrected `buildCustomFieldListForApi` to `{key, value}` format (camelCase, no duplicate `Key`/`Value` props) and added `customFieldList` to create body alongside per-field POST fallback.
- `CREATE_OPP_USER_FIELDS_ENABLED=true`. Tested and confirmed end-to-end (dashboard → proxy → CRM).

## [1.6.0] — 2026-06-10

### Post-1.4.5 bug fixes (cross-device reliability + no-UI-hang resilience)
- DM "of the day" inbox now correctly shows read/unread cross-device: `renderPresenceInbox` isUnread logic changed to only flag when *latest* message in thread is incoming (from other) and ts > lastReadDms; self-sent responses no longer make threads appear unread on other devices. Added `markPresenceDMRead` immediately after successful DM send.
- Eliminated random UI hangs / "nothing clickable" / browser "page not responding" after quick notes and other pushes: post-submit refreshes (preview + refreshGroup/refreshAll) now always deferred via setTimeout (non-blocking); same for queue processor's refreshAll on stage/due/tag mutations. History notes already skipped from full refresh.
- Status and DM read state (lastReadDms) persistence reinforced across devices and page refreshes/logins (server already persisted in per-user presence json; client now always syncs on snapshot + explicit mark on send/open; no resets except on explicit logout clearing hb).
- Mobile quick-edit from preview no longer overlaps: `layoutSideBySideDealEditAndPreview` now dynamically measures actual side card bottom + 4px gap and repositions preview top (and max-height) on mobile so borders almost touch cleanly (no hard 260px offset).

### Additional fixes
- Quick note prefill from notes tile now correctly renders as rich formatted HTML (markdown converted via `renderBasicMarkdown` into the contenteditable) + explicit clear of the editor on open. (Previously plain text/markdown would appear unformatted.)

See AGENTS.md last-session summary for details. These changes (plus the earlier proxy response handling) are now released as v1.6.0.

## [1.4.5] — 2026-06-09

### Side-by-side preview note editor (quick note / edit from preview)
- Edit note button (or quick note in preview context) now opens as a separate "side popup" to the left of the preview modal on desktop (or fixed to the top of the preview on mobile <700px width).
- Both preview (history/details) and the note editor (rich B/I/U/H formatting, tags, due, notify) remain fully interactive simultaneously (pointer-events:none on side modal container + auto on card; fixed positioning + z; preview backdrop provides dim).
- Auto-refreshes preview on successful note submit (quick note or deal-edit note) so new history event appears immediately.
- Escape in preview closes side editor first (keeps preview open).
- Added manual refresh button (⟳) in preview head (left of ✎ edit) to force re-fetch current opp preview (useful after side note or external changes).
- Delete × button now available on event note history items inside preview (only for note-category non-mail events; uses confirmDialog + DELETE /api/2.0/crm/history/{id}; re-opens preview to refresh list).

### Presence / Team: AFD (away from dashboard) status + accuracy
- "Online" = tab visible + recent heartbeat (<10m).
- "Away from dashboard" (AFD): tab backgrounded but still has active session (stale hb record, not cleared by logout; subtle slate-gray dot + "Away from dashboard (N)" section in roster).
- "Offline": signed out (manual or auto 3h) — server clears lastHeartbeat on /api/logout so immediately offline (or aged >3h).
- Auto-logout aligned to 3h (was 4h); timer + visibility listeners.
- "Last CRM (proxy):" confirmed only from real proxied /crm/ or /people/ calls (touch_crm_activity), not heartbeats.
- Roster splits Online / Away from dashboard / Offline; compact tile respects AFD dots.

### Feed / notifications: today indicator
- All notifications from the current day (local date match on it.date) now get a subtle white left border line (`.feed-item-today` + border-left: 3px solid rgba(255,255,255,0.25); adjusted padding) in the CRM notifications feed.

### Crash / 5xx resilience (CRM unreachable banner)
- On 502/5xx (or transient proxy/CRM down errors) from api() or presence: shows persistent amber crash banner on right side of header meta ("CRM is temporarily unreachable and may have crashed. Refresh again in 30 seconds or contact system administrator.").
- Banner is subtle amber (#f59e0b bg, dark #1f2937 text for readability in dark/light), non-dismissible except by successful CRM response (onCRMSuccess hides) or page reload.
- No raw error toasts for transients during crash; status stays usable.
- All tiles still render (board, feed, tasks, etc.); CRM-pulling tiles/sections show no content (empty state from failed loads) while non-CRM parts (local notes, layout) continue.
- Quick note / side edit from preview still works (local), and preview auto-refreshes on submit even during partial outage.
- 30s guidance in message; throttle via existing transient queue logic.

### Documentation & Housekeeping
- Version bumped to 1.4.5 everywhere (VERSION, AGENTS.md, README, CHANGELOG, new RELEASE_v1.4.5.md, docs/GITHUB_RELEASES.md, docs/UPDATE_AND_DEPLOY.txt, docs/DEPLOY_*.md).
- Added detailed release notes + updated AGENTS.md "Post-v1.2 shipped items" with the new UX (side preview editor + delete + refresh, AFD presence, today lines, crash banner + partial render).
- Session changes from crash sim, side note flow, delete, feed today, presence AFD all documented.
- Local server close + prod deploy checklist followed (see below).

See also [docs/RELEASE_v1.4.5.md](./docs/RELEASE_v1.4.5.md) for the full GitHub release text.

## [1.4.1] — 2026-06-08

Patch release to ensure reliable deployments after v1.4.0.

### Deployment / Docker fix
- Updated Dockerfile to explicitly `COPY presence_store.py` (along with the other .py modules). The v1.4.0 tag's Dockerfile was missing it, causing `server.py` to fail on `from presence_store import ...` at container startup. This resulted in the dashboard container crash-looping (Restarting (1)) and nginx returning 502 Bad Gateway on production deploys.
- Added verification steps and warnings in docs/UPDATE_AND_DEPLOY.txt and docs/DEPLOY notes to always check that the built image contains all required Python modules (presence_store.py is critical for the Team/Presence feature introduced in v1.3+).
- In future, any new .py modules added to server.py must be added to the Dockerfile COPY line to prevent similar post-deploy 502s.

### Documentation & Housekeeping
- Version bumped to 1.4.1.
- CHANGELOG, new RELEASE_v1.4.1.md, README, AGENTS.md, VERSION, docs/GITHUB_RELEASES.md, docs/UPDATE_AND_DEPLOY.txt updated.
- The hotfix was applied on the production droplet via local Dockerfile edit + rebuild (as the tag was already cut), then the source Dockerfile was corrected and released.

See also [docs/RELEASE_v1.4.1.md](./docs/RELEASE_v1.4.1.md) for the full GitHub release text.

## [1.4.0] — 2026-06-08

Focus on stabilizing and polishing the local kanban tile UX and the Team/Presence demo indicators + inbox read/unread cues (from extensive live testing session).

### Local Kanban fixes
- Moved editable board name up into the standard tile title bar (toolbar) like other tiles (notes/groups); removed internal name input/duplicate; now uses dataset.tileLabel + dblclick contentEditable on .tile-toolbar-title with persist + no more .tile-toolbar-title hide.
- Column edit (✎) button now left of × (delete).
- Stage column color picker now visibly updates header via `<span class="column-dot">` (always shown, not just card borders or when populated).
- Fixed "add task" inline input crash: `Uncaught NotFoundError: removeChild` (node no longer child, possibly moved in blur). Used `let submitted`, `setTimeout(0, cleanup)` + guards in blur/keydown paths for +status/+task.
- Scrapped broken column drag/reorder (draggable, 'col:' data, makeReorderDrop, body drop col handling) per request (it never worked reliably, bubbled etc.).
- Edit button for columns now includes ◀ / ▶ slide buttons to move stage left/right (array splice + rebuild + re-open edit UI).

### Presence / Team demo indicator + inbox cues
- Added (and made persistent for every new user/session) client-side demo message with concise team presence/messaging explanation (no admin mention): "Team presence shows online users (green dot + count). Click the Team button to view roster and switch to Messages tab for DMs with replies and read status."
- Blue unread bubble (top-right on Team) now reliably appears/stays on reload (sync force in ensurePresenceOnLogin + re-assert in every badge update) until user explicitly clicks the demo in inbox.
- Introduced `demoMessageReadThisSession` flag (per page load) + `!demoMessageReadThisSession` guard for forcing blue "1" and header update. Decoupled from lastRead/ts to stop on/off flashing.
- On close of team popup: header indicators refreshed so count reflects only un-clicked messages.
- Messages inbox now has clear read/unread indication via dark/light shading: `.unread` gets surface-2 + blue left border accent + blue ● dot; `.read` gets opacity fade + muted text. Demo row specially forced by session flag (always "unread" visually until clicked, with "just now (demo)" label to avoid bad timestamps).
- Demo injection always ensures example msg in inbox list (re-added after server overwrites) but respects the read flag for count + shading.
- All updates to docs, new RELEASE, session chat log.

### Documentation & Housekeeping
- Version bumped to 1.4.0.
- CHANGELOG, new RELEASE_v1.4.md, README, AGENTS.md, VERSION, GITHUB_RELEASES.md, UPDATE_AND_DEPLOY.txt, docs/SESSION_2026-06-07.md (chat history + date stamp) updated.
- Local kanban + presence live fixes from verbatim user reports fully documented.

See also [docs/RELEASE_v1.4.md](./docs/RELEASE_v1.4.md) for the full GitHub release text.

## [1.3.0] — 2026-06-07

Major live-testing follow-up focused on the new Team / Presence feature (user status, basic DMs, inbox, admin tools) plus UI polish for the modal.

### Presence / Team (new feature, completed from user verbatim list)
- Header button (users icon, secondary style, left of New Tile) opens popup instantly (early bind + no blocking await on CRM loadPortalUsers; immediate render from cache + background refresh).
- Roster: users from CRM /people (same list as notify), online (green dot + heartbeat <10m), idle (>2h amber), offline (dark), "last seen X" via formatTimeAgo for offline.
- Status: dropdown (not buttons) with "Online" default + 3 templates ("Estimating - Do Not Disturb", "AFK - Lunch", "AFK - Pesky In-laws") + Custom... (emoji support, 120 char limit). "Status:" label to left of dark-mode select. Persisted server-side.
- DMs: click any user (online or offline) to open thread; send/receive works to offline users (delivered on next login). Basic history shown.
- Inbox / message tracking: "Messages" tab (separate from Team roster) shows recent DMs (from myRecentDms) with snippets, timestamps, click-to-thread, and × clear/archive per conversation. Thread also has Clear button. Backend uses per-convo JSON files under data/presence-messages/.
- Read receipts: "read" indicator appears on your sent messages once recipient opens the thread.
- Reply to message: click any prior message in thread to reply; quoted context shown in smaller font (with "Replying to:") above your text in the bubble (Signal/WhatsApp style). reply_to + reply_text carried in messages.
- Emoji selector: 😊 button in DM input opens compact picker; inserts at cursor. Messages support Unicode emojis.
- Color coding: received messages always green bubble; your sent messages use current accent color. Per-direction (1:1 DMs).
- Self-online indicator on header button: green dot (`.is-online::before`) even when alone (separate from count badge). Red pulsing flash (`.has-waiting-messages::after`) for unread DMs (separate from online count).
- Admin section (kenc@vanguardadj.com only): shows last CRM/dashboard activity minutes. Hidden by default with "Admin" toggle button in actions bar; button only visible on Team tab (not Messages tab); "Admin" text when hidden.
- Popup polish: taller messaging areas (.presence-list and .presence-dm now 480px max), message viewing area (#presence-dm-log) has min-height + larger font for more history visible at once. Entire popup window is now user-resizable (resize: both + min/max on #presence-modal .modal-card; only this modal affected).
- Reliability: direct presenceFetch (with X-OnlyOffice-Portal header) so /api/presence/* routes (users, snapshot, status, dm get/post, heartbeat, clear) are hit instead of proxy fallback. Routing hardened with early startswith checks + explicit 404 for unknown presence paths. No more generic "Failed" / 404s once server restarted.
- (Note: one remaining live bug with reply context not always rendering in sent history bubbles is paused per explicit request; core reply send/receive + preview + embedded text works.)

### Documentation & Housekeeping
- Version bumped to 1.3.0.
- CHANGELOG, new RELEASE_v1.3.md, README, AGENTS.md, VERSION, GITHUB_RELEASES.md updated.
- All presence-related live feedback (instant button, no errors, default Online, Status: label + dark select, online/offline + last seen, full inbox with delete, indicators, admin hidden+tab-only, taller/resizable popup, replies+emojis+colors+reads) documented.
- Reply context display bug in chat history explicitly noted as paused.

Full details in conversation history and source (public/app.js renderPresence* + openPresenceDMThread, presence_store.py, server.py handlers, styles.css presence rules).

See also [docs/RELEASE_v1.3.md](./docs/RELEASE_v1.3.md) for the full GitHub release text.

## [1.2.0] — 2026-06-06

Post-v1.1.0 testing follow-up release. All items from the explicit post-deploy list plus live feedback (collapse behavior, keyword semantics, template UX, tasks list modal, crash banner polish, styling, icon, docs) were implemented, tested, and shipped.

### Presence / Team follow-ups (from live session feedback)
- Presence button now opens instantly (removed blocking CRM `loadPortalUsers` await; immediate render from cache + background refresh).
- DM "click user", send, and status change no longer error ("Could not load messages" / "unable to send" / "could not set status"). Root cause: direct presence fetches now send `X-OnlyOffice-Portal` header (via new `presenceFetch` helper) so server resolves portal the same as profile/proxy calls.
- Default status "Online" (picker pre-selects it; list suppresses the literal "Online" text for roster cleanliness).
- "Status:" label to left of dark-mode `<select>` (uses `--surface-2` etc); sections "Online (n)" / divider / "Offline (n)" + "last seen X" for offline rows already wired.
- Inbox / message tracking: modal now shows "Recent messages" section (from `myRecentDms` in snapshot) with per-convo snippets, timestamps, click-to-open thread (works for offline users), and × clear per row. Thread view also has "Clear" button. Backend: `clear_conversation`, DELETE `/api/presence/dm?with=...` wired + store unlink.
- Self-online indicator: green dot on the header presence button icon (`.is-online::before`) driven by snapshot; visible even when you are the only one (separate from count badge and red "waiting messages" flash).

### Fixes & Polish
- **Tile collapse & minimize (notes, calendar, groups)**: Notes and calendar tiles now properly collapse (body content hidden while toolbar remains); added CSS overrides to defeat tile-specific min-heights. Calendar double-height now scales the month grid vertically (body flex + grid + day min-heights). CRM group tiles support half/quarter width while collapsed (minimized bar stays narrow).
- **Group removal persistence**: Removing a group tile now calls `saveUserProfileToServer({quiet:true})` immediately so the deletion survives quick reloads.
- **Tasks rows**: Description is now shown (`.task-desc`, truncated in compact rows) alongside title, using the same patterns as other task rendering.
- **CRM notifications keyword filter**: Switched from OR to strict **AND** semantics for comma-separated keywords. Input is split on `,`, trimmed; a notification matches only if *every* token is present in the blob (`tokens.every`). Single keyword continues to work. Placeholder text updated to reflect inclusive/AND behavior.
- **Preview modal persistence**: Launching "edit" from the opportunity preview no longer auto-closes the preview; after save the preview data is refreshed in place.
- **Favicon / logos**: Updated to the white ship variant for better contrast and visibility across themes.
- **Linked email errors**: "Message ... wasn't found" cases in opportunity preview now show a friendly message instead of the raw error.
- **Tasks list modal styling**: Light backgrounds (body #ffffff, rows #f8f9fa with hover, done state dimmed + strikethrough), high-contrast text (#212529), muted meta, explicit header contrast for readability. Accent color on checkboxes.
- **CRM backend crash / 5xx banner**: Fully implemented. `api()` wrapper detects `!res.ok && status >= 500` (or JSON parse failure) on paths containing `/crm/` and calls `showCrmCrashNotification()`. Banner uses the exact requested wording: "OnlyOffice CRM backend error (e.g. 502 on history). Dashboard may be out of date. Refresh page now — recommended in ~30 seconds." Includes "Refresh page now" button (location.reload()). Throttled (~15s), role=alert, sticky. Any successful CRM-path response auto-clears it. Testable by DevTools Network throttling or blocking /api/proxy/api/2.0/crm/* .

### Features / Enhancements
- **Full tasks list modal**: New discreet button (minimalistic light file-cabinet SVG icon) placed in the tasks panel header (flex layout, left of the user filter). Opens `#tasks-list-modal`. 
  - Fetches open tasks (`isClosed=false`) + completed (`isClosed=true`) and merges.
  - "Show completed" toggle re-renders the filtered set.
  - Each row: checkbox (close/reopen via POST /close or /reopen with optimistic update + re-render), title (deep link via existing `crmTaskUrl`), due date, responsible person.
  - "New Task" footer button opens the existing create-task modal.
  - Matches existing task row/checkbox/close patterns; reuses profile schedule + api wrapper.
- **Group templates — delete only**: Replaced the prior "manage/edit + delete via prompts" with a clean delete-only experience. New `openTemplateDeleteModal()` lists every saved template across all groups; each entry has an × button. Click → confirm → remove from the group's templates array → `saveUserProfileToServer` → refresh all group template `<select>` elements and the list itself. Toolbar button on groups updated to open the delete modal. No rename/edit paths remain.
- **Tasks list icon**: Final icon is a minimal, light, stroke-based file-cabinet SVG (after iterations from emoji); placed inside the header construction for the new button (`id="tasks-list-btn"`).

### Documentation & Housekeeping
- **AGENTS.md** (new root file): Persistent project context loaded automatically. Covers architecture summary, key reuse patterns (profile, api(), tile renderers, modals, attachTileCollapseButton, etc.), the exact post-1.1 user list, run/test/deploy commands, and instructions to prefer `/load` or welcome picker + `cd` first instead of full context dumps on every session.
- Removed the entire FEAT-009 (CRM CRASH notification) section from FUTURE_FEATURES.md (the banner was already implemented and shipped; kept only the implementation recap in conversation for testing guidance).
- CHANGELOG, RELEASE notes, README, GITHUB_RELEASES.md, AGENTS.md, and VERSION updated for v1.2.0.
- AccuLynx API research (FEAT-008) remains in FUTURE_FEATURES.md under "Other ideas" (added earlier per request; not implemented).

Custom fields (ISSUE-001) research artifacts from pickup remain disabled and are not part of this release. See AGENTS.md and FUTURE_FEATURES.md for current roadmap.

See also [docs/RELEASE_v1.2.md](./docs/RELEASE_v1.2.md) for the full GitHub release text.

## [1.1.0] — 2026-06-05

See also [docs/RELEASE_v1.1.md](./docs/RELEASE_v1.1.md) for the full GitHub release text.

### Fixes
- CRM notifications feed empty after pagination refactor — restored bulk history + mail loading.
- Feed no longer shows “no events” while mail/history is still loading.
- Hidden notifications: server-backed entries with snapshots; restore via toolbar modal.
- Archived notes tiles no longer auto-deleted from server profile.
- Removed non-working archived-notes UI from **Add tile** (moved to notes **File** menu).
- Group profile saves omit embedded opportunity lists (refetch on expand).

### CRM notifications (new / improved)
- **90-day** feed window (was 30).
- **200-event** load cap.
- Loading spinner in feed header; scroll to load more (until cap).
- 5-minute in-session feed cache.
- Hidden-notifications manager (hide per item, review/restore, 30-day retention).

### Notes tiles (new / improved)
- Server persistence per user; archive retained on server.
- **File** menu: `.txt` / `.md` export, archive, duplicate, **restore from archive** (by date → fills current note).
- Presets: **Daily**, **Claim checklist** (CRM checkbox fields).
- Quarter width; Edit/Preview; icon toolbar; save footer (time + stats).
- Removed link-deal from notes; **Daily Standup** renamed to **Daily**.

### Dashboard performance
- Minimized tiles skip CRM fetches until expanded.
- Parallel login bootstrap; deferred per-card custom-field enrichment (`IntersectionObserver`).

### UI
- **Red X** remove icon (groups, calendar, notes).
- **Save template** floppy-disk icon on groups.
- Minimize + icon-based layout controls on all tiles.
- Kanban card **preview** → opportunity preview modal.

---

## [1.0.0] — 2026-06-05

First production-ready release on GitHub.

### Core dashboard
- OnlyOffice CRM kanban with opportunity groups (stage/tag filters, templates, red-deal filter).
- Pinned **CRM notifications** and **Tasks** panels with layout controls.
- Global opportunity search in the header.
- Create opportunity and quick-note modals; deal edit from cards.

### Tiles
- **Add tile**: opportunity groups, calendar (ICS feed), notes.
- Per-user dashboard profile on server (`/api/user-profile`): groups, layout, calendars, notes, feed keyword, hidden feed keys.
- Calendar monthly view with timezone selector and event detail modal.

### Deploy & ops
- Docker Compose deploy to DigitalOcean (`dashboard.vanguardadj.com`).
- GitHub Actions deploy workflow; production server notes and estimate-nginx network in compose.
- Documentation: `DEPLOY.md`, `docs/UPDATE_AND_DEPLOY.txt`, `docs/PRODUCTION_SERVER_NOTES.txt`.