# Changelog

All notable changes to the CRM Kanban dashboard are documented here.

## [1.2.0] — 2026-06-06

Post-v1.1.0 testing follow-up release. All items from the explicit post-deploy list plus live feedback (collapse behavior, keyword semantics, template UX, tasks list modal, crash banner polish, styling, icon, docs) were implemented, tested, and shipped.

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