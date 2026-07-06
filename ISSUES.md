# Known issues

## ISSUE-006 — WebKit / Apple cache-busting attempt (July 4) — expensive disaster, ignored user feedback

**Status:** ❌ Fully scrapped and removed 2026-07-05

### What was attempted
- Added `detectAppleWebKit()`, `state.isAppleWebKit`, `bustCache()` helper, and conditional `bustCache()` calls on short-TTL proxy paths (filter/history/tag/customfield).
- In `server.py:_handle_api_get`, on cache miss for dynamic paths, emitted `Cache-Control`, `Pragma`, `Vary`, `Expires` headers via `send_header` **before** `send_response`, plus `isDynamicShortTtl` logic.
- Goal: make dashboard more "Apple friendly" by preventing WebKit from caching CRM responses.

### Breakage
- Produced `net::ERR_INVALID_HTTP_RESPONSE` (HTTP 400) on direct http LAN testing (`http://127.0.0.1:8765` and local LAN IPs).
- Affected: opportunity filter, history/filter, batch-opportunity-tags, individual tag calls.
- Login and some proxy calls succeeded; core data loads (groups, history, tags) failed after login.
- Prod was masked by host nginx; local dev (plain http, no nginx) was the canary.

### Ignored user feedback
- User repeatedly stated "local dev used to work great until the edits" and that the breakage started exactly after the WebKit changes.
- Initial agent focus was on auth, reachability, or 502s instead of acting on the reported timeline.
- User had to argue the point multiple times; agent kept trying additional changes while claiming the WebKit edits were not the issue.

### Outcome
- Entire WebKit feature scrapped.
- All `detectAppleWebKit`, `state.isAppleWebKit`, `bustCache`, `isDynamicShortTtl`, and premature header emission blocks removed.
- Pre-existing server TTL cache (`_proxy_cache`, 30s/600s), cache invalidations on mutations, `newId()` (crypto.randomUUID fallback), 502/5xx JSON resilience, friendly tile errors + retry links, LAN printing, batch tags, and all prior proxy/auth/upload logic preserved.
- Documented here and in CHANGELOG as an expensive disaster and waste of tokens.

### Why it happened
- Attempt to solve a perceived platform caching problem without first reproducing the exact reported symptoms on the actual dev path (plain http, no nginx).
- Failure to stop and revert when user timeline evidence was provided.

---

## ISSUE-005 — Agent repeatedly forgets completed work (2026-07 session)

**Status:** Ongoing — documented 2026-07-05

### Symptoms
- Backdate HTML inputs (`<input type="date" id="*-note-created">`) were implemented, tested locally with working backdated POSTs, and visible in a live session.
- Only the supporting JS (reset/read/submit) and CSS (width/hue) were committed and pushed.
- HTML change was never present in the tree; feature appeared broken on fresh loads despite working in cached browser.
- "WebKit catastrophe" / Safari date-input wrapper issues were discussed at length but never written to any committed file.
- Agent would claim "done" and "pushed" when the actual markup was missing.

### Root cause (observed)
- Session state and chat context are not persisted into the source tree or docs.
- Agent trusts prior conversation as truth instead of re-reading committed files + `git show`.
- No mandatory step to run `git status --short && git diff --stat`, confirm exact lines changed, and update CHANGELOG + AGENTS last-session summary before ending work.

### Mitigation (enforced going forward)
- After every feature/fix: run `git status --short && git diff --stat`.
- Explicitly confirm the changed lines are in the working tree and committed.
- Write a one-line summary under "Last session summary" in AGENTS.md.
- Add a CHANGELOG entry (and RELEASE note for tagged versions).
- If the user has to argue "where is the HTML?", the agent has failed the rule.

### Related
- Similar pattern seen with the WebKit date-input wrapper removal rationale and the "backdate button" being only partially shipped.

---

## ISSUE-004 — Stale Deals Tile: attempted, debugged, and scrapped

**Status:** ❌ Abandoned 2026-06-12 — removed in v1.8.0
**Area:** Dashboard tiles (`public/app.js`, `public/index.html`, `public/styles.css`)

### What was tried

We wanted a tile that shows "stale" opportunities (claims with no recent CRM activity or past their due date). Two approaches were attempted:

