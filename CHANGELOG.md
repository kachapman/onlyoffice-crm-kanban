# Changelog

All notable changes to the CRM Kanban dashboard are documented here.

## [1.88.0] — 2026-06-23

### Server-side notification cache — reliable CRM mail-based feed

- **New `notification_store.py`:** Per-user persistent cache at `data/notifications/<portal>/<user_id>.json`. Stores parsed CRM notification emails for 30 days, capped at 500 per user. Atomic writes, deduplication, pruning.
- **Background fetcher:** Server fetches CRM mail messages (`/api/2.0/mail/messages`) with subject search `"CRM. New event added to"` in a background daemon thread. Falls back to CRM history events as backup. Runs every 5 minutes and on mutation invalidation. Per-user threading lock prevents concurrent fetches.
- **New server endpoints:**
  - `GET /api/notifications?keyword=...` — returns cached, keyword-filtered, hidden-filtered notifications instantly. Triggers background refresh if cache is stale (>5 min).
  - `POST /api/notifications/refresh` — forces background refresh, returns 202 immediately.
  - `GET /api/notifications/status` — returns `{isFetching, lastFetchAt, eventCount, fetchError}`.
- **Mutation invalidation:** CRM history mutations (`/crm/history*`) mark the notification cache stale so the next read triggers a background refresh.
- **Client simplification:** Feed tile now calls `/api/notifications` instead of CRM history API directly. Keyword filter is applied server-side. Client-side 5-minute cache removed (server owns freshness). 60-second polling while dashboard is visible.
- **Keyword input:** Debounced (400ms) server re-fetch on keystroke instead of client-side filter.
- **Files changed:** `notification_store.py` (new), `server.py`, `public/app.js`, `VERSION`, `CHANGELOG.md`

## [1.87.4] — 2026-06-23

### Event log + indicator stacking + deal-edit optimization + refreshing spinner

- **Event log:** New header button (clipboard-list icon) opens a persistent event log modal showing all recent deal edits, note saves, attachment uploads, and deletes with timestamps. Persisted in localStorage (max 200 entries). Includes clear-all button.
- **Indicator overlap fix:** `#toast` (z-index 2003), `#note-queue-list` (z-index 2002), and `.crm-sync-status` (z-index 2001) now stack vertically without overlapping — sync-status moved to `bottom: 3.5rem` (above toast at 1.5rem), note-queue at `bottom: 5.5rem` (left side). When bookmark sidebar or a modal blocks the right side, toast and sync-status shift to the left; note-queue stays left always. CSS `.bookmark-open` rules handle the sidebar case; JS `repositionRightIndicator()` handles modals.
- **Optimized deal-edit submission:** Replaced 3 separate GET+PUT cycles (due date, stage, custom fields) with a single `updateOpportunityBulk()` call. Attachment uploads now run in parallel (`Promise.all`) instead of sequential. Dynamic close timer: base 2.5s + 0.5s per MB of attachments (prevents premature modal close during large uploads). Tag operations throttled to 150ms between sequential calls.
- **Refreshing indicator:** After deal-edit or quick-note save, the status bar now shows a persistent "Refreshing CRM data..." spinner during deferred board/preview refresh work (instead of going silent). Spinner hides when all deferred operations complete. Sequential promise chains prevent main-thread contention.
- **Improved attachment upload response parsing:** Multiple extraction strategies (raw JSON, HTML-wrapped extraction, field fallbacks) with more robust error messages.
- **Server timeout:** `urllib.request.urlopen` timeout increased to 120s for large file uploads.
- **Files changed:** `public/app.js`, `public/index.html`, `public/styles.css`, `server.py`, `VERSION`, `CHANGELOG.md`

## [1.87.5] — 2026-06-23

### Presence hardening — smart heartbeat + beforeunload + auto-status write-back + stale cleanup

