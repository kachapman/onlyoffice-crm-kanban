# Future features — Vanguard CRM Dashboard

Roadmap and implementation notes for planned work. Production: **https://dashboard.vanguardadj.com**.

Related docs:

- **[ISSUES.md](./ISSUES.md)** — open bugs with acceptance criteria
- **[docs/UPDATE_AND_DEPLOY.txt](./docs/UPDATE_AND_DEPLOY.txt)** — ship changes to GitHub and the server
- **[Toaster_Features](./Toaster_Features)** — widget ideas inspired by major CRMs

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