**Attempt A (activity-based):**
- Used `state.feedRawItems` (CRM notifications feed) to find the last activity event per opportunity.
- Computed days since last event. If no event found in the feed window, showed "no activity in N days."
- Added caching (`localStorage` daily key), midnight refresh, severity colors (amber/orange/red), and a threshold dropdown.
- **Why it failed:** The feed only covers the last 30 days (max 150 events). Most opportunities had no activity found in that window. The fallback to `opp.created` (creation date) was misleading — a deal created 6 months ago might have had activity yesterday.
- **Debug finding:** `state.feedRawItems` contains parsed objects from `parseRelationshipNotifyEvent`. Only the last 30 days of history are available. Opportunity objects from `fetchOpportunitiesForGroup` have `created` but no `updated` field.

**Attempt B (due-date-based):**
- Switched to `expectedCloseDate` on opportunity objects. If the due date was more than N days in the past, the deal was "stale."
- Added threshold dropdown (1 week / 30 days / 90+ days). Bread emoji 🍞 for stale indicator.
- **Why it failed:** During testing, no deals were listed in any time period. The `expectedCloseDate` on open deals was not reliably past-due. Closed deals have no `expectedCloseDate` at all.
- **Debug finding:** `expectedCloseDate` is available on all open opportunities, but it is future-dated or not far enough in the past to trigger "overdue" in the test data.

### Why it was scrapped
- Both approaches produced empty results in real-world testing. The tile was non-functional.
- User explicitly asked to scrap it and document the attempts.
- All stale deals code removed from `app.js`, `index.html`, and `styles.css`.

### Future possibilities
- A proper CRM-side query for "last modified" timestamp (not available in current API).
- A different staleness metric (e.g., "no note added in 30 days" using a dedicated endpoint).
- Revisit if CRM API provides opportunity `updatedAt` or `lastActivityDate` in the future.

---

## ISSUE-003 — Feed notification notify-user search: auto-inject [Notified:] attempted and scrapped

**Status:** ❌ Abandoned 2026-06-12 — reverted in v1.7.6
**Area:** Feed notifications / event creation (`public/app.js`)

### What was tried

We wanted to make "My notifications" (events where the current user was in notifyUserList) searchable via the keyword filter using `@username`. Since the CRM's GET `/api/2.0/crm/history/filter` does not return notifyUserList in its response, we couldn't filter client-side by user.

**Attempt A (v1.7.6-dev, reverted):** Auto-inject a `[Notified: Name1, Name2]` suffix into the event content inside `createOpportunityHistoryEvent`, right before the HTML conversion. Then detect the suffix in `renderFeedNotificationItem` and style it separately. Users would search `@ken` as a keyword and find events where they were notified.

**Why it was reverted:**
- User reported the [Notified:] text appeared "squished against the note" and was the same font size despite CSS rules — possibly a browser-cache issue, but the styling approach was unreliable.
- The user preferred the existing manual `@ken` keyword filter which already worked for events where their name appeared in the text.

**Alternative considered:** A dedicated "My notifications only" checkbox that would try to check `notifyRecipients` — but the API doesn't return this data in GET responses, so it hid everything. Also reverted.

**Current state:** Only the manual keyword filter (comma-separated AND) is used for feed filtering. Mail events removed from feed (noise reduction). FEED_MAX_EVENTS=150.

## ISSUE-001 — New Opportunity: custom user fields do not persist (RESOLVED v1.7.0)

**Status:** ✅ Fixed 2026-06-11 — `CREATE_OPP_USER_FIELDS_ENABLED=true`, see **Root cause** below.  
**Priority:** High  
**Area:** Create opportunity modal (`public/app.js`)

### Root cause (two bugs found)

1. **DOM query selector bug** (primary — fields were never sent): `collectCreateOppCustomFieldValues()` used `wrap.querySelector('[data-custom-field-id="..."]')` which matched the wrapper `<div>` (set in `renderCreateOppCustomFields` via `field.dataset.customFieldId`) instead of the actual `<input>`/`<select>`/`<textarea>`. Accessing `.value` on a `<div>` returned `undefined` → empty string → `if (!raw) continue;` — every field was silently skipped and `customFieldList` was absent from the create body.

