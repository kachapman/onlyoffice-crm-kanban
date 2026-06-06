# Future features — Vanguard CRM Dashboard

Roadmap and implementation notes for planned work. Production: **https://dashboard.vanguardadj.com**.

Related docs:

- **[ISSUES.md](./ISSUES.md)** — open bugs with acceptance criteria
- **[docs/UPDATE_AND_DEPLOY.txt](./docs/UPDATE_AND_DEPLOY.txt)** — ship changes to GitHub and the server
- **[Toaster_Features](./Toaster_Features)** — widget ideas inspired by major CRMs

---

## FEAT-021 — Header quick note + icon actions (implemented)

### Shipped behavior

- **New opportunity** — icon-only **clipboard-plus**, `btn-primary` (bright blue).
- **Quick note** — icon-only **notebook-pen**, `btn-primary` (same blue).
- **Add tile** / **Refresh all** — icon-only, `btn-secondary`.
- **Quick note** modal: search/select opportunity (required), **note type** dropdown (CRM history categories), optional **Change Deal Due Date** and tags, required event note, notify users.
- Reuses deal-edit CRM helpers: `updateOpportunityDueDate`, `applyDealTagChanges`, `createOpportunityHistoryEvent`.

### Files

- `public/index.html`, `public/styles.css`, `public/app.js`

### Labels

All opportunity due-date fields in modals use **Change Deal Due Date** (deal-edit, quick-note, create-opportunity).

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

**Status:** In progress — omit-on-create + delay strategy applied; UI still blocked pending portal verification. (`CREATE_OPP_USER_FIELDS_ENABLED = false` in `public/app.js`).

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
   - **Tried (post v1.1):** `buildOpportunityCreateBody` omits `customFieldList` entirely; 300ms delay + per-field POSTs only in submit path. Updated probe tests Variant A (no-list create) vs B.

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

## FEAT-022 — OnlyOffice document / spreadsheet tile (explore — not scheduled)

**Status:** Backlog for research only. No implementation planned yet.

### Goal

Add a new **Add tile** type that lets users work with an OnlyOffice **Word** or **Excel** file from the dashboard — ideally an **editable embed** inside the tile; optionally a lighter **open in portal** link first.

### Why this is different from current tiles

Existing tiles (kanban, ICS calendar, markdown notes) only read CRM/static data. An editable document tile needs:

| Piece | Role |
|-------|------|
| **Document Server** | Hosts `DocsAPI.DocEditor` (editor UI + `api.js`). May already run behind `office.vanguardadj.com`; URL and JWT must be confirmed. |
| **File source** | Workspace **Files API** (or CRM-linked file ids). Dashboard already builds download URLs via `filehandler.ashx?fileid=…`. |
| **Backend broker** | `server.py` (or similar) to sign config, **download** file for DS, handle **save callback** from DS back to portal. |
| **Auth** | User’s portal token (`oo_token`); every `fileId` must be validated via portal API — never trust client-supplied ids alone. |

