# Future features — Sietch CRM Dashboard

Roadmap and implementation notes for planned work. Production: **https://dashboard.publicadjustermidwest.com**.

Related docs:

- **[ISSUES.md](./ISSUES.md)** — open bugs with acceptance criteria
- **[docs/UPDATE_AND_DEPLOY.txt](./docs/UPDATE_AND_DEPLOY.txt)** — ship changes to GitHub and the server
- **[Toaster_Features](./Toaster_Features)** — widget ideas inspired by major CRMs

---

## Document Server Integration (FEAT-022) — IMPLEMENTED in v3.0.0

**Status:** ✅ Completed. OnlyOffice Document Server (Community Edition) integrated for document viewing/editing.

### Architecture

- **Document Server** runs as a standalone Docker container (onlyoffice/documentserver:latest)
- **Link-out initially:** Dashboard shows document links that open in new tab on Document Server
- **Embedded editor:** Future phase — iframe embed in dashboard
- **Auth:** Document Server uses JWT tokens signed by dashboard
- **Storage:** Documents stored locally, accessed via Document Server API

### Implementation

- `server.py` — Document storage endpoints, Document Server proxy, JWT signing
- `docker-compose.yml` — Added docserver + redis services
- `init.sql` — Added `project_documents` table for file metadata
- `public/app.js` — Document link updates, upload UI stubs

### Migration Script Fixes (v3.0.0)

Known issues in `migrate_from_onlyoffice.py` to fix:
- `event_id` always NULL — history events not linked to projects
- `uploaded_by` uses wrong user — defaulting to admin instead of original uploader
- No `mime_type` — file type not preserved
- No retry on download — network failures skip files

---

## Offline Resilience — Mutation Queue for CRM writes (implemented)

Client-side queue (localStorage) + background retry worker for transient failures (network, 5xx from proxy/CRM, cross-droplet blips).

- All important mutators (stage change, due date, tags, history/notes, task create + close/reopen) now transparently queue on transient errors while preserving optimistic UI.
- FIFO replay on recovery with status badge ("N pending"), toasts on enqueue + successful sync, and light reconciliation (loadTasks / refreshAll).
- Hard errors (validation, auth, etc.) continue to fail immediately with original UX.
- No server.py changes required for this feature. Fully additive in public/app.js following existing api() + mutator + refresh patterns.
- See the session plan.md (in .grok history) for the full approved design, verification matrix, and rationale.

This directly addresses the "Offline Resilience (Mutation Queue)" part of the prior implementation suggestions. The real-time SSE polling bridge remains future work.

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

## FEAT-002 — Fix New Opportunity custom user fields (ISSUE-001) (COMPLETED in v1.7.0)

**Status:** ✅ Completed 2026-06-11. `CREATE_OPP_USER_FIELDS_ENABLED=true`. All acceptance criteria met.

**Root cause:** Two bugs — (1) `collectCreateOppCustomFieldValues()` DOM selector matched the wrapper `<div>` instead of the actual `<input>`, so every field was silently skipped; (2) `buildCustomFieldListForApi()` returned `{Key, Value}` (PascalCase) format which, combined with flat `customField_{id}` fields, caused 400 errors.

**Fix:** Query `input, select, textarea` inside the wrapper div; use only `{key, value}` camelCase in `customFieldList`; include `customFieldList` in create body alongside per-field POST fallback. See CHANGELOG.md and [ISSUES.md](./ISSUES.md) for full details.

---

## FEAT-003 — Attachments on event notes (COMPLETED in v1.6+)

Implemented: native UploadProgress.ashx + history form-urlencoded with fileId[], text priority, 25MB, plain no-icon selected list, right-side 10s queue list near #mutation-sync-status (all items, ✓ success, ✕ fail), works in deal-edit/quick-note/side/notes-tile paths.

See CHANGELOG and public/app.js (uploadAttachmentForNote, extended createOpportunityHistoryEvent, submit paths, note queue render + 10s prune).

### Problem (historical)

The deal-edit modal only supported **plain-text** event notes (old hint removed). 

### Research (completed)

1. **Native CRM capture** (user provided curl data) — used exactly.
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
    - Show selected file names; max size aligned with nginx `client_max_body_size` (100m on host nginx for dashboard.publicadjustermidwest.com).
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