2. **JSON payload format** (secondary — caused 400 errors when fields were present): `buildCustomFieldListForApi()` was returning `{Key, Value}` (PascalCase) objects. Combined with flat `customField_{id}` fields, this caused the CRM's `DeserializeXNode` to produce duplicate XML sibling nodes, triggering "Input string was not in a correct format" / "Value does not fall within the expected range".

### Fix (v1.7.0)

- `collectCreateOppCustomFieldValues()`: finds the wrapper div by `[data-custom-field-id]`, then uses `fieldEl.querySelector("input, select, textarea")` to get the actual input with the user's value.
- `buildCustomFieldListForApi()`: returns `{key, value}` (camelCase) only — no duplicate `Key`/`Value` props.
- `buildOpportunityCreateBody()`: includes `customFieldList` with `{key, value}` format; no flat `customField_{id}` loop.
- Per-field POST (`POST .../customfield/{fieldId}?fieldValue=...`) works correctly as fallback.
- Tested end-to-end: dashboard → proxy → CRM. Created opps with text/select/date/checkbox fields; values persist in native CRM.

## ISSUE-004 — Dashboard UI freeze / hang when returning from background tab

**Status:** ✅ Fixed 2026-06-14 — implemented in `public/app.js` (see below)
**Priority:** Medium
**Area:** Performance / IntersectionObserver / browser tab throttling (`public/app.js`)

### Summary

User reports the dashboard becomes unresponsive or "hangs" when the tab has been in the background for a while and the user returns to it. The issue does not occur during active editing.

### Root cause identified

1. **Browser tab throttling**: When a tab is backgrounded, Chrome aggressively throttles `setInterval` and `setTimeout`. All deferred callbacks fire simultaneously when the tab returns to the foreground.

2. **IntersectionObserver burst**: Each group tile has an `IntersectionObserver` on its opportunity cards. When the tab returns to the foreground, the browser recalculates all intersections, which can trigger up to `OPP_CUSTOM_FIELD_ENRICH_CONCURRENCY` (5) concurrent `fetchOpportunityCustomFields()` calls per group. With 5+ groups, this creates 25+ simultaneous API calls plus DOM rebuilds, causing a brief UI freeze.

3. **Not the mutation queue**: The `processMutationQueue()` (5s interval) was suspected, but it does almost nothing when the queue is empty (which is the normal case). The hang occurs even with zero queued mutations.

### Proposed fix

1. Debounce the intersection observer callback across all groups (batch enrich queue instead of per-group).
2. Skip `fetchOpportunityCustomFields()` entirely when `document.visibilityState === 'hidden'`.
3. Add a `document.visibilitychange` listener to pause and resume the intersection observer.
4. Optionally, add a small delay (e.g., 500ms) after tab visibility returns before re-enabling observers, to let the browser settle.

### Fix applied

1. **Batch observer callbacks** — `observerBatch` (Map groupId → Set oppIds) collects all intersecting cards in a 50ms debounce, then flushes once via `flushObserverBatch()` instead of firing per-card.
2. **Skip when hidden** — `enqueueOpportunityCustomFieldEnrich` returns immediately if `document.visibilityState === 'hidden'`; observer callback also bails early.
3. **Pause/resume on visibilitychange** — When the tab is hidden, all group observers are disconnected and `groupCardObservers` is cleared. When the tab returns, a 500ms delay lets the browser settle before re-observing all visible groups.
4. **Result** — Eliminates the burst of 25+ concurrent API calls + DOM rebuilds that caused the freeze.

### Files changed

| File | Role |
|------|------|
| `public/app.js` | `observeOpportunityCardsInGroup`, `enqueueOpportunityCustomFieldEnrich`, `drainOppCustomFieldEnrichQueue`, `flushObserverBatch`, visibilitychange listener |
| `public/styles.css` | (none expected) |

---

## ISSUE-002 — CRM Mail: mark read/unread, account selector, unread badge, and linking

**Status:** ✅ Re-enabled in v1.7.0 — server API calls for mark/unread, delete, and link-to-deal now work. Account selector remains disabled (unified inbox only). See **Root cause** below.  
**Priority:** Medium  
**Area:** Mail inbox modal (`public/app.js`, `public/index.html`), mail history linking

### Summary