- **Smart heartbeat (visible flag):** Heartbeats now include a `visible` flag — `send()` sends `{visible: true}` when the tab is focused, `sendBeacon()` sends `{visible: false}` on background tab / beforeunload. Server only bumps `lastDashboardActivity` when `visible=True`, so auto-status expires naturally after 5 min of background-tab inactivity instead of staying alive indefinitely.
- **Beforeunload handler:** Tab/window close now sends `navigator.sendBeacon` with `{offline: true}` so the server marks the user offline immediately instead of 10+ min later. Cleaned up in `stopPresenceHeartbeats`.
- **Auto-status write-back:** When the server filters out a stale `autoStatus` (>5 min) from the response, it now also writes the cleared value to disk via `clear_auto_status()`. Prevents stale values from persisting across sessions when the client's 5-min timeout never fires (browser closed unexpectedly).
- **Stale record cleanup:** `clean_stale_presence_records()` iterates all presence files and clears `lastHeartbeat` + `autoStatus` for records with heartbeats >3h old. Called on each presence GET. Handles edge cases from closed browsers that never sent beforeunload.
- **High Priority amber styling on bookmark sidebar tabs:** `.bookmark-tab--high-priority` CSS class with same amber treatment as card tiles — `rgba(240,180,41,0.08)` background, `var(--warn)` border, 3px amber left accent. `renderBookmarkTabs()` detects High Priority tag via `oppHasTag()`, checking deal `_cachedData` then falling back to group opportunities.
- **Files changed:** `presence_store.py`, `public/app.js`, `public/styles.css`, `server.py`, `VERSION`, `CHANGELOG.md`

## [1.87.6] — 2026-06-23

### Chunked card rendering + initial-load responsiveness

- **Chunked card rendering:** `renderGroupBoard` now renders cards in batches of 20 with `setTimeout(0)` between batches, yielding the main thread so the event loop can service clicks (e.g. changelog modal close button) during initial load. Column shells (headers + empty bodies) are appended to the DOM immediately so the kanban layout is visible before cards populate progressively. Previously, all cards in a group were created in one synchronous loop — with 3 groups × 500 deals this blocked the main thread for seconds, triggering the browser's "page unresponsive" warning.
- **Changelog delay increased:** `maybeShowChangelog` delay raised from 300ms to 1500ms so the modal appears after the worst of the tile rendering is underway, not competing for main thread time during the initial render burst.
- **Files changed:** `public/app.js`, `public/index.html`, `VERSION`, `CHANGELOG.md`

## [1.87.3] — 2026-06-19

### Hotfix: CRM-down resilience + inbox shows all conversations + tag-column/stale-column fixes

- **CRM-down resilience — presence user ID cache:** `_fetch_crm_user_id` called the CRM on every request — when CRM goes down, `_require_auth` fails for all presence endpoints, killing team view and messaging entirely. Added `_crm_user_id_cache` dict (token → user_id) so the first call caches the result; subsequent requests bypass CRM. Logout clears the cache entry.
- **CRM-down resilience — overlay-only users in snapshot:** When the CRM people API is unreachable, the presence snapshot now includes users with heartbeat records in the local store (with `displayName: uid` fallback), so the team view shows active users even without CRM data.
- **Inbox shows all conversations:** `get_recent_dms_for_user` previously returned the 50 most-recent messages globally — a single thread with 50+ messages after "Load earlier" would crowd out every other conversation. Rewritten to return the **latest message per conversation partner**, ensuring each distinct person appears at most once in the inbox regardless of thread depth.
- **DM back button + tab switching:** Back button now renders inbox instantly from cached snapshot then background-refreshes. Messages tab hides the DM thread and clears `presenceSelectedUserId` before rendering inbox, fixing overlap/empty-state issues.
- **Stale tag columns:** `groupOpportunities` auto-detect path filters out tags not in `state.allTags` before creating columns; opps with only stale tags fall to "Untagged".
- **Null-guard in `updateAllCardCopies`:** Added `if (!boardEl) return;` guard to prevent crash when the group tile DOM is not present during targeted card update.
- **Files changed:** `presence_store.py`, `public/app.js`, `server.py`, `VERSION`, `CHANGELOG.md`

## [1.87.2] — 2026-06-18

### Hotfix: Mobile emoji picker + auto-status server expiration + bookmark backdrop + batch tag search + search result enhancements

