# Future features — Vanguard CRM Dashboard

Roadmap and implementation notes for planned work. Production: **https://dashboard.vanguardadj.com**.

Related docs:

- **[ISSUES.md](./ISSUES.md)** — open bugs with acceptance criteria
- **[docs/UPDATE_AND_DEPLOY.txt](./docs/UPDATE_AND_DEPLOY.txt)** — ship changes to GitHub and the server
- **[Toaster_Features](./Toaster_Features)** — widget ideas inspired by major CRMs

---

## FEAT-001 — Tile opportunity preview popup (priority: high)

### Goal

When the user clicks an **opportunity card** on a group tile (not the ✎ edit button), open a **read-only preview modal** that shows:

1. **Opportunity fields** — title, stage, value, contact, due date, responsible, tags, and visible **user fields** (custom fields).
2. **Recent history** — up to **10** CRM events for that opportunity (newest first).

Actions in the modal:

- **Open in CRM** (existing deep link)
- **Edit deal** — opens the existing deal-edit modal (`openDealEditModal`)
- **Close** / Escape

### UX (recommended)

- Reuse existing `.modal` / `.modal-card` patterns from `deal-edit-modal` and `create-opportunity-modal`.
- New elements in `public/index.html`: e.g. `#opp-preview-modal`, `#opp-preview-body`, `#opp-preview-history-list`.
- Card click: on `.card` (not `.card-edit-btn`, not `.card-title-link`) → `openOpportunityPreviewModal(oppId, group)`.
- Loading state: spinner or “Loading…” while fetching.
- History list: category title, author, date, plain-text snippet (strip HTML like notifications tile).

### API (already used elsewhere in the app)

| Data | Endpoint | Notes |
|------|----------|--------|
| Full opportunity | `GET /api/2.0/crm/opportunity/{id}` | May need `.json`; merge with card cache if fresh enough |
| Custom field values | `GET /api/2.0/crm/opportunity/{id}/customfield` (or `/customfields`) | Same fallbacks as `loadOpportunityDetails` in `app.js` |
| Definitions | `GET /api/2.0/crm/opportunity/customfield/definitions` | Labels for user fields |
| History (10 events) | `GET /api/2.0/crm/history/filter?startIndex=0&count=10&entityType=opportunity&entityId={id}` | Reuse `unwrapHistoryEvents()` |

### Implementation steps

1. **HTML** — Add preview modal skeleton (title, fields grid, history `<ul>`, footer buttons).
2. **CSS** — `public/styles.css`: compact field grid, history row typography; max-height + scroll for history.
3. **JS** — `openOpportunityPreviewModal(opp, group)`:
   - `Promise.all([ fetch opportunity, fetch custom fields, fetch history ])`
   - Map fields using existing helpers: `formatMoney`, `getOpportunityContactLabel`, `resolveOppStageId`, `customFieldLabel`, etc.
4. **Wire click** — In `renderCard()`, `card.addEventListener('click', …)` with guard for edit button / external link.
5. **Keyboard** — Escape closes preview; focus trap optional (match other modals).
6. **Test** — Opportunity with 0, 1, and 10+ history events; long HTML notes; missing contact.

### Acceptance criteria

1. Click card body → preview opens &lt; 2s on typical deal.
2. History shows ≤ 10 items, newest first.
3. Edit button in preview opens deal-edit modal; preview closes or stacks cleanly.
4. “Open in CRM” opens correct OnlyOffice opportunity URL.
5. No regression on ✎ edit or title link (still open edit / new tab).

---

## FEAT-002 — Fix New Opportunity custom user fields (ISSUE-001)

**Status:** Blocked in UI (`CREATE_OPP_USER_FIELDS_ENABLED = false` in `public/app.js`).

### Problem

User fields on **New Opportunity** do not persist in CRM although the deal is created. Documented in **[ISSUES.md](./ISSUES.md)**.

### Research / fix plan

1. **Capture golden path from native CRM**
   - Browser DevTools → Network on **office.vanguardadj.com**.
   - Create one opportunity with one text field, one select, one date, one checkbox filled.
   - Record: create `POST` body, any follow-up `POST .../customfield/{id}`, query params (`fieldValue`), content-type.