The mark read/unread toolbar buttons and delete button were viewer-only (no server push). Linking to deals existed but used a fallback history event. The root cause was using message-level endpoints (`POST /api/2.0/mail/messages/markread`) which returned HTML errors — the native CRM operates on **conversations** (not individual messages). The dashboard list was loaded from `/api/2.0/mail/messages` which returned message objects without `conversationId`, making it impossible to use conversation-level APIs.

The account selector pulldown remains disabled (unified inbox only). The unread badge indicator works but may reflect local state combined with server data.

### Root cause

All mail operations in the native OnlyOffice CRM (mark read/unread, delete, link to CRM) use **conversation-level** endpoints, not message-level:

| Operation | Endpoint | Body |
|-----------|----------|------|
| Mark read/unread | `PUT /api/2.0/mail/conversations/mark.json` | `ids[]=<convId>&status=read\|unread` |
| Delete (move to trash) | `PUT /api/2.0/mail/conversations/move.json` | `ids[]=<convId>&folder=4` |
| Link to CRM | `PUT /api/2.0/mail/conversations/crm/link.json` | `{"id_message":<convId>,"crm_contact_ids":...}` |

The dashboard previously loaded `/api/2.0/mail/messages` which returned individual message objects without `conversationId`, so conversation IDs were never available. Additionally, mark/delete handlers attempted `POST /api/2.0/mail/messages/markread` which returned HTML errors (endpoint does not exist at message level in this Community Server version).

### Fix (v1.7.0)

1. **Switched list endpoint**: `loadMailMessagesForModal` now loads `/api/2.0/mail/conversations.json?folder=1&page_size=...&sort=date&sortorder=descending` instead of `/api/2.0/mail/messages`. Conversation objects have compatible fields (`id`, `subject`, `from`, `date`, `read`) so `renderMailList` works without changes.

2. **Mark read/unread**: Handlers now `PUT /api/2.0/mail/conversations/mark.json` with form-urlencoded `ids[]=<id>&status=read|unread`. Local `mailDashboardReadIds` Set preserved as fallback if the server call fails.

3. **Delete**: Button shown (was `display:none`). Handler now `PUT /api/2.0/mail/conversations/move.json` with `ids[]=<id>&folder=4` (trash). Includes confirmation dialog.

4. **Link to deal**: Sidebar restored (replaces the viewer-warning sidebar). Uses existing `POST /api/2.0/mail/crm/link` endpoint with conversation IDs as `messageIds` + fallback history event. The `resetQuickLinkSidebar()` function clears state on modal open.

5. **Expand (View)**: Changed from `fetchMailMessage(id)` (message-level) to loading conversation detail via `/api/2.0/mail/conversation/{convid}.json?loadAll=false` and extracting the first message for `renderMailEmbedPanel`.

6. **Local persistence**: `mailDashboardReadIds` Set + localStorage preserved for read status resilience. `markMailMessageRead` (auto-mark on expand) now also pushes to server (best-effort, non-blocking).

### Files changed (v1.7.0)

| File | Role |
|------|------|
| `public/index.html` | Restored link sidebar HTML (`.mail-right-sidebar`); removed viewer-warning sidebar; delete button visible |
| `public/app.js` | `loadMailMessagesForModal` → conversations API; mark/unread/delete handlers → server API; expand → conversation detail; `resetQuickLinkSidebar()` added; viewer-warning references removed; `markMailMessageRead` pushes to server |
| `ISSUES.md` | This update |

### What remains

- Account selector pulldown still disabled (unified inbox). Re-enabling would need a working `/api/2.0/mail/accounts` → folder list → filter by `folderId`.
- Badge indicator uses a mix of server folder counts and local overrides; may not perfectly reflect native CRM unread state.
- Link sidebar searches only opportunities (no contacts or other entity types).
- Delete moves to trash (folder 4); does not permanently delete.

### References