- **Emoji picker on mobile:** `showPopupEmojiPicker()` and `showInlineEmojiPicker()` now detect narrow viewports (< 480px) and position the picker full-width below the message input area (left+right anchored), so it opens to the left and doesn't block the textarea or get cut off.
- **Auto-status server-side expiration:** Server now strips `autoStatus` from presence responses when the user is not online or `lastDashboardActivity` is older than 5 minutes (client-side timeout may not have fired if the browser was closed). Added `PRESENCE_AUTO_STATUS_TIMEOUT_S = 300` constant. Same check applied to the caller's own `me` record.
- **Bookmark sidebar preview backdrop:** New `.bookmark-preview-backdrop` overlay (rgba black 55%, z-index 1499) shown when a bookmark preview tab is active, matching the dimming behavior of other modals.
- **Batch tag fetching:** New server endpoint `GET /api/batch-opportunity-tags?ids=1,2,3` fetches tags for multiple opportunities in parallel server-side (`ThreadPoolExecutor`). Client's `enrichOpportunitiesTags()` now calls this batch endpoint first, falling back to individual requests if it fails. This eliminates the N+1 bottleneck in tag search.
- **Search result bookmark ribbon:** Each search result row now has a bookmark toggle button (bookmark ribbon SVG) to the left of the "+ Tab" button. `refreshAllBookmarkButtonStates()` updates these buttons alongside existing bookmark buttons.
- **Search result CSV export:** "📋 Export CSV" button at the bottom of search results downloads a CSV with columns: Deal Title, Stage, Due Date, Contact, Bid Value. UTF-8 BOM included for Excel compatibility.
- **Files changed:** `public/app.js`, `public/index.html`, `public/styles.css`, `server.py`, `VERSION`, `CHANGELOG.md`

## [1.87.1] — 2026-06-17

### Hotfix: Cross-user cache contamination + date timezone shift

- **Root cause — proxy cache key missing user identity:** `_cache_key` in `server.py` used only `method:api_path:query:portal`, so one user's CRM filter results were served to other users within the 30-second TTL. This caused users to see wrong deal counts, stale due dates, and other users' personalized data. Fix: added session token to cache key so each user's data is segregated.
- **Date-only parsing for expectedCloseDate:** `new Date(raw)` on the CRM's timezone-qualified ISO string caused a one-day date shift in negative UTC offset timezones. Added `parseCrmDateOnly()` helper that extracts `YYYY-MM-DD` and builds a Date at local midnight. Applied in 6 consumers: `isRedOpportunity`, `formatOppDueLabel`, `dueDateToInputValue`, `formatPreviewDueDate`, `oppDueDateMs`, and bookmark tab due label. No changes to datetime fields (notes, feed, calendars, tasks).
- **Force refresh after mutations:** Changed 4 mutation fallback calls from `refreshGroup(group)` to `refreshGroup(group, { force: true })` so the client-side 30-second cache is bypassed after edits/deletes, ensuring the group UI immediately reflects the change.
- **Files changed:** `server.py`, `public/app.js`, `VERSION`, `CHANGELOG.md`

## [1.87] — 2026-06-17

