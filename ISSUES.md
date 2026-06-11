# Known issues

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

## ISSUE-002 — CRM Mail: mark read/unread, account selector, unread badge, and linking

**Status:** Disabled / hidden as of this change (2026-06-xx)  
**Priority:** Medium  
**Area:** Mail inbox modal (`public/app.js`, `public/index.html`), mail history linking

### Summary

The mark read and mark unread toolbar buttons did not work (no visual change or persistence). The email address pulldown selector in the mail modal header showed duplicate addresses (e.g. same outlook.com 7x) and selecting did nothing (no inbox switch). The unread count indicator badge on the header mail button was missing after prior changes. "Open in CRM" worked. Linking an email to a deal continued to create a generic note-type history event instead of the native mail module format + proper mail-linked event (no expand in deal preview, etc.).

Per explicit request: the account selector pulldown was disabled and the modal now always loads a unified inbox (no per-account or per-folder targeting in the /mail/messages query). The right sidebar "Quick Link to Deal" (linking function) and its panel were hidden (display:none) and disabled for now. Both documented here so they can be re-enabled after the root causes (API payloads for mark, folder/account semantics for selector, exact history ad + category for linking, badge sum timing) are fully diagnosed against the live OnlyOffice mail endpoints.

### Symptoms (pre-fix)

- Clicking Mark read / Mark unread in toolbar: no change to list row styling (.mail-row-read), no persistence after reload, buttons may have been disabled.
- Account select: populated with repeated display values; change handler + load path with &accountId + folder probe did not alter the listed messages.
- Badge: #mail-unread-badge stayed hidden or empty even with unread mail in CRM inboxes.
- Linking: produced "Linked mail conversation: ..." note instead of `The email "..." has been received [date] Author: "..." <...>` (with mail cat + ad {mailMessageId, from, subject}) and thus no mail icon / expand in opp preview.
- Expand-to-view did mark (via separate path) and open CRM link was corrected in prior pass.

### What was done (workarounds)