- Conversations list: `GET /api/2.0/mail/conversations.json?folder=1&page_size=...&sort=date&sortorder=descending`
- Conversation detail: `GET /api/2.0/mail/conversation/{id}.json?loadAll=false`
- Mark: `PUT /api/2.0/mail/conversations/mark.json` (form-urlencoded `ids[]=<id>&status=read|unread`)
- Delete: `PUT /api/2.0/mail/conversations/move.json` (form-urlencoded `ids[]=<id>&folder=4`)
- Link primary: `POST /api/2.0/mail/crm/link` (messageIds + crmEntityId + crmEntityType:2); fallback history POST
- Accounts/folders for badge: `/api/2.0/mail/accounts`, `/api/2.0/mail/folders?accountId=...`
- History mail parse: `parseHistoryMailPayload`, `isMailLinkedHistoryEvent`, `extractMailMessageIds`, `crmMailReceivedLine`, `renderMailHistoryReceivedSummary`
- See also CHANGELOG / RELEASE notes for v1.7.0 context

---

## ISSUE-005 — Deal caching: stale data after edits and refresh

**Status:** ✅ Fixed 2026-06-14 — v1.8.1
**Priority:** High
**Area:** Dashboard caching (`public/app.js`, `server.py`)

### Summary

After editing a deal (tags, notes, due date) and clicking the tile refresh button or the global Refresh All, the dashboard still showed stale data. The user confirmed the changes were saved in the native CRM, but the dashboard didn't reflect them.

### Root cause

**Client-side (IndexedDB):** `refreshAll()` called `state.filterResultCache.clear()` and then `await hydrateAllCachesFromIndexedDB()`. The `clear()` method triggers `clearIndexedDBStore()` fire-and-forget (not awaited), while hydration reads from IndexedDB before the clear transaction commits. This repopulated the in-memory cache with stale data.

**Server-side (proxy cache):** `server.py` caches GET responses for 30 seconds (`/crm/opportunity/{id}`) and 600 seconds (tags, custom fields). The invalidation logic only handled `PUT`/`POST`, not `DELETE`, and didn't invalidate the single-opp cache line on tag changes.

### Fix

1. `refreshAll()` no longer calls `hydrateAllCachesFromIndexedDB()` — hydration only happens on initial load via `initCaches()`.
2. `enableCachePersistence()` made idempotent (prevents double-wrapping).
3. `refreshGroup({ force: true })` now explicitly clears the filter result cache entry before fetching.
4. Server-side: Added `DELETE` to mutation invalidation, and tag changes now invalidate the single-opp cache line.
5. Preview modal refresh button (`⟳`) appends `?_t=Date.now()` to bypass the proxy cache entirely.

### Files changed

| File | Role |
|------|------|
| `public/app.js` | `initCaches()`, `refreshAll()`, `refreshGroup()`, `enableCachePersistence()` idempotency, `bustCache()` helper |
| `server.py` | Cache invalidation for `DELETE`, single-opp cache invalidation on tag changes |

---

## ISSUE-006 — Amber border lost after deal edit

**Status:** ✅ Fixed 2026-06-14 — v1.8.1
**Priority:** High
**Area:** Card rendering / tag enrichment (`public/app.js`)

### Summary

After editing a deal (e.g., adding a note via quick note or deal edit), the card in the group tile lost its amber border and background. The "High Priority" tag was still present on the deal in native CRM, but the dashboard card no longer showed the styling.

### Root cause

`fetchOpportunityForUpdate()` returns the core opportunity object but does **not** include the `tags` property. The targeted single-opp refresh path in `submitDealEditForm()` and `submitQuickNoteForm()` updated the in-memory opportunity with the untagged object, then called `renderCard()`. Since `oppHasTag(opp, "High Priority")` found no tags, the `.card--high-priority` class was not applied.

### Fix

Added `await enrichOpportunitiesTags([updatedOpp])` immediately after `fetchOpportunityForUpdate()` in both submit paths. This fetches tags for the updated opportunity before rendering the card, preserving the amber border/background styling.

### Files changed

| File | Role |
|------|------|
| `public/app.js` | `submitDealEditForm()`, `submitQuickNoteForm()` — tag enrichment after fetch |

---

## ISSUE-007 — Attachment note with no failure indicator

**Status:** ✅ Fixed 2026-06-14 — v1.8.1
**Priority:** High
**Area:** Note submission / mutation queue (`public/app.js`)

### Summary

A note with a PDF attachment submitted on a deal tile did not appear in the CRM. The user did not see any error indicator or failure message. The note was silently queued for retry but the UI showed "Note saved" as if it succeeded.

### Root cause