Docs: [DocEditor](https://api.onlyoffice.com/docs/docs-api/usage-api/doceditor/), [config](https://api.onlyoffice.com/docs/docs-api/usage-api/config/), [embedding FAQ](https://api.onlyoffice.com/docs/docs-api/more-information/faq/embedding/).

### CRM tie-in

Opportunities already use a **Shared Spreadsheet** user field (hidden on create-opportunity modal). Tile designs to explore:

- **Personal tile** — user picks one file when adding the tile (stored in profile).
- **Group tile** — file id/link from opportunity custom field for deals on that board (needs consistent field format: URL vs raw `fileid`).

### Implementation phases (pick after spike)

#### Phase A — Link-out tile (~1–3 days)

- New tile type in Add Tile modal; persist `documentTiles[]` in user profile (like `notesTiles` / `calendarTiles`).
- Config: tile name + `fileId` or portal document URL (paste or file picker later).
- **Open in OnlyOffice** opens native portal editor in a new tab.
- **Pros:** No Document Server wiring on dashboard. **Cons:** Not embedded in tile.

#### Phase B — Integration spike (~1–2 days)

On `office.vanguardadj.com`, open a spreadsheet in the browser and capture Network:

- Document Server hostname
- File download request shape
- Save callback URL and payload
- Whether JWT is required on editor config

Decide if iframe-to-portal is viable (often blocked by SSO / `X-Frame-Options` / third-party cookies).

#### Phase C — Full Docs API embed (~2–4+ weeks)

**Frontend** (same checklist as [Toaster_Features](./Toaster_Features) “new tile type”):

1. Add tile type in `public/index.html` + `public/app.js`
2. `documentTiles[]` in `user_profile_store.py`; tile id `document-{uuid}`
3. Tall/double tile height; load DS `api.js`; `new DocsAPI.DocEditor(placeholder, config)`
4. Destroy editor on tile remove/collapse (avoid leaks)

**Backend** (`server.py`):

1. `GET /api/document-editor/config?fileId=…` — build signed config, correct `documentType` (`cell` / `word` / `slide`), `document.key` versioning
2. `GET /api/document-editor/file?fileId=…` — stream file from portal with user token
3. `POST /api/document-editor/callback` — OnlyOffice save handler; upload back via Files API
4. Authorization: verify file access through portal API for current user

**Infra**

- JWT secret aligned with Document Server
- Callback URL reachable **from Document Server** (not only browser) — e.g. `https://dashboard.vanguardadj.com/api/...`
- Nginx/CSP: `frame-src` for editor origin; proxy timeouts for large saves (may exceed 120s)
- Licensing / connection limits on Document Server

### Risks

1. Callback not reachable from DS container → saves fail silently or error in editor
2. Wrong `document.key` → corruption or “file locked” errors
3. JWT mismatch → editor does not load
4. iframe-to-portal embed without Docs API → auth/CSP failures

### Acceptance criteria (when pursued)

1. User can add a document/spreadsheet tile and bind a file (id or picker).
2. **Phase A:** Open in portal edits the real file; reopen shows changes.
3. **Phase C:** Edit inside tile; save via callback; same file opens in portal with updates.
4. User cannot open arbitrary files by guessing `fileId` (portal denies unauthorized ids).

### Files (when implemented)

| File | Role |
|------|------|
| `public/index.html`, `public/app.js` | Add tile UI, tile render, DocsAPI lifecycle |
| `public/styles.css` | Tile chrome, editor container height |
| `user_profile_store.py` | `documentTiles[]` persistence |
| `server.py` | Config signing, file proxy, callback |
| `deploy/nginx-dashboard*.conf` | Callback routes, body size, CSP/frame-src |
| `Toaster_Features` | Cross-reference |

---

## Other ideas (backlog)

See **[Toaster_Features](./Toaster_Features)** for dashboard tile/widget ideas (pipeline metrics, stale deals, email, etc.).

| ID | Idea | Effort |
|----|------|--------|
| FEAT-004 | Persist `estimate-network` in `docker-compose.yml` on server | Low |
| FEAT-005 | Custom fields on **edit** deal (not only create) | Medium |
| FEAT-006 | Export group/opportunities to CSV | Medium |
| FEAT-007 | Global search across opportunities | High |
| FEAT-022 | OnlyOffice document / spreadsheet tile (explore) | High — see above |

### FEAT-008 — AccuLynx API research (post-v1.1, from user list)

**Status:** Research complete; suggestions documented for future implementation. No code changes yet. Abandoned for now (user feedback: document and park).

#### Findings (from AccuLynx public docs + integrations, June 2026)
- AccuLynx is a leading all-in-one roofing/claims/estimating CRM and business management platform (sales, production, finance, operations). Used by contractors for leads, jobs, contacts, estimates, milestones, photos, materials pricing, etc.
- **API:** Public REST API v2 at `https://api.acculynx.com/api/v2`. 
  - Auth: Bearer token (API key). Admin creates/names key in AccuLynx Account Settings → API section. Include `Authorization: Bearer <key>` on all requests.
  - Rate limits + terms apply (see their docs).
- **Key endpoints** (examples; full reference at https://apidocs.acculynx.com ):
  - Jobs: list, get by id (includes contacts, milestones, etc.).
  - Estimates: list/get (with includes=job,createdBy,sections...).
  - Contacts, users, milestones, webhooks/subscriptions for events.
- **Existing integrations:** Hover (measurements/photos), Make/Zapier, HubSpot, accounting, etc.
- **Suggestions for future (low-effort start on local dashboard):**
  - Store AccuLynx API key in user profile (local dev only for safety).
  - Manual "Import from AccuLynx" or small "AccuLynx Jobs" header widget / toaster: fetch recent jobs, map to opp create (title, contact, value, custom fields for claim # etc.).
  - Webhook receiver (if running locally) for auto-create/update on job events.
  - Benefits for Vanguard: faster data transfer from field tools into OnlyOffice CRM, less double entry.
  - Risks: API keys, mapping/deduping, only useful when dashboard runs on same machine as user workflow.

**References:** https://apidocs.acculynx.com, existing Hover/Make integrations.

---

## Other ideas (backlog)

#### Findings (from AccuLynx public docs + integrations, June 2026)
- AccuLynx is a leading all-in-one roofing/claims/estimating CRM and business management platform (sales, production, finance, operations). Used by contractors for leads, jobs, contacts, estimates, milestones, photos, materials pricing, etc.
- **API:** Public REST API v2 at `https://api.acculynx.com/api/v2`. 
  - Auth: Bearer token (API key). Admin creates/names key in AccuLynx Account Settings → API section. Include `Authorization: Bearer <key>` on all requests.
  - Rate limits + terms apply (see their docs).
- **Key endpoints** (examples; full reference at https://apidocs.acculynx.com ):
  - Jobs: list, get by id (includes contacts, milestones, etc.).
  - Estimates: list/get (with ?includes=job,createdBy,sections...).
  - Contacts, users, leads, company settings, milestones.
  - Webhooks: POST /webhooks/v2/subscriptions (subscribe to topics like job events), manage subscriptions.
  - Search variants for contacts/jobs.
- **Existing integrations** (patterns to follow): Hover (auto import measurements/photos), Make.com/Zapier (hundreds of actions: create contact/job, get milestone, watch jobs, make custom call), HubSpot/Angi/CallRail/Roofle (lead sync), accounting software (2-way financial sync).
- **Code samples:** Available in their docs for .NET, Node, Python (Azure Functions examples for webhooks), etc.

#### Suggested implementations for this dashboard (to speed data transfer from AccuLynx → OnlyOffice CRM / Vanguard workflow)
- **Config:** Store AccuLynx API key securely (user profile extension like other prefs, or per-portal in .env for self-hosted; never hardcode; warn on exposure). Add simple "AccuLynx" section in settings or a tile config.
- **Low-effort start (Phase A, days):** 
  - "Import from AccuLynx" button or new "AccuLynx Jobs" toaster tile (addable via Add Tile, persisted as e.g. acculynxTiles[]).
  - On demand: poll recent jobs/leads/estimates via API (using key), display list with key fields (job #, contact, estimate value, stage/milestone).
  - Quick actions: "Create opp from this" → map to createCrmOpportunity (title, responsible, bidValue from estimate, tags, custom fields for claim#/photos link, expected close).
  - Dedupe: match on external id or title/contact + date.
- **Medium (Phase B):** Background or scheduled sync (server.py endpoint that polls with key; store last sync cursor); auto-create/update opps + contacts; pull estimate sections into notes or custom fields; attach "Open in AccuLynx" links.
- **Advanced (Phase C):** Webhook subscription (AccuLynx pushes to a public /api/acculynx/webhook on our dashboard or via nginx); verify signature; react to job created/updated/milestone → create or advance opp in CRM + post history event.
- **Data mapping ideas (Vanguard adjusting niche):** AccuLynx "job" → opp; estimate total → bidValue; photos/measurements → custom "Photo Drive Link" or notes; contacts → CRM contact link; milestones/status → stage + due date + tags; sync "Same Adjuster" or member fields.
- **Benefits:** Eliminates double-entry from field (AccuLynx) into OnlyOffice CRM; faster intake for adjusting work; live pricing/measurements already in AccuLynx.
- **Risks / considerations:** 
  - API key security (server-side only for writes; profile storage ok for read but encrypt at rest if possible).
  - Field mapping + deduping (AccuLynx job id vs CRM opp id; store externalId on opp?).
  - Rate limits, auth for multi-user (key is company-level?).
  - One-way vs two-way (start read-only import).
  - Requires AccuLynx admin to enable API + generate key per user/company.
- **Files (when implemented):** Extend user_profile_store.py + app.js profile for key/config; new tile or import modal in public/*; optional server.py routes for poll/webhook; FUTURE/Toaster updates; docs.

**References:** https://apidocs.acculynx.com (getting-started, reference, webhooks, code samples), AccuLynx integrations page, Hover/ Make.com examples, Reddit threads on custom tools.

See also user's post-v1.1 list in this session's plan.md and the new AGENTS.md.

---

## Suggested implementation order

1. **FEAT-001** — Preview popup (high user value, uses existing APIs).
2. **FEAT-002** — Custom fields on create (unblock ISSUE-001).
3. **FEAT-003** — Note attachments (needs API research).
4. Pick items from **Toaster_Features** by priority.
5. **FEAT-022** — Document/spreadsheet tile: run Phase B spike before committing to Phase C; Phase A if embed is blocked or deferred.