### Presence auto-status fixes & enhancements
- **Root cause — auto-status not displaying:** `updateInferredStatus` was changed to send `{ autoStatus: text }` only, but the server and rendering expected `{ status, autoStatus, inferred }`. This broke both new-server rendering (no auto-status shown) and old-server compatibility (empty string rejected as 400).
- **Fix — dual-compat payload:** `updateInferredStatus` now sends `{ status: text, autoStatus: text, inferred: true }` — the server stores both fields, new server renders auto-status on the right, old server reads `status` directly. The tile "Online" option value was changed from `""` to `"Online"` so old server accepts it. `syncTileStatusSelect` uses strict `inferred === true` and falls through gracefully for old server (undefined).
- **DND / manual status preservation:** `confirmCustomStatus` for a manual set now sends `{ status, inferred: false, autoStatus: "" }` and sets `state._suppressAutoStatus = true` to block auto-status overwrites. Clearing to "Online" sends `{ status: "Online" }` (no autoStatus) and re-enables auto-status. Auto-status never overwrites a manually-set DND.
- **AFK auto-clear race condition:** `noteDashboardActivity` fires on every mousedown. When it detected AFK and sent `{ status: "Online", autoStatus: "" }`, it could race with `updateInferredStatus` and wipe out the auto-status. Fix: AFK clear now sends `{ status: "Online" }` **without** `autoStatus` so the server preserves whatever `updateInferredStatus` set. Added `_afkClearSent` debounce to only send once per AFK cycle.
- **Auto-status timeout:** New `PRESENCE_AUTO_STATUS_TIMEOUT_MS = 300000` (5 min). When `updateInferredStatus` sets a preview/edit/note auto-status, a timeout is scheduled. If no new activity fires within 5 minutes, the auto-status is cleared (sends `{ autoStatus: "" }`) so it doesn't look like the user is still reviewing the same deal.
- **Bookmark & search preview auto-status:** `updateInferredStatus("preview", title)` now fires when opening a deal from the bookmark sidebar (`activateBookmarkTab`) and when opening/switching search popup preview tabs (`openSearchPreviewTab`).
- **Presence rendering adaptive:** Tile and popup rendering detect `serverHasInferred` per row. New server shows manual `(DND)` in bold next to name, auto-status on the right. Old server falls back to showing all non-"Online" statuses on the right.
- **`set_status` preserves autoStatus:** Server-side `presence_store.set_status` now only writes `autoStatus` when explicitly provided (`autoStatus is not None`), never clobbering it with `None`/default.
- **`_suppressAutoStatus` guard:** New state flag blocks `updateInferredStatus` when a manual status (DND, AFK) is active. Reset on AFK clear or manual clear to "Online".
- **Popup status picker compatibility:** Uses same payload patterns as the tile (`{ status: "Online" }` for clear, `{ status, inferred: false, autoStatus: "" }` for manual). Added `_suppressAutoStatus` integration.
- **Error toast removal:** All `showToast` calls removed from presence fetch error handlers — failures are silent.
- **Files changed:** `public/app.js`, `public/styles.css`, `server.py`, `presence_store.py`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`

### Bookmark tab card styling
- Added `border: 1px solid var(--border)`, `border-radius: 6px`, stronger `box-shadow`, and increased `margin-bottom` to 4px on `.bookmark-tab` so each bookmark card stands out as its own card.
- **Files changed:** `public/styles.css`

### Preview collapse chevron
- Added a right-facing chevron button (matching the bookmark sidebar toggle) to the left of the deal title in the bookmark preview header. Clicking it calls `closeBookmarkPreview()` — same behavior as clicking the active deal name tab.
- **Files changed:** `public/index.html`, `public/app.js`

## [1.85] — 2026-06-16

### Bookmark sidebar — collapsible right sidebar with bookmarked deal previews
- **Feature:** Vertical bookmark trigger tab on right edge (one-letter-per-row "Bookmarks" text). Click opens a sidebar with deal tabs.
- **Bookmark button:** Ribbon icon on every deal card (bottom-right) and search popup preview headers. Filled = bookmarked, outline = not. Click toggles state.
- **Sidebar:** 220px strip with vertical deal tabs showing stage dot, title, stage name, due date. Filled ribbon icon on each tab removes bookmark. Drag-and-drop reordering of tabs. Max 15 bookmarks.
- **Preview panel:** 880px deal detail preview (standard fields, user fields, description, history, documents) using same renderer as modal preview. Refresh button, edit button (opens edit modal to the left), filled ribbon to remove bookmark.
- **Persistence:** Bookmarks survive logout/login via localStorage + server user profile.
- **Edit button:** Opens the deal edit modal positioned to the left of the sidebar preview so both are visible simultaneously.
- **Tab shadows:** Subtle box-shadow + margin on each tab for visual distinction.
- **Sidebar toggle:** Chevron-right arrow (not filled ribbon). Preview panel expands left of the strip.
- **Files changed:** `public/index.html`, `public/app.js`, `public/styles.css`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`

## [1.8.2] — 2026-06-15

### Search popup — large modal with tabbed deal preview
- **Feature:** New search button in the header (magnifying glass icon, `btn-secondary`, left of the existing search field). Opens a large modal with a search bar and results list.
- **Search:** Searches all open deals (`stageType=0`) via `/api/2.0/crm/opportunity/filter?filterValue=...`. Results are enriched with tags. Search triggers on Enter key press.
- **Results list:** Compact single-line rows showing: deal title (bold), stage · due date · contact · bid value. Inline buttons: "Preview" (opens a tab) and "Open in CRM" (new tab).
- **Preview tabs:** Max 5 tabs. Each tab shows the full deal preview (standard fields, user fields, description, history & notes, documents) using the exact same rendering as the existing preview modal. Each tab has a deal title and a × close button.
- **Search tab:** Always present, styled with a left accent border and search icon. Clicking it returns to the search results.
- **Edit button:** Inside each preview tab, top-right. Opens the deal edit modal pinned to the left (same behavior as the existing preview modal).
- **Refactoring:** `renderOpportunityPreviewBody()` now delegates to `renderOpportunityPreviewContent(container, data)` — the same rendering logic works in both the old modal and the new popup tabs.