`createOpportunityHistoryEvent()` used `withCrmQueueOnTransient()` which queues the mutation on transient errors and returns `{ queued: true }`. The callers (`submitDealEditForm()`, `submitQuickNoteForm()`) did not check the return value, so they always showed the success toast regardless of whether the note was actually sent or queued.

### Fix

1. `createOpportunityHistoryEvent()` now explicitly returns `{ queued: true }` or `{ success: true }`.
2. Callers check the return value and show "Note queued for retry (CRM is temporarily down)" when appropriate.
3. The note queue indicator in the header was made more visible (amber background, larger font).

### Files changed

| File | Role |
|------|------|
| `public/app.js` | `createOpportunityHistoryEvent()`, `submitDealEditForm()`, `submitQuickNoteForm()` |
| `public/styles.css` | Note queue indicator visibility |

---

## ISSUE-008 — Preview modal manual refresh returns stale data

**Status:** ✅ Fixed 2026-06-14 — v1.8.1
**Priority:** Medium
**Area:** Preview modal / server proxy cache (`public/app.js`)

### Summary

Clicking the manual refresh button (`⟳`) in the preview modal still showed stale data even after edits were confirmed in native CRM. The user had to wait ~30 seconds for the server proxy cache to expire.

### Root cause

The preview modal refresh button re-fetched the same API paths without any cache-busting parameter. The server-side proxy cache (`_proxy_cache`) stores GET responses for 30 seconds (opportunity data, history) and 600 seconds (tags, custom fields). So the manual refresh was returning the cached stale response.

### Fix

Added `bustCache(path)` helper that appends `?_t=Date.now()` to any API path. The preview modal refresh button now passes `force=true` through the entire chain: `openOpportunityPreviewModal(…, true)` → `fetchOpportunityPreviewData(…, true)` → each individual fetch function (`fetchOpportunityForUpdate`, `fetchOpportunityCustomFieldValues`, `fetchAllOpportunityHistory`, `loadDealEditTags`, `fetchOpportunityDocuments`).

### Files changed

| File | Role |
|------|------|
| `public/app.js` | `bustCache()`, `fetchOpportunityForUpdate()`, `fetchOpportunityCustomFieldValues()`, `fetchAllOpportunityHistory()`, `loadDealEditTags()`, `fetchOpportunityDocuments()`, `fetchOpportunityPreviewData()`, `openOpportunityPreviewModal()`, preview refresh button |

---

## ISSUE-009 — Changelog popup on first login after update

**Status:** ✅ Implemented 2026-06-14 — v1.8.1
**Priority:** Low
**Area:** UX / onboarding (`public/app.js`, `public/index.html`, `public/styles.css`, `server.py`)

### Summary

New feature: Show a modal with the changelog content when the user logs in after a version update. The modal should only appear once per version — if the user closes it, they don't see it again until the next version update.

### Implementation

1. **Server:** `GET /api/changelog` endpoint reads `CHANGELOG.md` and returns it as `text/markdown`.
2. **Client:** After login (or session restore), the app fetches `/api/config` to get the current version, compares it with `localStorage.getItem("changelog_seen_version")`, and shows the modal if different.
3. **Rendering:** Uses the existing `renderBasicMarkdown()` function (headers, lists, bold, italic, links, code, etc.).
4. **Dismissal:** Close button, Escape key, or backdrop click. Saves the seen version to `localStorage`.
5. **Defer:** 300ms delay so the dashboard shell paints first.

### Files changed

| File | Role |
|------|------|
| `public/index.html` | Modal markup (`#changelog-modal`, `#changelog-body`, `#changelog-close`) |
| `public/app.js` | `showChangelogModal()`, `closeChangelogModal()`, `maybeShowChangelog()`, `bindChangelogModal()` |
| `public/styles.css` | `.modal-card-changelog`, `.changelog-body`, `.changelog-version`, markdown typography |
| `server.py` | `GET /api/changelog` endpoint |
| `CHANGELOG.md` | Updated with v1.8.1 release notes |
| `docs/RELEASE_v1.8.1.md` | Release notes file |

---

## ISSUE-010 — Customer Bot employee mode: CRM mail API quirks and workarounds

**Status:** ✅ Documented / implemented 2026-06-29 — v2.0.5
**Priority:** Medium
**Area:** Customer Bot employee mode (`server.py`, `telegram_bot.py`)

