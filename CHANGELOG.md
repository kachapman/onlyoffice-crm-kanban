# Changelog

All notable changes to the CRM Kanban dashboard are documented here.

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