## FEAT-023 — Stale Deals Tile (SCRAPPED in v1.8.0)

**Status:** ❌ Abandoned 2026-06-12. See ISSUE-004 in ISSUES.md for full post-mortem.

### Why it was scrapped
- **Attempt A (activity-based)**: Used `state.feedRawItems` (CRM notifications feed) to find last activity per opportunity. Failed because feed only covers last 30 days (max 150 events). Most opportunities had no activity found.
- **Attempt B (due-date-based)**: Switched to `expectedCloseDate` on opportunity objects. Added threshold dropdown (1 week / 30 days / 90+ days). Still failed to list any deals in any time period during testing — `expectedCloseDate` was not reliably past-due on open deals.
- **Result**: All code removed from `public/app.js`, `public/index.html`, `public/styles.css`.

### Future possibilities
- A proper CRM-side query for "last modified" timestamp (not available in current API).
- A different staleness metric (e.g., "no note added in 30 days" using a dedicated endpoint).
- Revisit if CRM API provides opportunity `updatedAt` or `lastActivityDate` in the future.

---

## FEAT-007 — Advanced Opportunity Search (enhanced CRM-style filtering)

**Status:** Planned — current implementation is title-only. Needs expansion.

### What the native CRM search does

In OnlyOffice CRM, the Opportunities page has a search/filter panel that lets you:
- Filter by stage (single or multi-select)
- Filter by responsible user (team member)
- Filter by tags (multi-select)
- Filter by custom/user fields (e.g., "Claim Type", "Loss Date", "Adjuster")
- Filter by date range (created, expected close, last modified)
- Filter by deal value (min/max)
- Full-text search across title, description, contact name
- Save and name filter combinations

### Current dashboard implementation (v1.8.0)

- Header search bar: searches by **title only**
- Queries local loaded opportunities + CRM `/api/2.0/crm/opportunity/filter`
- Returns title + ID only
- Single-select → opens preview modal
- No filters, no custom field search, no saved searches

### Why this matters

The user explicitly needs to find **opportunities with similar custom/user fields** (e.g., "all claims with Claim Type = Hail Damage", "all deals with Loss Date in March"). This is a primary CRM workflow that currently requires leaving the dashboard.

### Implementation phases

| Phase | Feature | Effort | APIs |
|-------|---------|--------|------|
| A | Rich search results (show stage, due date, value, contact in dropdown) | Low | Existing filter API |
| B | Filter by stage + responsible user | Low | Existing filter API |
| C | Filter by tags (multi-select) | Low | Existing filter API |
| D | **Filter by custom/user fields** | Low | Existing filter API + custom field defs |
| E | Date range filters (created, closing, last modified) | Low | Existing filter API |
| F | Full-text search (description, contact, company) | Medium | May need CRM config |
| G | Saveable searches / named filters | Medium | Profile storage |

### Priority: Phase D first

Custom/user field filtering is the most-used workflow and should be implemented first. It leverages:
- `state.customFieldDefs` (already loaded in dashboard)
- `opportunity.userFields` (already available on opportunity objects)
- CRM filter API already supports `customFieldKey` + `customFieldValue` parameters

### Files to modify

- `public/app.js` — Search logic, filter UI, custom field dropdowns
- `public/index.html` — Search modal / filter panel
- `public/styles.css` — Filter dropdowns, multi-select, results list
- `user_profile_store.py` — Saved search persistence (Phase G)

### See also

- `Toaster_Features` — Cross-reference for CRM search patterns
- `ISSUES.md` — No blocking issues

---

## Other ideas (backlog)

See **[Toaster_Features](./Toaster_Features)** for dashboard tile/widget ideas (pipeline metrics, stale deals, email, etc.).