### Summary

When building employee-mode deal detail for the Telegram bot, we need the full text of linked email history events. The CRM `/api/2.0/crm/history/filter` endpoint only returns a truncated mail summary (often just a `mailto:` link), so we had to find an alternate source and handle several OnlyOffice API quirks.

### API quirks discovered

1. **CRM history stores truncated mail content.**
   - Mail events returned by `/api/2.0/crm/history/filter` have `category.title` = "Mail Message" and `content` is a JSON string.
   - The JSON contains `from`, `to`, `subject`, and an `introduction` field, but `introduction` is truncated (e.g. ends with `[ ](mailto:notifications@grasshopper.co…`).
   - The full email body is **not** present in the history response.

2. **`/api/2.0/mail/messages/{id}` does not return the rendered email body.**
   - The history event contains a `messageId`/`mailMessageId` (e.g. `27639`).
   - Calling `/api/2.0/mail/messages/{id}` with that ID returns a mail object, but the body fields (`htmlBody`, `textBody`, `body`) were empty/unusable in production.
   - This endpoint is used by the dashboard preview modal for metadata, but it is **not** the endpoint the native CRM MailViewer uses to render the message body.

3. **The CRM MailViewer uses a legacy ASPX handler for the body.**
   - Native CRM opens emails with `/Products/CRM/MailViewer.aspx?id={some_id}`.
   - That page fetches the body via `/Products/CRM/HttpHandlers/filehandler.ashx?action=mailmessage&message_id={messageId}`.
   - The `message_id` query parameter is the same `messageId` from the history event (e.g. `27639`), **not** the `id` shown in `MailViewer.aspx?id=...` (e.g. `38596`). These are two different IDs.

4. **Bot account needs admin + mail access.**
   - The bot authenticates as `BOT_CRM_EMAIL` and calls the filehandler with an `Authorization: <token>` header.
   - Initially the bot account was a regular user and the filehandler returned no body / permission errors.
   - Making the bot account an OnlyOffice admin and enabling mail module access for it allowed the filehandler to return full email HTML.

5. **Email addresses in angle brackets break Telegram HTML parse mode.**
   - Forward/reply attributions contain text like `"Grasshopper" <notifications@grasshopper.com>`.
   - Telegram's HTML parser treats `<notifications@grasshopper.com>` as an unsupported start tag and rejects the message with: `Can't parse entities: unsupported start tag "notifications@grasshopper.com"`.
   - Fix: escape `<` and `>` in attribution lines before sending.

6. **CRM mail bodies are raw HTML with tables and wrapped text.**
   - The filehandler returns HTML with `<table>` headers for forwarded messages and hard-wrapped lines inside `<p>` tags.
   - Direct sanitization leaves broken words (`payment of$432 ,851.60`) and leading whitespace.
   - Fix: convert HTML to plain text first, flatten tables to `Header: Value` lines, collapse whitespace, then sanitize for Telegram.

7. **History event author lives in `createBy`/`createdBy`.**
   - The event creator is in `ev.createBy.displayName` (or `createdBy`), not a top-level `author` field.
   - Employee mode now extracts this and shows it for non-mail events. It is intentionally hidden for `Customer Update` events.

### Current implementation

- `server.py` `_extract_mail_message_id()` finds the mail message ID from nested objects, top-level fields, `additionalData`, or regex.
- `server.py` `_fetch_full_mail_body()` calls the ASPX filehandler, parses JSON/HTML, and replaces the truncated `introduction` in the event content.
- `telegram_bot.py` `_html_to_text()` converts CRM email HTML to tight plain text.
- `telegram_bot.py` `_extract_forward_info()` / `_clean_reply_attribution()` handle forwarded/reply headers.
- Mail bodies are capped at 1200 characters and end with `[truncated]`.
- Plain-text fallback (`_strip_html_tags()`) strips tags if Telegram rejects HTML.

### Files changed

| File | Role |
|------|------|
| `server.py` | `_extract_mail_message_id()`, `_fetch_full_mail_body()`, `_extract_event_author()` |
| `telegram_bot.py` | `_html_to_text()`, `_extract_forward_info()`, `_clean_reply_attribution()`, `_truncate_html()`, `_strip_html_tags()`, `_format_mail_event()` |