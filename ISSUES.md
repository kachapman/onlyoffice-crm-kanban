# Known issues

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

**Status:** 🔍 Investigated 2026-06-12 — root cause identified, fix pending
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

### Files to change

| File | Role |
|------|------|
| `public/app.js` | `observeOpportunityCardsInGroup`, `enqueueOpportunityCustomFieldEnrich`, `drainOppCustomFieldEnrichQueue` |
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