| ID | Idea | Effort |
|----|------|--------|
| FEAT-004 | Persist `estimate-network` in `docker-compose.yml` on server | Low |
| FEAT-005 | Custom fields on **edit** deal (not only create) | Medium |
| FEAT-006 | Export group/opportunities to CSV | Medium |
| FEAT-007 | **Advanced Opportunity Search** — filter by stage, user, tags, custom fields, date range (see detailed section below) | High |
| FEAT-022 | OnlyOffice document / spreadsheet tile (explore) | High — see above |
| FEAT-023 | **Documents: Save-as conversion** — export doc to PDF/ODT/Markdown from the documents modal context menu or toolbar. OnlyOffice Document Server supports format conversion via callback, but a simpler approach is server-side conversion using LibreOffice headless (`soffice --convert-to pdf`). Needs Docker container with LibreOffice or a dedicated conversion API. | Medium |

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

## Suggested implementation order

**Status:** Investigated 2026-06-26. Not implemented — parked for future consideration.

### Goal

Embed the **native OnlyOffice CRM mail module** (or the full CRM) inside the dashboard as an iframe tile or popup modal, giving access to 100% of CRM functionality without leaving the dashboard.

### Background

The API-based mail module approach was tried multiple times (ISSUE-002) and failed on:
- Read/unread status pushes to server being unreliable
- Account/inbox selector dropdown never working
- Various incomplete API coverage

### Investigation findings (2026-06-26)

**Headers from `office.publicadjustermidwest.com`:**
- `X-Frame-Options: SAMEORIGIN` — blocks framing from other domains
- No CSP `frame-ancestors` restriction
- No CORS headers

**Quick test:** Added `/crm-proxy/` route to `server.py` that fetches CRM pages and strips `X-Frame-Options`. Confirmed the page loads through the proxy with framing headers removed.

**Critical blocker (asset resolution):** The CRM's HTML and JS use **absolute paths** for assets and API calls:
- Assets: `/skins/default/...`, `/discbundle/common/css/...`
- API calls: `/api/2.0/mail/conversations/...`

When loaded under `/crm-proxy/` on the dashboard domain, these resolve to the dashboard's server, not the CRM portal.

### The cleanest path forward (subdomain proxy)

A separate **nginx proxy subdomain** — no URL rewriting, no Python overhead, everything works natively.

1. **DNS:** Point `crm-proxy.dashboard.publicadjustermidwest.com` to the dashboard droplet IP
2. **nginx:** Add a `server_name` block that proxies ALL traffic to `https://office.publicadjustermidwest.com` and strips `X-Frame-Options`
3. **Iframe:** Dashboard loads `https://crm-proxy.dashboard.publicadjustermidwest.com/addons/mail/Default.aspx`
4. **Auth:** The `oo_token` cookie must be scoped to `.publicadjustermidwest.com` (parent domain) so both subdomains can read it. nginx passes it as the `Authorization` header.

**Why this works:** Because the iframe loads from a **different subdomain** (not a sub-path), absolute paths like `/api/2.0/...` and `/skins/default/...` all resolve to the same nginx proxy → portal. No HTML rewriting needed. The CRM's own JS works unmodified.

### Risks

| Risk | Mitigation |
|------|-----------|
| CRM updates change bundles or HTML | Monitor on update; fix nginx config if needed |
| `oo_token` cookie scope change | Set on `.publicadjustermidwest.com` parent domain |
| nginx caching stale assets | Short cache TTL on proxy responses |
| WebSocket / SignalR connections | May need separate proxy config |
| Performance under load | nginx handles proxying in C — negligible overhead |

### Files (when pursued)

| File | Change |
|------|--------|
| Production nginx config (`/opt/estimate-enhancer/nginx.conf`) | New `server_name` block for `crm-proxy.*` |
| `public/app.js` | Add "Open CRM Mail" tile/modal with iframe |
| `public/index.html` | Iframe container in modal or tile body |
| `public/styles.css` | Iframe sizing, full-height modal |
| `server.py` | (local dev) Catch-all proxy for `/crm-proxy/*` with body forwarding, auth |

---

## Suggested implementation order

1. **FEAT-001** — Preview popup (high user value, uses existing APIs).
2. **FEAT-002** — Custom fields on create (unblock ISSUE-001).
3. **FEAT-003** — Note attachments (needs API research).
4. Pick items from **Toaster_Features** by priority.
5. **FEAT-022** — Document/spreadsheet tile: run Phase B spike before committing to Phase C; Phase A if embed is blocked or deferred.
6. **FEAT-024** — Native CRM iframe embed (investigated, not implemented — see above).