### Bug fixes
- **Tab content shrinking on switch:** `activateSearchPopupTab()` used a broad selector `[data-tab-content]` that accidentally matched the inner Details/Documents tabs inside the preview body. Switching outer tabs hid both inner tabs, making the preview appear empty/shrunken. Fix: selector narrowed to `.search-popup-tab-content` only.
- **Missing search input on modal open:** Child combinator `>` in the selector fix prevented matching the search tab content (nested inside `.modal-card-search-popup`). Fix: changed to descendant selector `.search-popup-tab-content`.
- **Height instability:** `#search-popup-preview-containers` and the search tab content both had `flex: 1` as siblings, splitting the modal space 50/50. When search tab was active, the empty preview containers ate half the height. Fix: `activateSearchPopupTab` now hides the preview containers when search tab is active.
- **No width scroll on tab bar:** Tab bar uses `overflow-x: hidden` with `flex-shrink: 1` on tabs and `text-overflow: ellipsis` on tab titles.
- **Centered error for max 5 tabs:** Error message now renders as a centered banner in the search results area instead of a background toast.

- **Files changed:** `public/index.html`, `public/app.js`, `public/styles.css`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`

## [1.8.1] — 2026-06-14

### Deal caching — refresh now pulls fresh data
- **Root cause:** `refreshAll()` cleared in-memory caches then immediately rehydrated from IndexedDB before the clear transaction committed, repopulating stale data. Also, server-side proxy cache (30s TTL for single-opp, 600s for tags) returned stale data after tag/note edits.
- **Fix:** `refreshAll()` no longer rehydrates from IndexedDB — hydration only happens once on initial page load via `initCaches()`. `enableCachePersistence()` is now idempotent (guards against double-wrapping). Server-side cache invalidation now covers `DELETE` mutations and invalidates the single-opp `GET:/api/2.0/crm/opportunity/{id}` cache line when tags change. The preview modal refresh button (`⟳`) now appends `?_t=Date.now()` to bypass the proxy cache entirely.
- **Files changed:** `public/app.js`, `server.py`

### Email width — expanded emails now fill available space
- **Root cause:** `.mail-detail` and `.opp-preview-mail-embed` had no explicit `width: 100%`, and the mail inbox modal was using `.mail-expanded-embed` (a class with no CSS rules) instead of `.opp-preview-mail-embed`.
- **Fix:** Added `width: 100%; box-sizing: border-box` to `.mail-detail`, `.opp-preview-mail-embed`, and `.opp-preview-mail-body`. Changed the mail inbox JS to use `.opp-preview-mail-embed` class.
- **Files changed:** `public/styles.css`, `public/app.js`

### UI freeze when returning from background tab
- **Root cause:** When a tab is backgrounded, Chrome throttles timers and defers IntersectionObserver callbacks. Returning to the tab fires all deferred callbacks simultaneously, triggering up to 25+ concurrent `fetchOpportunityCustomFields()` calls (5 per group × 5+ groups).
- **Fix:** Added a 50ms debounced batch collector for intersection callbacks. Added `document.visibilitychange` listener that disconnects all observers when hidden and re-observes after a 500ms delay when returning. `enqueueOpportunityCustomFieldEnrich()` skips work entirely when `document.visibilityState === 'hidden'`.
- **Files changed:** `public/app.js`
- **Issue:** ISSUE-004 — resolved

### Attachment note indicator — queue status now visible
- **Root cause:** `createOpportunityHistoryEvent()` returned `{ queued: true }` on transient CRM errors but callers didn't check the return value, so notes appeared "sent" even when they were only queued for retry.
- **Fix:** `createOpportunityHistoryEvent()` now explicitly returns `{ queued: true }` or `{ success: true }`. `submitDealEditForm()` and `submitQuickNoteForm()` check the return value and show a toast: "Note queued for retry (CRM is temporarily down). Check the header indicator." The note queue indicator in the header was also made more visible (amber background, larger font).
- **Files changed:** `public/app.js`, `public/styles.css`

### Quote font — easier to read at small size
- **Root cause:** The daily quote used "Instrument Serif" (decorative italic serif) at 0.8rem, which was tight and hard to read.
- **Fix:** Changed to `var(--font)` (DM Sans / system-ui sans-serif), increased to 0.85rem, added `font-weight: 500`, increased line-height to 1.45. Reverted to italic style per user request.
- **Files changed:** `public/styles.css`

### Preview modal stale data — manual refresh bypasses cache
- **Root cause:** The preview modal refresh button (`⟳`) re-fetched the same API paths, which were cached by the server-side proxy for 30 seconds (opportunity data, history) or 600 seconds (tags, custom fields).
- **Fix:** Added `bustCache(path)` helper that appends `?_t=Date.now()`. The preview modal refresh button now passes `force=true` through the entire chain: `openOpportunityPreviewModal(…, true)` → `fetchOpportunityPreviewData(…, true)` → each individual fetch function. This guarantees fresh data on manual refresh.
- **Files changed:** `public/app.js`

### Amber border lost after deal edit
- **Root cause:** `fetchOpportunityForUpdate()` returns the core opportunity object but does **not** include tags. The single-opp refresh path in `submitDealEditForm()` and `submitQuickNoteForm()` updated the card with the untagged opportunity, so `renderCard()` couldn't detect "High Priority" and the amber border/background disappeared.
- **Fix:** Added `await enrichOpportunitiesTags([updatedOpp])` immediately after `fetchOpportunityForUpdate()` in both submit paths. This fetches tags for the updated opportunity before rendering the card, preserving the amber styling.
- **Files changed:** `public/app.js`

### Changelog popup — shown once per version on first login
- **New feature:** Modal that displays `CHANGELOG.md` content on first login after a version update. Uses the existing `renderBasicMarkdown()` renderer (headers, lists, bold, italic, links, code). Close button + Escape + backdrop click dismiss the modal. The seen version is persisted in `localStorage` under `changelog_seen_version`, so the modal only reappears when the version changes.
- **Files changed:** `public/index.html`, `public/app.js`, `public/styles.css`, `server.py`
- **Server endpoint:** `GET /api/changelog` returns `CHANGELOG.md` as `text/markdown`

---

## [1.8.0] — 2026-06-12

### Stale Deals Tile — Attempted, debugged, and scrapped
- **Attempt A (activity-based)**: Tried to use `state.feedRawItems` (CRM notifications feed) to find last activity per opportunity. Failed because feed only covers last 30 days (max 150 events), so most opportunities had no activity found.
- **Attempt B (due-date-based)**: Switched to `expectedCloseDate` on opportunity objects. Added threshold dropdown (1 week / 30 days / 90+ days). Still failed to list any deals in any time period during testing.
- **Scrapped**: Tile removed from UI and code entirely. All stale deals functions, constants, CSS, and HTML removed from `public/app.js`, `public/index.html`, `public/styles.css`.
- **Root cause**: `expectedCloseDate` on open deals was not reliably past-due in the test data. The concept of "stale" needs a different data source (e.g., actual last-modified timestamp on opportunities, which the CRM API does not provide directly).
- **Future**: May revisit with a proper CRM-side query or different staleness metric. See ISSUES.md for full post-mortem.

### Fix: Production version display showing "vdev"
- **Root cause**: `Dockerfile` did not copy the `VERSION` file into the container. `server.py` fell back to `APP_VERSION = "dev"`, so the UI showed `vdev`.
- **Fix**: Added `COPY VERSION ./` to `Dockerfile`.
- **Verify**: On next Docker build, `GET /api/config` should return `"version": "1.8.0"`.

## [1.7.6] — 2026-06-12

### Feed: notify auto-inject experiment (tried and reverted)
- Attempted Part A: auto-inject `[Notified: Name1, Name2]` text into event content when creating history events with notify users, so the keyword filter could find them.
- Added `renderFeedNotificationItem` detection of `[Notified: ...]` suffix with `.feed-notified-suffix` CSS (smaller/italic/muted).
- **Reverted**: User reported text was "squished against the note" and same font size. Feature scrapped — manual `@ken` keyword filter works fine.

### Feed: mail events removed
- Removed `fetchFeedMailInitial` call, mail batch branch in `loadMoreNotificationFeed`, and `mailExhausted` from `feedCanLoadMore`. Mail events (CRM. New event added to...) no longer appear in the feed.

### FEED_MAX_EVENTS: 200→150→100→150
- Settled at 150 (mail removal already reduces noise sufficiently).

### UI: Preview modal fields styled as cards
- Each `.opp-preview-field` now has `border`, `border-radius: 8px`, `box-shadow`, and `background: var(--surface-2)` — like edit modal fields.
- Checkbox values ("Yes"/"No") render as small pill `.field-value-tag`.
- Success probability field removed from preview.

### UI: Tasks rendered as cards (not rows)
- `.task-row` now has `border-radius: 8px`, `border: 1px solid var(--border)`, `box-shadow`, and `margin-bottom` instead of `border-bottom`.
- Full-width layout toggle button removed from tasks tile and CRM notifications tile toolbars.

### Server: gzip + caching
- Static files served with `Cache-Control: public, max-age=86400`.
- Gzip compression for all responses (`Content-Encoding: gzip`; app.js 553KB→134KB, 75% reduction).
- Proxy-side response cache: 60s TTL for tag/stage/customfield, 15s for filter/history.

### Other
- `modal-card-deal-edit .modal-form` now has `scroll-padding-bottom: 4rem` so content doesn't hide behind sticky action bar.

## [1.7.5] — 2026-06-11

### Performance: tag cache, custom field cache, filter result cache
- **Tag cache** (`state.oppTagCache`, 5-min TTL): checked in `enrichOpportunitiesTags` before per-opp `tag/{oppId}` API calls; stored on fetch success; cleared on `refreshAll`; invalidated per-opp after tag mutations in `submitDealEditForm`, `submitQuickNoteForm`, and mutation queue handler.
- **Custom field cache** (`state.oppCustomFieldCache`, 5-min TTL): checked in `enqueueOpportunityCustomFieldEnrich` (cached → immediate `updateOpportunityCardDom`, no queue); stored in `fetchOpportunityCustomFields`; cleared on `refreshAll`; invalidated per-opp after `updateOpportunityCustomFieldsViaPut`.
- **Filter result cache** (`state.filterResultCache`, 30-sec TTL): caches raw API response from `/api/2.0/crm/opportunity/filter` before client-side filtering. Keyed by `groupId + baseQs` only (tagTitles/red filters excluded since they're client-side). Moved store *before* client-side filtering so adding/removing tag filters still hits the same cache entry.
- New helpers: `createTtlCache(ttl)` for filter result cache, `createOppCache(ttl)` for opp-specific caches.
- Cache invalidation in mutation handlers, deal edit, quick note.

### UX: tile loading indicator (200ms debounce)
- `refreshGroup` shows "Refreshing deals…" with spinner in tile board area after 200ms debounce; cleared on both success and error paths.

### DM linkify
- New `linkifyUrls(container)` function (TreeWalker pattern) converts bare `https?://` URLs to `<a>` tags inside `.presence-msg-text`; called at end of `renderDMLog`.