1. Pulldown bar hidden via inline style + loadAccounts call + change listener removed in attach.
2. loadMailMessagesForModal simplified to always emit only `?page=...&page_size=...&sortorder=descending[+&search=...]` with no accountId/folderId (unified across all accounts' inboxes).
3. Mark read/unread: ensured consistent `messageIds: number[]` payload (matching the per-message expand path), added enabling of the three action buttons (mark read, unread, delete) from updateMailSelectedInfo on every selection mutation (previously they stayed disabled from the static HTML), optimistic .read flag + render before reload, post-reload re-apply of the flag + re-render (defensive if list items omit read/isRead), plus updateSelectedInfo after clears.
4. Badge: explicit updateMailUnreadBadge() added in showApp() (in addition to the calls already present inside ensurePresenceOnLogin and mark/expand/open paths); the function already sums only inbox folders' unreadCount across accounts.
5. Linking sidebar: already had `style="display: none;"` + explanatory comment; left the dead listener wiring in place (minimal change) since panel not visible.
6. Added this ISSUE-002. Open-in-CRM fix and list font muting / sanitize for white backgrounds were from prior iteration and left as-is ("Open in crm works").

**Follow-up (API error + dashboard persistence):**  
The toolbar mark read/unread produced toasts containing the full XML/HTML error page from the CRM (because `/api/2.0/mail/messages/markread` (and sometimes accounts/folders) return HTML error bodies instead of JSON; the proxy + parseApiError surfaces the body text on !ok / bad JSON). Even when the call "succeeded" in prior attempts, closing + re-opening the mail modal (or reload) caused re-fetched messages to lose the read state (CRM list items apparently don't reflect the mark, or the mark itself wasn't taking effect).  

Implemented full *dashboard-side* persistence:  
- `mailDashboardReadIds` (in-memory Set + localStorage, portal-URL keyed) records which message ids the user has marked read *in the dashboard*.  
- On every load of messages the fresh rows get `.read = true` forced for any in the Set.  
- `renderMailList` `isRead` decision ors the Set (so `.mail-row-read` darker styling applies regardless of what the CRM list payload says).  
- Toolbar mark/unread are now local-first (always update Set + in-memory + re-render + immediate list style); the CRM api call is attempted only best-effort inside its own try (console.warn only, never surfaces the HTML to the user, never prevents the dashboard mark from taking effect).  
- `markMailMessageRead` (expand auto-mark path) also writes the Set.  
- Badge: `lastMailUnreadBadge` preserved on any error in `updateMailUnreadBadge` (so a once-successful count doesn't vanish); local mark-read does optimistic `decrementMailUnreadBadge` + updates lastKnown; load calls are present in showApp, ensurePresenceOnLogin, open, and the badge fn itself.  
- `openMailInboxModal` no longer wipes the read overrides (only volatile bits like selected/messages/page).  
Result: marks via the buttons now produce clean toasts, apply the darker style immediately, the header indicator decrements and survives transient mail-endpoint glitches, and — crucially — when you close the popup and open it again (or reload the dashboard), the emails you marked read via the dashboard stay showing as read (darker) in the list. User can still go to the native mail module later to bulk-mark as read there for server-side unread counts / other clients.

The root cause (why the markread POST returns HTML and/or doesn't affect the messages list payload) remains for later diagnosis against the live OnlyOffice mail addon (possible causes: endpoint not present/supported in this Community Server version, requires different body shape e.g. `ids` vs `messageIds` or folderId/accountId context, auth/proxy header issue specific to /mail/*, etc.). Per explicit user guidance we treat marks as dashboard-only for now.

**Viewer-only mode (current):** Per follow-up instructions, no server pushes for read/unread or anything else (mark handlers and markMailMessageRead stripped of api calls; badge indicator and delete button hidden; no /mail/* status polling from viewer paths). The feature is now strictly a read-only viewer. A narrow warning sidebar was added inside the popup with the concise list of limitations (cross-referenced to this issue). Local viewer "mark read/unread" and expand visuals (darker rows via the Set) are retained only for in-viewer distinction and session persistence. Server status pulls (if list provides via tolerant getter) are for display only in the viewer. See the sidebar content in the modal for the list.

**Further diagnosis (read/unread status from the mail module + indicator):**  
User question: "Are you not able to pull the read/unread status of an email from the mail module? Is that why it shows all the emails as unread?" — Yes (for the inbox list UI).  

The modal inbox list (`/api/2.0/mail/messages?...` summaries + `renderMailList`) only ever inspected top-level `m.read || m.isRead`. The summary list items returned by the mail module frequently omit a usable read flag (or use other keys: seen/IsSeen/IsNew/unread (inverted), flags.read, etc.). The full detail (`fetchMailMessage` → `/mail/messages/{id}`) is much more likely to carry the flag, but it was only used for the expanded body, not to drive list row styling or persistence.  

Consequently, without a prior local dashboard mark, rows always rendered without `.mail-row-read` (the darker style requested for visual difference between read and unread). The `mailDashboardReadIds` Set + localStorage (added for the broken mark *write*) only covered marks performed inside the dashboard; native CRM mail reads were invisible to our list.

Fix: added `getMailMessageIsRead(m)` (casing + inversion + light nesting tolerant, modeled on the existing `normalizeMailMessage`), wired into list load (promote any server-true read into the dashboard Set for cross-reopen survival) + render decision, and on successful expand detail fetch (backfill from full mail). Debug `console.debug` output of raw list rows (and badge folder totals) was added so the actual payload keys are visible in the browser console for further tuning if needed.

The header indicator (badge) had similar fragility: the accounts + per-account folders unread* sum could hit the same HTML error responses or different field names on folder/account objects, causing the catch to hide or zero the badge. We expanded candidate keys (`unseenCount`, `unseen`, `newMessages`, account-level unread, etc.), added a no-`accountId` folders fallback (some setups aggregate there), an explicit badge refresh after the messages list render, and kept the lastKnown preservation + optimistic decrement on local marks.

See the code comments in `getMailMessageIsRead`, the load/ render / expand paths, and `updateMailUnreadBadge`. The local overrides for *writing* marks remain (write endpoint still returns HTML); this work focuses on *reading* server status when the module provides it and making the indicator resilient.

### Files changed

| File | Role |
|------|------|
| `public/index.html` | Hide `.mail-account-bar`; sidebar already hidden + comments |
| `public/app.js` | + mailDashboardReadIds + localStorage load/save + lastKnown + decrement helpers; load calls in show/ensure/open/badge; open no longer resets overrides; loadMessages applies overrides to rows; render isRead ors the Set; mark handlers now local-first (Set+save+optimistic decrement+clean toasts) with best-effort api inside; markMailMessageRead also maintains Set; badge preserves lastKnown on HTML errors and does optimistic down on local marks; **new**: `getMailMessageIsRead` (tolerant of list vs detail shapes) + promote server reads into Set + debug console output in load/badge + expanded unread key extraction + no-accountId folders fallback + explicit badge kick after list render |
| `ISSUES.md` | This entry (verbatim user symptoms + explicit "Disable it..." instructions) + follow-up for the XML/HTML error + non-persistent list state on reopen + further diagnosis for server read status not appearing in list summaries + badge indicator robustness |

### Acceptance criteria (for re-enable)

- [ ] Mark read + mark unread toolbar buttons: selection enables them; click produces toast, immediately applies darker read style (or removes), survives the internal reload, and server-side state changes (verified in native CRM web mail too).
- [ ] No pulldown visible; loads always show combined results from all accounts' inboxes (50/page, search works, pagination, select-all, delete etc. unaffected). Badge still accurately reflects total unread across inboxes.
- [ ] Re-enable sidebar + link: selecting deal + Link produces history event exactly matching native mail module link (the `The email "subj" has been received ... Author: "name" <addr>` string, proper category, ad with mailMessageId etc.), appears with mail icon in deal feed/preview, expand works, and also marks read.
- [ ] Badge visible with correct count on header button at login / showApp (no manual open of modal required).
- [ ] All changes behind a flag or easy revert until verified end-to-end on the production portal (live mail accounts, real unread, link roundtrip).

### References

- Mail list: `GET /api/2.0/mail/messages?{page,page_size,sortorder,search,accountId?,folderId?}`
- Mark: `POST /api/2.0/mail/messages/markread` body `{messageIds: number[], asRead: bool}`
- Accounts/folders for badge + old selector: `/api/2.0/mail/accounts`, `/api/2.0/mail/folders?accountId=...`
- Link primary: `/api/2.0/mail/crm/link` (messageIds + crmEntityId + crmEntityType:2); fallback history POST with exact content + additionalData + category.
- History mail parse in app (for preview/expand): parseHistoryMailPayload, isMailLinkedHistoryEvent, extractMailMessageIds, crmMailReceivedLine, renderHistoryMailReceivedSummary.
- See also prior mail work in CHANGELOG / RELEASE notes for v1.3 context.