2. **Compare to this app**
   - `buildOpportunityCreateBody`, `applyCreateOpportunityCustomFields`, `postOpportunityCustomFieldValue` in `app.js`.
   - Ensure `server.py` does not send `{}` on custom-field POST when value is in query string (fix already applied; verify).

3. **Run probe script on desktop**

   ```bash
   cd ~/crm-kanban
   # .env with ONLYOFFICE_USER, ONLYOFFICE_PASSWORD, ONLYOFFICE_PORTAL_URL
   python3 scripts/probe_custom_fields.py
   ```

4. **Type-specific encoding**
   - Select / multi-select: CRM may expect option id, not display text.
   - Dates: app uses `MM/DD/YYYY`; confirm tenant locale.
   - Checkbox: `"true"` / `"false"` strings per `formatCustomFieldValueForApi`.

5. **Order of operations**
   - Try: create deal **without** `customFieldList`, then only per-field `POST .../customfield/{fieldId}?fieldValue=...` after id is known (with 200ms delay if needed).

6. **Re-enable UI**
   - Set `CREATE_OPP_USER_FIELDS_ENABLED = true`.
   - Remove “not available yet” hint in create modal.
   - Verify in native CRM; no “user fields not saved” toast.

### Files

| File | Role |
|------|------|
| `public/app.js` | Create modal, collect/apply custom fields |
| `server.py` | Proxy POST body rules |
| `scripts/probe_custom_fields.py` | API experiments |
| `ISSUES.md` | Close when acceptance criteria pass |

---

## FEAT-003 — Attachments on event notes in deal-edit modal

### Problem

The deal-edit modal only supports **plain-text** event notes. The UI states: *“(You can not attach files in this popup)”* (`public/index.html`). Users expect to attach files like in native CRM when adding a history event.

### Current behavior

- `createOpportunityHistoryEvent()` posts JSON to `POST /api/2.0/crm/history` with `content` (HTML from `plainTextToNoteHtml`), `categoryId`, optional `notifyUserList`.
- No `multipart/form-data` or file ids in the payload.

### Research plan

1. **Native CRM capture**
   - In OnlyOffice CRM, open an opportunity → add event with **file attachment**.
   - Network tab: look for `files`, `upload`, `history`, `attachment` endpoints and request shape.

2. **Likely OnlyOffice Workspace patterns** (confirm on your portal)
   - File upload: `POST /api/2.0/files` (multipart) → returns file id.
   - History event may accept file references in `content` HTML, `fileIds`, or a separate link API after event creation.

3. **Proxy changes (`server.py`)**
   - Today the proxy is JSON-oriented. File upload may require streaming multipart through the dashboard proxy without breaking body parsing.
   - Option A: upload directly from browser to `office.vanguardadj.com` with session/cookie (complex cross-origin).
   - Option B: extend `server.py` to forward `multipart/form-data` to the portal (preferred for single-origin dashboard).

4. **UI**
   - `<input type="file" multiple>` in deal-edit fieldset.
   - Show selected file names; max size aligned with nginx `client_max_body_size` (50M on estimate-nginx).
   - On submit: upload files first, then create history event with returned ids embedded per API spec.

5. **Acceptance criteria**
   - Attach one PDF/image in deal-edit note → visible on same event in native CRM.
   - Error toast if upload fails; deal stage/tag/due saves still work if note fails (or all-or-nothing — decide in UX).

### Risk

If the portal API only allows attachments through the full CRM UI (undocumented), fallback is **“Open in CRM to attach files”** link until API is confirmed.

---

## Other ideas (backlog)

See **[Toaster_Features](./Toaster_Features)** for dashboard tile/widget ideas (pipeline metrics, stale deals, email, etc.).

| ID | Idea | Effort |
|----|------|--------|
| FEAT-004 | Persist `estimate-network` in `docker-compose.yml` on server | Low |
| FEAT-005 | Custom fields on **edit** deal (not only create) | Medium |
| FEAT-006 | Export group/opportunities to CSV | Medium |
| FEAT-007 | Global search across opportunities | High |

---

## Suggested implementation order

1. **FEAT-001** — Preview popup (high user value, uses existing APIs).
2. **FEAT-002** — Custom fields on create (unblock ISSUE-001).
3. **FEAT-003** — Note attachments (needs API research).
4. Pick items from **Toaster_Features** by priority.