### Feed cap reduction
- `FEED_MAX_EVENTS` 200→150, `FEED_DAYS` 90→30 to reduce feed API payload on every refresh.

### Performance: batch tag enrichment
- **Replaced serial 12-at-a-time per-opportunity tag fetches with fully concurrent `Promise.allSettled`.** Previously, `enrichOpportunitiesTags` batched 12 concurrent requests in a `for` loop with `await`, creating N/12 serial rounds of network waterfall (e.g., ~13 rounds for 150 opps). Now all per-opportunity tag requests fire concurrently — the browser manages its 6-per-domain connection pool naturally, and the function returns once all responses settle. Eliminates the serial blocking gap between batches and reduces wall-clock time for tag resolution by ~10x (from 13+ round-trips to 1 effective round-trip).
- No change to `state.allTags` loading (tag definitions are still fetched in one batch via `loadAllTags()`).

### UX: CRM loading indicator
- **Bottom progress bar** now shows "Loading CRM data…" during `refreshAll` and stays visible until ALL CRM tile data (groups, feed, tasks) finishes loading in the background. The dashboard renders immediately; the indicator tracks completion via a promise callback, not by blocking.
- Calendar tiles (3rd‑party Proton Calendar) fire independently and don't affect the indicator.
- **Refresh button spins** while CRM data is loading (CSS animation on the SVG icon), stops when background CRM loads complete.
- `loadExpandedDashboardTiles` separates CRM-origin tiles from calendar tiles; only CRM promises are tracked for the indicator. The function always returns a promise for completion observation without blocking.
- `isCrmOnlyTileId` helper distinguishes CRM-origin tiles (groups, feed, tasks) from non-CRM tiles (calendar).
- `hideCRMSyncStatus` respects `_crmRefreshing` flag: mutation status messages can briefly override the text, but `hideCRMSyncStatus` restores "Loading CRM data…" when a global refresh is in progress.

### Mail inbox fixes and enhancements
- Restored pagination: added `&page=` param back to conversations API (server supports it).
- Added "Mark all loaded as read" toolbar button for bulk marking.
- Restored account selector pulldown: unhidden, functional change listener, filters by `&accountId=`.
- Restored unread badge on mail header button: removed `style="display:none"` and early return guard.
- Link debug: added `console.warn` for primary link failure + `console.warn` for fallback failure so root cause is visible in DevTools.
- Updated link toast to "Linked as note (primary link failed)" when falling back.
- Cache-Control: all static files now served with `no-cache, must-revalidate` (not just favicons).
- Updated button title from "CRM Mail Inbox (viewer only)" to "CRM Mail Inbox".
- Added `console.debug` of conversation object keys on load to diagnose missing read flag fields.

### Mail quick view UX polish
- Made close button larger (removed `btn-small`, added explicit padding/font-size).
- Moved limitations note from footer to right sidebar as a bullet list under "Quick View Limitations".
- Attachments now pre-render "Open in Mail" link immediately when expanding an email (no download attempt cascade).
- Added today counter `N (Today)` in toolbar showing how many of the loaded conversations are from today.
- Search now passes `&search=` param to conversation API so it actually filters server-side.
- Query param `search` added to `loadMailMessagesForModal`.
- Attachment filenames are plain text (no click handler) to avoid noisy 404/403 console errors; only "Open in Mail" link is actionable.

### Bug fixes
- Feed notifications: filtered out raw JSON/mail-metadata dumps (`{from "...", ...}`) that appeared as broken text in the feed.
- Quick edit modal: sticky save/cancel buttons at bottom of card; note editor max-height reduced to 6rem with resize disabled, preventing buttons from being pushed off-screen on smaller screens.
- Deal preview: hid "Actual close" field per request.

### User fields in deal edit
- Added "Show User Fields" toggle button to deal edit modal that reveals editable custom user fields (reuses create-opp field rendering).
- Fields are pre-populated with the deal's current saved values; text, textarea, select, checkbox, and date types supported.
- Changes are submitted via `updateOpportunityCustomFieldsViaPut` on save.
- User fields container has `max-height: 30vh` with internal scroll so it doesn't push save/cancel buttons off-screen.

### Dashboard performance: CRM tile isolation
- CRM-dependent tile loads (groups, feed, tasks, calendars) are now fired as background promises — they no longer block `refreshAll()` or the initial dashboard render.
- `loadExpandedDashboardTiles` no longer `await`s CRM tile data; tiles update asynchronously when their data arrives.
- `refreshGroup` defers DOM rendering via `setTimeout` so deal edits and other mutations don't freeze the UI during group board re-render.
- Status text updates immediately instead of waiting for all CRM tiles to finish.
- Local-only features (notes, calendars from cache, profile, layout) are fully isolated from CRM server latency.

### Other
- Created `docs/DEPLOY.md` with correct production path `/opt/vanguard/onlyoffice-crm-kanban`.
- Updated reference in `UPDATE_AND_DEPLOY.txt` to point to `docs/DEPLOY.md`.

## [1.7.0] — 2026-06-11

### FEAT-002: Custom user fields on opportunity create (ISSUE-001 — FIXED)
- Custom fields on new opportunity create now actually persist in CRM. Root cause: `collectCreateOppCustomFieldValues()` used `[data-custom-field-id]` which matched the wrapper `<div>` (set by `renderCreateOppCustomFields`) instead of the actual `<input>`/`<select>`/`<textarea>`, so `.value` was always `undefined` and every field was silently skipped.
- Fix: finds the wrapper div by data attribute, then queries `input, select, textarea` inside it to get the real user-entered value.
- Also corrected `buildCustomFieldListForApi` to `{key, value}` format (camelCase, no duplicate `Key`/`Value` props) and added `customFieldList` to create body alongside per-field POST fallback.
- `CREATE_OPP_USER_FIELDS_ENABLED=true`. Tested and confirmed end-to-end (dashboard → proxy → CRM).

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