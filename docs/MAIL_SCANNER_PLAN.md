# Mail Scanner — Planning Document

> Created 2026-07-08. Last updated 2026-07-11 (Phase 5 ML scaffolding added: lazy sentence-transformers/all-MiniLM-L6-v2 loading, _ml_embed/_ml_classify stubs, ml_* fields in log entries, classifier head pickle support, INSTALL_ML build arg in scanner Dockerfile. ML not yet trained — returns None until labeled data + head fitted). is unconditionally forced through _bot_crm_proxy using BOT_CRM_EMAIL/PASSWORD in both _handle_api_get and _handle_api_post_put. The CRM Mail Quick View modal (Inbox tab) now guarantees the shared bot view of the two inboxes + bot tags to every user. Personal inboxes excluded. UI badge + notes added. + prior Phase 1-4 items).
> Scanned 200+ conversations from bot@vanguardadj.com inbox (accounts: requests@sherwoodestimates.com, crm@vanguardadj.online).
> Source of truth for the auto mail scanner feature.

**Current model (2026-07-11):**
- Scanner logic runs in an **independent Docker container on the CRM droplet** (8 GB RAM). Dashboard droplet (1 GB) hosts only the UI, admin surface, and proxies.
- **CRM Mail Quick View (Inbox tab) and ALL /api/2.0/mail* traffic (GET + mutations: mark, move, link, tag, accounts, conversations, messages, etc.) is unconditionally routed through bot credentials.** Server intercepts every `/api/2.0/mail*` call in both `_handle_api_get` and `_handle_api_post_put` and forwards it via `_bot_crm_proxy` using `BOT_CRM_EMAIL` / `BOT_CRM_PASSWORD`. Result: every logged-in dashboard user sees exactly the same two inboxes (crm@vanguardadj.online record + requests@sherwoodestimates.com action) + any bot mail tags (e.g. "Bot Review"). Personal per-user inboxes are never visible in this modal.
- Credentials: `bot@vanguardadj.com` (BOT_CRM_EMAIL / BOT_CRM_PASSWORD) for the scanner **and** the entire CRM Mail Quick View modal.
- Admin tab inside the quick view is **gated** by a secret token (login prompt in UI; unlocks full controls).
- Two inboxes with hard policies (see §2).
- Dry-run by default. **Every action function** (link, note, task, tag, mark, bot-review-mail-tag, etc.) has its own toggle.
- Strongest unique matches: claim # + CRM Job/ID (with dash normalization). Owner name title demoted in record/sending-domain contexts.
- Notes on record inbox: most-recent sanitized body only, as "Email" history category note (when the specific toggle is enabled).
- Ack / OOO / delay language: actionable review task (someone must notify customer of the delay).
- Task titles: claim + customer name (+ requester if inferable). Description = sanitized request + mail deep link.
- ML start: sentence-transformers/all-MiniLM-L6-v2 + logistic/kNN head (feature/tie-breaker only). Runs inside the CRM-droplet scanner container. (Not yet implemented — Phase 5.)
- Mail tags (e.g. "Bot Review") applied by scanner are visible in the unified quick view because everyone now sees the bot inbox.
- Research commands below (run on CRM server as bot) to discover exact mailbox signals (to/cc/account/folder), tag shapes, history "Email" category, etc.

---

## 1. Deployment

### Where it runs
- **Scanner service**: independent Docker container on the **CRM droplet** (8 GB total RAM). This is the only place heavy work (polling, classification, optional ML inference) runs.
- **Dashboard droplet** (1 GB): hosts the vanilla JS UI + admin surface. It talks to the scanner service via internal REST (or nginx internal proxy) for status, config, logs, and reprocess. It does **not** run the scanner logic or models.
- The CRM droplet hosts OnlyOffice + the scanner container. Dashboard droplet remains isolated for the UI.
- Scanner is extremely lightweight outside of the optional embedding model:
  - Sleeps 120s between polls (near-zero CPU)
  - Each cycle: small number of CRM REST calls
  - ML (sentence-transformers/all-MiniLM-L6-v2 + head): <500 MB RAM target at inference

### Memory & container reality on CRM droplet (research run 2026-07-11, live output)

From the exact commands run on the droplet (68.183.130.39):

- Total RAM: 7.8 GiB
  - Used: 4.7 GiB (64%)
  - Available: ~2.3 GiB
  - Swap: 6 GiB with 1.3 GiB used (22%)
- Root disk: 233 GiB, 57% used.

**OnlyOffice runs as exactly 5 containers** (official one-click images, no single "onlyoffice" container):

| Container                        | Image                                 | Memory (typical) | Notes |
|----------------------------------|---------------------------------------|------------------|-------|
| onlyoffice-community-server     | onlyoffice/communityserver:12.7.1.1942 | ~2.8 GiB (36%)  | Main CRM + Mail module + **nginx inside** |
| onlyoffice-document-server      | onlyoffice/documentserver:9.3.1.2     | ~0.54 GiB       | - |
| onlyoffice-control-panel        | onlyoffice/controlpanel:3.5.4.541     | ~65 MiB         | - |
| onlyoffice-elasticsearch        | onlyoffice/elasticsearch:7.16.3       | ~1.66 GiB (21%) | - |
| onlyoffice-mysql-server         | mysql:8.0.29                          | ~0.43 GiB       | - |

**Rough OnlyOffice total ≈ 5.5 GiB** → ~2.3 GiB headroom before swap pressure.

**Nginx location:**
- **No nginx on the host** (`nginx` command not found, no `/etc/nginx/sites-enabled`).
- Nginx runs **inside** onlyoffice-community-server.
- On startup the container does: `mv .../prepare-onlyoffice /etc/nginx/sites-enabled/onlyoffice`, then manages nginx.
- Host ports 80/443/5222 are published via docker-proxy directly to the community-server container.

**Docker networks (key for scanner service):**
- `onlyoffice` (bridge, 172.18.0.0/16) — the network used by all 5 OnlyOffice containers.
- `onlyoffice_default` (172.19.0.0/16)
- Community server is reachable from other containers on this network by name `onlyoffice-community-server`.

**Volumes:**
- Community data typically at `/var/www/onlyoffice/Data` inside container (source often `/app/onlyoffice/CommunityServer/data` or named volume).
- A volume named `crm-kanban_dashboard-data` was visible (historical).

**Current services:**
- No scanner, no extra mail-bot containers running.
- Only the 5 OnlyOffice ones.

**Implications for new scanner service container:**
- Place the scanner service container on the `onlyoffice` Docker network.
- It can call the CRM API at `http://onlyoffice-community-server` (port 80 inside the network) using bot credentials.
- Memory budget for scanner + sentence-transformers/all-MiniLM-L6-v2 + head: comfortably **< 600 MiB**.
- Dashboard (separate 1 GB droplet) will talk to the scanner service on the CRM droplet's public IP + a chosen port (e.g. 8787), or via internal networking if available.

This matches the two-droplet model: heavy work + OnlyOffice on the 8 GB droplet; UI + admin only on the 1 GB droplet.

### Process model
- Scanner logic lives in its own container (separate Dockerfile / compose service on CRM droplet).
- It uses bot credentials (`BOT_CRM_EMAIL` / `BOT_CRM_PASSWORD`) to call CRM APIs directly.
- Config lives in `data/mail_scanner/contractors.json` (or `scanner_config.json`) on the CRM-droplet volume. Dashboard admin surface reads/writes via the scanner service.
- Dashboard server proxies or directly forwards admin calls (`/api/scanner/config`, status, log, etc.) to the remote scanner service.
- The existing `mail_scanner.py` module is either moved into the scanner service or imported by it.

---

## 2. Inboxes and Policies (Critical — Two Distinct Mailboxes)

The scanner account sees mail from **two separate inboxes** with very different policies. All logic must branch on the target mailbox early.

### Inbox 1: crm@vanguardadj.online (Record / BCC inbox)
- **Purpose**: Passive record of correspondence.
  - Contractors BCC us when sending to carriers (using their estimates@ addresses).
  - Team BCCs carriers from contractor accounts.
- **From addresses seen here**: `estimates@baneyconstruction.online`, `baney.estimates@outlook.com`, `aplus.estimates@outlook.com`, etc.
- **Subject pattern**: Often just a bare claim code (`0825274129`, `CH 68927`, `13-99L3-10K`).
- **Policy (strict, hard-coded — not a toggle)**:
  - **Link to existing deal only** (strong match preferred).
  - **Never create tasks**.
  - **Post note only when the specific "record / email note" toggle is enabled** and match is strong. Use the **most recent sanitized body only** (strip prior forwards/replies). Use the **"Email" history event note category**.
  - No "Bot Review" **tasks**. At most a mail-level tag on completely unlinked items (if policy allows).
  - Outbound mail from contractor sending domains in this inbox is **link-only** (even with claim code + owner name in body). Never promote to tasks/notes unless explicitly allowed by the narrow note toggle on strong match.
  - Goal: keep deal history complete without polluting task lists.

### Inbox 2: requests@sherwoodestimates.com (Action inbox)
- **Purpose**: All real work items.
  - Acculynx notifications.
  - JobNimbus forwards (Liberty/Highland).
  - Forwarded carrier responses and adjuster requests that need action.
  - Supplements, reconciliations, new jobs, etc.
- **Policy**: Full classification + actions, all gated by granular per-action toggles (see §12).

**Early branch required in code**:
- Detect target mailbox early (via `to`/`cc` headers if present in conv/msg, folder/account fields, or reliable heuristic from `from` + context + sending domains).
- If crm@vanguardadj.online (or heuristic record) → short-circuit to link-only (+ optional note) path.
- If requests@sherwoodestimates.com (or action) → full rule engine under toggles.
- Log `source_inbox` (and raw signal used) on every entry for tuning.

### A. Contractor CRM Notifications (Acculynx — reply@mail.acculynx.com) — always arrives in the action inbox (requests@sherwoodestimates.com)
Contractors' employees use Acculynx to communicate. These are **notification emails** sent through the Acculynx system.

| Subject pattern | Meaning |
|---|---|
| `Job Notification: {num}: {Claimant Name}` | Message from contractor about a claim (update, request, negotiation) |
| `Job Supplement Notification: {Claimant Name} {state-claim#}` | Supplement status update. Body contains `Supplement Update Status: {Completed\|In Progress\|...}` |
| `Re: Job Supplement Notification: {name} {num}` | Reply in an existing supplement thread |

**Body format (from real sample — id=28415):**
```
Baney Construction Rockton, IL
Supplement Update Status: Completed
Note: This job is 100% complete. Updating just in case there is more Depreciation or Supplemental money to be released.
Customer contact information: Johansson, Jennifer Olson
Job: IL -24913
607 Marie Avenue, Machesney Park, IL - US, 61115
(815) 761-3373 - Primary
```

**Key identifiers to extract**: Claimant name, job ID (e.g. `IL -24913`), address, supplement status.

### B. BCC / Record Mail (crm@vanguardadj.online only)
These are **never** action items. They are passive records.

See "Inbox 1" policy above. The scanner must detect the target mailbox and treat these as link-only.

### C. Forwarded Carrier Responses (action items)
These arrive in the **action inbox** (requests@sherwoodestimates.com) when a contractor explicitly forwards a carrier response that needs work. They may also appear as BCC records in crm@vanguardadj.online when the team is just documenting.

Mailbox detection decides the policy.

| Subject pattern | Scanner action |
|---|---|
| `Fw: {claim#} - New RCV: $X - Needs Reconciliation` | Create reconciliation task + add "Needs reconciliation" tag |
| `Fw: {claim#} - Adjuster wants/requested/said...` | Create task with adjuster's request |
| `Fw: {claim#} - Adjuster confirmed/will review...` | Post note (status update, no task) |

**Key finding**: "Needs Reconciliation" emails have the **claimant name** at the start of the body intro. Example: `Andy & Mary Kruschel` appears before the `From: claims@allstate.com` block.

### D. Forwarded Adjuster/Carrier Emails (insurance carrier communications)
These are forwarded via BCC and **appear to come from contractor accounts** (`aplus.estimates@outlook.com`, `baney.estimates@outlook.com`, etc.), but the body shows the **true recipient** is the insurance carrier.

Known insurance carriers to detect:
Allstate, Statefarm/Sate Farm, Westbend, Country, Farmers Insurance, Liberty Mutual, Chubb, Rockford Mutual, Westfield, Auto Owners, Travelers, Shelter, USAA, Progressive

**Scanner action for ALL carrier/adjuster emails:**
- Post sanitized email body as note to matched deal
- Notify Ken + Claudiu (via `notifyUserList` on the note)
- Add tags: `"NEEDS REBUTTAL"` + `"PAUSE CALLING"`
- Create task only if the email contains a clear action item (request for photos, docs, etc.)

**Tag meanings:**
- `"NEEDS REBUTTAL"` — carrier responded, needs a counter/rebuttal
- `"PAUSE CALLING"` — check event history before calling the carrier/adjuster/contractor

### E. JobNimbus Tasks/Jobs (Liberty Restoration & Highland Adjusters)
**FROM**: `ken.chapman@libertyrg.com` (Ken's Liberty email, forwarded to CRM)
**ORIGIN**: `@jobnimbusmail.com` inside the forwarded message
**DO NOT** create deals in CRM. Only create tasks assigned to Ken.

| Subject pattern | Action |
|---|---|
| `New Task Assigned in JobNimbus: {Task Name}` | Create task with body description (cat=Estimate), assigned to Ken |
| `{Name} assigned you a new Job: {Project}` | Create task "Review new job: {Project} — {address}" |
| `{Name} has mentioned you on the Contact/Job "{Contact}"` | Always create task. For Liberty/Highland origins: if body contains estimate revise/new signal → Ken + Estimate cat + link task to Liberty contact; else Rebeca + Follow-Up. Contact label resolved for logs. |

**Body patterns (from real samples):**

Task email (id=28511 — Highland Adjusters):
```
Automation (Contact) assigned you a new task : Build Estimates
Build Full Estimate (+ Repair estimate if shake)for rep to bring to Adjuster Appt.
Start/Due Date: Fri, Jun 26 2026 at 1:00AM End Date: -
Related Joe Soumpholphakdy
View task
```

New job email (id=28515 — Highland Adjusters):
```
Chris Theodosis assigned you a new job: Retail Project
225 W 6th Street Hinsdale, IL
View job
```

---

## 3. Scanner Architecture

### Authentication
- Uses bot credentials from `.env`:
  ```
  SCANNER_CRM_EMAIL=bot@vanguardadj.com
  ```
- Bot sees both `requests@sherwoodestimates.com` and `crm@vanguardadj.online` inboxes
- On startup, logs into CRM API (`POST /api/2.0/authentication.json`) for a bearer token
- Refreshes token on expiry
- Bot has admin access to mail + CRM

### Polling
- Interval: 120s (configurable)
- Endpoint: `GET /api/2.0/mail/conversations.json?folder=1&page_size=50`
- Only processes conversations whose `id` has not been seen before

### Post-Deployment Safeguard (Retroactive Scan Prevention)
**Critical for production go-live:**

On the very first run after a deployment (when `data/mail_scanner/processed_ids.json` does not exist), the scanner runs a one-time **seed** that records every currently visible conversation ID as "already processed" — **without taking any actions** (no tasks, notes, deals, or tags are created).

This guarantees the scanner only acts on emails that arrive **after** the deployment. It prevents duplicating work that humans have already performed on the existing inbox.

**How the safeguard is controlled in code (mail_scanner.py):**
- The seed logic lives in `_seed_existing_conversations_as_processed()`.
- The actual call is inside `_scanner_loop()`, right before the first `_poll_inbox()`.
- **During testing and development:** The seed call is **left commented out**. This allows the scanner to process current inbox contents so new rules (e.g. `jobnimbus_mention_est`) can be validated.
- **Before the GitHub commit that enables real scanner actions in production:** Uncomment the seed call.
- At production go-live time, it is recommended to ensure `processed_ids.json` is absent (or delete it) on the production droplet so the seed captures the exact inbox state at the moment the scanner goes live.

See the detailed comments in `_scanner_loop()` and the definition of `_seed_existing_conversations_as_processed()` in `mail_scanner.py`.

This safeguard must not be forgotten when moving from testing to the production-enabling commit.

### State persistence
| File | Purpose |
|---|
| `data/mail_scanner/processed_ids.json` | Set of processed conversation IDs + `sigs` (timestamp+content dedup fingerprints) |
| `data/mail_scanner/log.jsonl` | Append-only structured log (includes `source_inbox`, `match_strength`, `no_deal*`, `task_results`, `ml_*` scores, toggle that allowed action, etc.) |
| `data/mail_scanner/contractors.json` (or `scanner_config.json`) | Contractor config + `scanner_behavior` / `action_toggles` (granular) + strong field IDs + sending domains |
| `data/mail_scanner/cached_tags.json` | Cached CRM tag list (canonical tag titles) |
| ML artifacts (in scanner container volume) | sentence-transformers cache + fitted head weights |

**Config authority**: Scanner service on CRM droplet owns the runtime config. Dashboard admin writes through the service.

---

## 4. Classifier Pipeline (ordered, first-match-wins)

### Step 1 — Extract available fields
From conversation list: `subject`, `from`, `introduction`, `id`, `date`
If needed: fetch full body via `GET /api/2.0/mail/messages/{messageId}.json`
 → provides `htmlBody`, `introduction`, `from`, `to`, `subject`, `date`

### Step 2 — Classify

```
01. JobNimbus: New Task Assigned
    Subject: r"New Task Assigned in JobNimbus:\s*(.+)"  (case-insensitive)
    TYPE: "jobnimbus_task"
    Extractor -> task_name, description, related_contact from body
    Action: Create task for Ken (cat=Estimate). NO deal.

02. JobNimbus: New Job Assigned
    Subject: r"(.+?) assigned you a new Job:\s*(.+)"  (case-insensitive)
    TYPE: "jobnimbus_new_job"
    Extractor -> job_name, address, assigner
    Action: Create task for Ken (cat=Estimate). NO deal.

03. JobNimbus: Mention
    Subject: r"(.+?) has mentioned you on the Contact \"(.+?)\""  (case-insensitive)
    TYPE: "jobnimbus_mention"
    Action: Skip (low priority).

04. Acculynx: Supplement Notification
    Subject: r"Job Supplement Notification:\s*(.+?)\s+(?:[A-Z]{2}\s*-?\s*\d+)"
    TYPE: "supplement_update"
    Extractor -> claimant = group 1, job_id from subject end
    Body: fetch and check "Supplement Update Status:"
      - "Completed" → post note to existing deal
      - Other / new work → treat as potential new deal
    Need to dedup by job_id AND address before creating.

05. Acculynx: Job Notification
    Subject: r"Job Notification:\s*(?:\d+|[A-Z]{2}\s*-\s*\d+):\s*(.+)"
    TYPE: "check_claimant"
    Extractor -> claimant = group 1, job_id from subject start
    Action: Search CRM by job_id first, then by claimant name + address.
      If existing match → post note (update on existing claim).
      If no match → create review task for Rebeca.

06. Needs Reconciliation
    Subject contains "Needs Reconciliation" (case-insensitive)
    TYPE: "reconciliation_task"
    Extractor -> claim_code from subject, claimant_name from body intro
    Action: Match to deal → create task (Ken+Claud, cat=Estimate).
      Add tag "Needs reconciliation".

07. Adjuster Action Request
    Subject contains adjuster action keywords:
      adjuster wants|requested|said|confirm|made|need|will|review|assign|sent
    TYPE: "adjuster_action"
    Extractor -> action text from subject after claim code
    Action: Match to deal → create task (Ken+Claud, cat=Estimate).
      Add tags "NEEDS REBUTTAL" + "PAUSE CALLING".

08. Carrier/Insurance Company Email
    Subject or body contains known insurance carrier name
    (Allstate|State Farm|Westbend|Country|Farmers|Liberty Mutual|Chubb|
     Rockford Mutual|Westfield|Auto Owners|Travelers|Shelter|USAA|Progressive)
    TYPE: "carrier_adjuster_email"
    Action: Match to deal → post note with notify (Ken+Claud).
      Add tags "NEEDS REBUTTAL" + "PAUSE CALLING".
      Only create task if body contains a clear request.

09. Supplement Keyword Discussion
    Subject or body contains "supplement" AND from is A-Plus/Baney address
    TYPE: "supplement_discussion"
    ACTION: Match to deal → post note. If body contains request, create task.

10. Claim Code Only (BCC Record)
    Subject matches: r"^[A-Za-z0-9\-]{5,20}$"
    Examples: "0825274129", "130B6K996", "600-1337000", "JFM1985001H"
    TYPE: "claim_code_only"
    Action: Match by claim code in custom field "Claim #" (ID=11).
      If match → post note + link email. No task.
      If no match → fetch body, re-classify.

11. Acculynx Other
    From contains "acculynx" and no rules matched.
    TYPE: "acculynx_other"
    Action: Create review task for Rebeca (cat=Follow-Up).

12. Uncertain (everything else)
    TYPE: "uncertain"
    Action: Create review task for Rebeca (cat=Follow-Up).
```

### Step 3 — CRM Dedup (three-level)

Dedup checks must handle the case where one claimant has multiple properties.

```
1. SEARCH BY JOB ID FIRST:
   GET /api/2.0/crm/opportunity/filter?filterValue={job_id}
   Job IDs are stored in custom field "CRM Job/ID" (ID=26).
   - If match found → DUPLICATE (same job). Post note + link. No new deal.

2. SEARCH BY CLAIM NUMBER:
   GET /api/2.0/crm/opportunity/filter?filterValue={claim_code}
   Claim codes stored in custom field "Claim #" (ID=11).
   - If match found → DUPLICATE claim. Post note + link. No new deal.

3. SEARCH BY CLAIMANT NAME:
   GET /api/2.0/crm/opportunity/filter?filterValue={claimant_name}
   - If NO match → NEW DEAL.
   - If match(es) found → compare ADDRESS:
     * Read custom field "Address" (ID=4) on matched deal
     * Extract address from email body
     * Same address → update existing deal (post note)
     * Different address → NEW DEAL (different property, same person)
```

### Step 4 — Body Sanitization (for posting as notes)

Email body (htmlBody) must be sanitized before posting to CRM history:

1. Strip `<script>`, `<style>`, `<iframe>`, `<object>` tags and their content
2. Strip all other HTML tags, preserving text content
3. Replace `<br>`, `<p>`, `</div>` with newlines
4. Decode HTML entities (`&amp;` → `&`, `&lt;` → `<`, etc.)
5. Collapse multiple blank lines to max 2
6. Truncate to 10,000 characters
7. Final pass: `html.escape()` the output to prevent injection in CRM history
8. Preferred source: use `introduction` field (already plain text) when available

---

## 5. Dispatch Matrix

| TYPE | Deals | Notes | Tags | Tasks | Notify |
|---|---|---|---|---|---|
| **jobnimbus_task** | — | — | — | Ken: cat=Estimate with description | Yes |
| **jobnimbus_new_job** | — | — | — | Ken: cat=Estimate "Review new job" | Yes |
| **jobnimbus_mention** | — | — | — | Rebeca (or Ken on estimate signal): cat=Follow-Up/Estimate with cleaned body + mail deep link | Yes |
| **supplement_update** (completed) | — | Post note | — | — | — |
| **supplement_update** (new work, no match) | Create stage=18, owner=Ken, fill CF#11, CF#26, CF#4 | Post sanitized body | "Missing Info" | Rebeca+Claud: cat=Follow-Up "Review new project: {name}" | Yes |
| **supplement_update** (new work, existing match) | — | Post note | — | Ken+Claud: cat=Estimate "Supplement request" | Yes |
| **reconciliation_task** | — | Post note | "Needs reconciliation" | Ken+Claud: cat=Estimate "Reconcile estimate — {claim#}" linked to deal | Yes |
| **adjuster_action** | — | Post note | "NEEDS REBUTTAL" + "PAUSE CALLING" | Ken+Claud: cat=Estimate with action text, linked to deal | Yes |
| **carrier_adjuster_email** | — | Post note + notifyUserList=[Ken,Claud] | "NEEDS REBUTTAL" + "PAUSE CALLING" | Only if body contains clear request | Via note |
| **claim_code_only** | — | Post note + link email | — | — | — |
| **check_claimant** (match found) | — | Post sanitized body | — | Only if body contains clear request | To Ken |
| **check_claimant** (no match) | — | — | — | Rebeca: cat=Follow-Up "New potential: {name}" | Yes |
| **acculynx_other** | — | — | — | Rebeca: cat=Follow-Up "Review email" | Yes |
| **uncertain** | — | — | — | Rebeca: cat=Follow-Up "Review email: {subject}" (no_deal logged) | Yes |

### Tag addition details
- Tags are added via `POST /api/2.0/crm/opportunity/{oppId}/tag` with body `{"tagName": "Exact Title"}`
- Canonical tag titles (fetched from CRM on startup):
  - `"Missing Info"` — new deals awaiting intake
  - `"Needs reconciliation"` — reconciliation needed
  - `"NEEDS REBUTTAL"` — carrier response needs rebuttal
  - `"PAUSE CALLING"` — check history before calling
- Always fetch the tag list from CRM on startup to get exact/canonical titles

---

## 6. .env Configuration

```
# Scanner auth
SCANNER_CRM_EMAIL=bot@vanguardadj.com
SCANNER_CRM_PASSWORD=FRi3tz4yWXrMTEZ

# Scanner behavior
SCANNER_POLL_INTERVAL=120
SCANNER_ENABLED=true
SCANNER_CREATE_DEALS=true
SCANNER_CREATE_TASKS=true
SCANNER_POST_NOTES=true
SCANNER_NOTIFY_USERS=true

# Stage IDs (CRM)
STAGE_NEW_SUPPLEMENT=18      
STAGE_FLAT_RATE=17           

# User GUIDs (CRM)
USER_KEN=b1fe2412-21d7-4d50-8a84-a7a47f15f2d0
USER_REBECA=7e5a2a15-026c-427a-8b74-44b52ff12f75
USER_CLAUDIU=0269dc9e-749b-4e2b-89c5-e6a1058f351a

# Custom field IDs (CRM)
FIELD_CLAIM_NUMBER=11        
FIELD_CRM_JOB_ID=26          
FIELD_ADDRESS=4              

# Task category IDs (CRM)
TASK_CAT_ESTIMATE=34         
TASK_CAT_FOLLOW_UP=35        
```

---

## 7. Contractor Config File

`data/mail_scanner/contractors.json` — extensible list of known contractors.

```json
{
  "contractors": [
    {
      "id": "baney",
      "name": "Baney Construction",
      "crm_contact_name": "Baney Construction",
      "email_domains": ["baneyconstruction.online", "baney.estimates@outlook.com"],
      "action": "create_deal_and_tasks",
      "responsible": "ken"
    },
    {
      "id": "aplus",
      "name": "A-Plus Restoration GC",
      "crm_contact_name": "A Plus Restoration GC",
      "email_domains": ["aplus.estimates@outlook.com", "aplusgcusa@gmail.com"],
      "action": "create_deal_and_tasks",
      "responsible": "ken"
    },
    {
      "id": "liberty",
      "name": "Liberty Restoration",
      "crm_contact_name": "Liberty Restoration",
      "email_domains": ["libertyrg.com"],
      "forwarded_from_domains": ["ken.chapman@libertyrg.com"],
      "action": "create_tasks_only",
      "responsible": "ken"
    },
    {
      "id": "highland",
      "name": "Highland Adjusters",
      "crm_contact_name": "Highland Adjusters",
      "email_domains": ["highlandadjusters.com", "jobnimbusmail.com"],
      "forwarded_from_domains": ["ken.chapman@libertyrg.com"],
      "action": "create_tasks_only",
      "responsible": "ken"
    }
  ],
  "insurance_carriers": [
    "Allstate", "State Farm", "Westbend", "Country", "Farmers Insurance",
    "Liberty Mutual", "Chubb", "Rockford Mutual", "Westfield",
    "Auto Owners", "Travelers", "Shelter", "USAA", "Progressive"
  ],
  "review_assignees": ["rebeca", "claudiu"],
  "new_deal_assignees": ["rebeca", "claudiu"]
}
```

### Admin API endpoints (for future dashboard settings UI)
- `GET /api/scanner/contractors` — return contractor config
- `PUT /api/scanner/contractors` — update contractor config
- Admin UI goes inside the Email quick view modal as an "Admin" tab

---

## 8. Client-side: Task Tile Category Filter

### Where
- `public/app.js`: `renderTasksTile()` (~line 1867), `renderTasksByUser()` (~line 19012)
- `public/styles.css`: new styles for tab buttons

### Design
Add a row of category pill buttons between the "User" filter dropdown and the task list:
```
[All] [Estimate] [Follow-Up] [Phone call] [Inspection]
```

- Clicking a tab sets `state.taskCategoryFilter = categoryId` and re-renders
- Active tab is highlighted
- Selection persists per tile session (reset on page reload)
- `renderTasksByUser()` filters `state.tasks` by `task.categoryId` matching the selected tab

### CSS
```
.task-cat-filter { display: flex; gap: 0.25rem; padding: 0.25rem 0.5rem; }
.task-cat-btn { ... }
.task-cat-btn.active { background: var(--accent); color: #fff; }
```

---

## 9. API Reference (for scanner implementation)

### Mail
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/2.0/mail/conversations.json?folder=1&page_size=50` | GET | List inbox conversations (fields: receivedDate/chainDate/date for timestamp gate) |
| `/api/2.0/mail/messages/{id}.json` | GET | Full message with htmlBody |
| `/api/2.0/mail/conversations/crm/link.json` | PUT | Link email to CRM entity |
| `/api/2.0/mail/conversation/{convId}.json?loadAll=false` | GET | Conversation detail (fallback for scanner-linked mail preview) |

### Opportunity
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/2.0/crm/opportunity` | POST | Create deal |
| `/api/2.0/crm/opportunity/filter?filterValue={q}` | GET | Search deals |
| `/api/2.0/crm/opportunity/{id}/tag` | POST | Add tag (body: `{"tagName":"..."}`) |

### History
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/2.0/crm/history` | POST | Create note (`entityType=opportunity`, `entityId`, `content`, `categoryId`, `notifyUserList?`) |

### Task
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/2.0/crm/task` | POST | Create task (`title`, `description`, `responsibleId`, `categoryId`, `entityType?`, `entityId?`, `isNotify?`) |
| `/api/2.0/crm/task/{id}/notify` | POST | Send push notification for task |

### Tags
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/2.0/crm/opportunity/tag` | GET | List all system tags (returns titles + IDs) |

### Authentication
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/2.0/authentication.json` | POST | Login, get bearer token |

---

## 10. Implementation Order (2026-07-11 update)

### Phase 0 — Research on CRM server (as bot)
- Run the commands in §13 to discover:
  - Exact mailbox signals (`to`, `cc`, `account`, `folder`, etc.) on conv/msg objects.
  - How mail tags (including "Bot Review") appear on conversations.
  - History category id/name for "Email".
  - Differences between the two inboxes in raw data.
- Capture samples and update this doc + code heuristics.

### Phase 1 — Core + Mailbox Awareness + Unified Bot View
- [x] Core daemon, auth (bot creds), polling, persistence, dry-run flags.
- [x] Early mailbox detection (to/from/mailboxId + sending-domain heuristics; `_detect_mailbox`); `source_inbox` logged on every processed conv in `_poll_inbox` + `_process_email`.
- [x] Record inbox link-only fast path + policy guard (is_record) in `_process_email`; `do_*` toggles respected.
- [x] Record inbox optional most-recent sanitized body as "Email" history note (cat 39) when toggle + strong match.
- [x] **CRM Mail Quick View (Inbox tab) + all mail operations use bot credentials unconditionally.** Any request from the dashboard to `/api/2.0/mail*` (conversations, messages, accounts, mark, move, link, tag, etc. — GET or mutations) is routed through `_bot_crm_proxy` using `BOT_CRM_EMAIL` / `BOT_CRM_PASSWORD`. This guarantees every logged-in dashboard user sees exactly the same two inboxes (crm@vanguardadj.online record + requests@sherwoodestimates.com action) plus any bot-applied mail tags (e.g. "Bot Review"). Personal per-user inboxes are never exposed in this modal. The same mechanism makes scanner mutations immediately visible to all users. (Server intercepts in `_handle_api_get` and `_handle_api_post_put`.)
- [x] Admin tab gated by secret token (SCANNER_ADMIN_TOKEN env). Server rejects PUT /api/scanner/config unless header or body token matches. UI shows unlock prompt when status.admin_token_required; stores for modal session and sends X-Scanner-Admin-Token. Inbox tab open to all.

### Phase 2 — Granular Toggles + Claim Hygiene + Ack/Delay Policy
- [x] Every action function has a toggle (link_email, post_notes, create_tasks, create_deals, notify_users, apply_bot_review_mail_tag, mark_read) + `action_toggles` in contractors.json + `_is_action_enabled`.
- [x] UI Behavior tab now renders all 7 granular toggles + legacy 4; round-trips via `/api/scanner/config`.
- [x] Claim/Job ID normalization (`_norm_claim`) + applied in `_dedup_opportunity`.
- [x] Owner_name_title demoted for record inbox / sending-domain contexts (in `_dedup` strength calc).
- [x] Ack/delay/OOO language: early block in _process_email; carrier/record suppress tasks (link/note on strong only); contractor forwards create "Notify customer of delay — claim — customer" review task.
- [x] Task title hygiene: `_task_title_with_claim` + `_extract_requester_hint` used on all create sites (claim — base — customer (requester?)). Ack/delay review task also uses it. Desc = most-recent sanitized request + mail deep link (already done for JN paths + review task).

### Phase 3 — Actions with Mailbox Policy + Tag Mirroring
- [x] Link-only + conditional note for record.
- [x] Full actions (under toggles) for action inbox.
- [x] Mirror bot mail module tags in quick view (chips; Bot Review highlighted). Basic apply (from quick view) is future; visibility + display is the primary goal now that everyone sees the shared bot inbox. Implemented `getMailTags`, `.mail-tags` column + `.mail-tag-chip` (special styling for Bot Review) in renderMailList + CSS.

### Phase 4 — Scanner Service on CRM Droplet
- [x] Independent container scaffold (scanner/Dockerfile + scanner/scanner_service.py + scanner/docker-compose.scanner.example.yml).
- [x] Exposes: GET /status, PUT/GET /config (behavior + all action_toggles), GET /log, POST /reprocess (stub), health.
- [x] Uses bot creds. Dashboard talks to it for admin surface (SCANNER_SERVICE_URL + _forward_scanner_request in server.py; transparent fallback to local thread).
- [x] Docker base image copies mail_scanner.py + service; runs on onlyoffice network.
- Next (later): move full scanner loop + ML into the container; dashboard remains UI + proxy only.

### Phase 5 — ML (sentence-transformers start)
- [x] Lazy import + init of sentence-transformers/all-MiniLM-L6-v2 (gated by ML_ENABLED flag; graceful fallback when deps missing).
- [x] `_ml_embed(text)` and `_ml_classify(subject, body)` stubs: embed subject+clean body; return `ml_actionable_score`, `ml_category` (actionable/record/ack/uncertain), truncated embedding for log.
- [x] Classifier head pickle support (`classifier_head.pkl`); logistic/kNN head loaded on init if present.
- [x] `ml_*` fields written to every log entry via `_process_email` (values None until head trained).
- [x] Scanner Dockerfile: `INSTALL_ML=1` build arg installs sentence-transformers + scikit-learn + numpy in separate layer.
- [ ] Bootstrap: export hundreds of log entries, label ~100-200 (class + key fields), train head, persist pickle.
- [ ] Use ML for tie-breaks / weak signals only. Deterministic rules remain primary for auditability.

### Phase 6 — Admin UI Polish + Logging
- Scanner Admin tab: secret token login prompt (unlocks all controls). Inbox tab open to everyone.
- Per-action toggle UI (grouped).
- Log entries show `source_inbox`, toggles that fired, ML scores, normalized claim, etc.
- Remote scanner status visible from dashboard.

### Phase 7 — Verification, Docs, Deploy
- Re-verify on known bad cases (39978 ack, 961/872/1136 collisions, outbound BCCs).
- Confirm record inbox produces zero tasks.
- Update all docs + CRM-droplet compose. Deploy with full VERIFY.

---

## 11. Lightweight Inference Improvement (ML Classifier)

The current regex + heuristic classifier has inference problems (wrong links on owner_name_title + claim code, "ack" mail treated as actionable, outbound BCCs creating tasks, task titles being raw subjects).

**Proposed approach (fits easily on the 8 GB CRM droplet)**

- Base embedding model: `sentence-transformers/all-MiniLM-L6-v2` (~90 MB, ~22 M params).
- Classifier head: Logistic Regression or kNN (or small MLP) on top of the 384-dim embeddings.
- Total RAM at inference: well under 500 MB.
- Latency: sub-100 ms per email on CPU.
- Training: seconds to minutes on CPU from labeled examples (we already have hundreds of log entries + human corrections).
- Use cases:
  - "Is this an actionable request or just an acknowledgment?"
  - "Is this outbound record mail vs real inbound work?"
  - "Does the body contain a real ask (photos, docs, justification) vs status update?"
  - Tie-break when regex is ambiguous or owner_name_title produces multiple strong candidates.

**Integration sketch**
- On first run (or on demand), train/fit the head from a small labeled set exported from `data/mail_scanner/log.jsonl` + human labels.
- At classification time, embed (subject + cleaned body), run the head, get probabilities or "actionable / record / ack / uncertain".
- Feed the signal into the rule engine as an additional feature (e.g., `ml_actionable_score`, `ml_category`).
- Only use for borderline cases; keep the deterministic rules as primary for auditability.

**Why not a full LLM?**
- 8 GB RAM total on the droplet; we want headroom.
- Latency and determinism matter for a background scanner.
- The suggested embedding + small classifier is extremely effective for exactly this style of "email intent" classification.

Future work item: prototype a training script + inference helper inside the scanner container, start with a small labeled set from the bad examples (the 961/872/1136 cases + ack vs request cases) plus a couple hundred recent logs. Use logistic regression / kNN head on top of all-MiniLM-L6-v2 embeddings. Correct labels over time.

## 12. Credentials, Admin Gate, and Granular Toggles (2026-07-11)

### Credentials
- Scanner and the CRM Mail Quick View (Inbox tab) use `bot@vanguardadj.com` (BOT_CRM_EMAIL / BOT_CRM_PASSWORD).
- This unifies the view: every dashboard user sees the same two inboxes the bot monitors + any mail already linked to deals/contacts.
- Personal per-user inboxes are no longer shown in the "CRM Mail Quick View" modal.
- Scanner mutations and mail tag applications (Bot Review etc.) become visible to everyone because they are applied in the shared bot inbox.

### Admin secret token gate
- Scanner Admin tab (inside the mail modal) requires a secret token.
- UI shows a small login form ("Scanner Admin Token") before rendering Behavior / Identity / Rules / Contractors / remote status.
- Token is compared server-side (env or stored value; never returned in status responses).
- On success the full admin controls are unlocked for that browser session (or modal lifetime).
- Inbox tab remains usable by any logged-in user.

### Granular action toggles (every action function)
All of these are off by default (DRY RUN). Each has an independent checkbox in Behavior:

- link_email
- post_notes (or split: record_post_note, carrier_post_note, supplement_post_note, ...)
- create_tasks (or split: reconciliation_create_task, adjuster_action_create_task, jobnimbus_*, acculynx_*, ...)
- create_deals
- notify_users
- apply_bot_review_mail_tag
- mark_read
- (any new action added later must also get a toggle)

Toggles are stored under `action_toggles` (or inside `scanner_behavior`) in the config file. Scanner service applies them at every decision point and logs which toggle allowed (or blocked) the action.

## 13. Research Results (live run on CRM droplet 2026-07-11)

### Key findings from `/api/2.0/mail/conversations.json` (bot account)

Conversations from **both inboxes** are returned mixed (as expected for the bot login). Useful fields observed:

- `to` — present on many items (e.g. "Aplus@vanguardadj.com", specific contractor estimate addresses, "Vanguard Adjusting - Team" <Aplus@vanguardadj.com>)
- `folder: 1` — common for inbox items
- No top-level `mailboxId` or `accountId` visible on individual conversation objects in the sample, but the separate mailboxes are queryable via accounts.

Example records:
- Action-like: to: Aplus@vanguardadj.com (requests@ inbox)
- Record-like: to: a contractor's own estimate address (e.g. elfernandez@acg.aaa.com) — typical BCC of outbound mail
- From contractor sending domains (estimates@baneyconstruction.online, aplus.estimates@outlook.com) often appear with bare claim subjects or "Fwd:" + reconciliation language.

### Mail accounts (the two inboxes)

From `GET /api/2.0/mail/accounts`:

- mailboxId: 20
  - email: requests@sherwoodestimates.com
  - name: "Contractor Requests"
  - isDefault: true

- mailboxId: 21
  - email: crm@vanguardadj.online
  - name: ""
  - isDefault: false

These are the two distinct mailboxes visible to the bot.

### History categories (for notes)

From `GET /api/2.0/crm/history/category`:

- 38 Note
- **39 Email**   ← use this for "most recent sanitized body" notes on record inbox (and carrier-style)
- 40 Phone call
- 42 Text
- 41 Appointment
- 47 Customer Update
- 48 Quick Context

### Mail tags

Top tags returned: -5 Lead, -6 Customer, -7 Supplier, -8 Staff.  
"Bot Review" (the custom tag the scanner applies) was not in the first page; it is created in the Mail module UI under the bot account and referenced by numeric id at runtime (see `_get_bot_review_mail_tag_id` and cached tags logic).

### Detection strategy (updated from research)

1. **Preferred**: Use `mailboxId` / account context if the API surfaces it on convs or via query params (`?mailboxId=20|21` or similar). Fall back to accounts list.
2. **Strong heuristic** (proven by samples):
   - `to` contains one of the record inbox addresses (crm@vanguardadj.online or the shared Aplus/requests team addresses in BCC context) **or**
   - `from` matches contractor sending domains (estimates@baneyconstruction.online, aplus.estimates@outlook.com, etc.) **and** the mail looks like outbound/BCC (to a carrier or the contractor's own estimate address).
3. `folder: 1` is the inbox folder for both; not distinguishing by itself.
4. Log `source_inbox` + the raw `to`/`from`/`mailboxId` (if present) on every processed item.

This data replaces the previous "unknown" signal. Implementation of `_detect_mailbox` can now be written with these concrete keys.

## 14. Research Commands (run on/against the CRM server as the bot) (historical template)

These are safe read-only inspection commands. Capture the JSON for a few records from each inbox and note the exact keys.

```bash
# 1. Auth as bot
TOKEN=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"userName":"bot@vanguardadj.com","password":"YOUR_BOT_PASS"}' \
  "https://office.publicadjustermidwest.com/api/2.0/authentication.json" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["response"]["token"])')

# 2. Recent conversations — look for to/cc/account/folder/recipients/mailbox fields
curl -s -H "Authorization: $TOKEN" \
  'https://office.publicadjustermidwest.com/api/2.0/mail/conversations.json?folder=1&page_size=5&sort=date&sortorder=descending' \
  | python3 -m json.tool | head -200

# 3. One full message (replace ID)
curl -s -H "Authorization: $TOKEN" \
  'https://office.publicadjustermidwest.com/api/2.0/mail/messages/REPLACE_WITH_ID.json' \
  | python3 -m json.tool | head -300

# 4. Mail tags (confirm "Bot Review" and structure)
curl -s -H "Authorization: $TOKEN" \
  'https://office.publicadjustermidwest.com/api/2.0/mail/tags.json' | python3 -m json.tool

# 5. Accounts + folders
curl -s -H "Authorization: $TOKEN" \
  'https://office.publicadjustermidwest.com/api/2.0/mail/accounts' | python3 -m json.tool
# then for an accountId:
curl -s -H "Authorization: $TOKEN" \
  'https://office.publicadjustermidwest.com/api/2.0/mail/folders?accountId=XXX' | python3 -m json.tool

# 6. History categories (find "Email" id)
curl -s -H "Authorization: $TOKEN" \
  'https://office.publicadjustermidwest.com/api/2.0/crm/history/category' | python3 -m json.tool

# 7. Conversation detail (tags, extra fields)
curl -s -H "Authorization: $TOKEN" \
  'https://office.publicadjustermidwest.com/api/2.0/mail/conversation/REPLACE_CONV_ID.json?loadAll=false' \
  | python3 -m json.tool | head -150
```

After running, update §2 and the detection code with the actual signals observed.

## Appendix: Real Email Samples (with inbox labels)

### Record inbox example (crm@vanguardadj.online) — link only

**Subject:** 130B6K996  
**From:** "Baney Construction" <estimates@baneyconstruction.online>  
**Action:** Link to existing deal by claim code. No task. No note (or minimal record note).

### Action inbox example (requests@sherwoodestimates.com)

### Acculynx — Supplement Notification (status update, not new work)
```
Subject: Job Supplement Notification: Jennifer Olson Johansson IL -24913
From: "CJ Jumapao" <do-not-reply@mail.acculynx.com>
Body:
  Baney Construction Rockton, IL
  Supplement Update Status: Completed
  Note: This job is 100% complete.
  Customer contact information: Johansson, Jennifer Olson
  Job: IL -24913
  607 Marie Avenue, Machesney Park, IL - US, 61115
```

### Acculynx — Job Notification 
```
Subject: Job Notification: 429: Laura Schwartz
From: "Tim Mazurkiewicz" <reply@mail.acculynx.com>
→ Update on existing Laura Schwartz deal. Job ID: 429.
```

### A-Plus — Needs Reconciliation
```
Subject: Fw: 0825274129 - New RCV: $26,182.32 - Needs Reconciliation ©
From: "A-Plus Restoration GC" <aplus.estimates@outlook.com>
Body intro:
  Andy & Mary Kruschel
  ________________________________
  From: claims@claims.allstate.com <claims@claims.allstate.com>
  → Allstate insurance carrier → automatically triggers NEEDS REBUTTAL + PAUSE CALLING
```

### A-Plus — Adjuster Request
```
Subject: Fw: 13-99L7-26K - Adjuster wants better justification photos on the siding
From: "A-Plus Restoration GC" <aplus.estimates@outlook.com>
→ Task: "Provide better justification photos on the siding"
→ Tags: NEEDS REBUTTAL, PAUSE CALLING
```

### JobNimbus — New Task
```
Subject: Fwd: New Task Assigned in JobNimbus: Build Estimates
From: "Ken Chapman" <ken.chapman@libertyrg.com>
Body:
  Automation (Contact) assigned you a new task : Build Estimates
  Build Full Estimate (+ Repair estimate if shake)for rep to bring to Adjuster Appt.
  Related Joe Soumpholphakdy
→ Task for Ken (cat=Estimate). NO deal.
```

### JobNimbus — New Job
```
Subject: Fwd: Chris Theodosis assigned you a new Job: Retail Project
From: "Ken Chapman" <ken.chapman@libertyrg.com>
Body:
  Chris Theodosis assigned you a new job: Retail Project
  225 W 6th Street Hinsdale, IL
→ Task for Ken (cat=Estimate). NO deal.
```

### BCC Record (claim code only)
```
Subject: 130B6K996
From: "Baney Construction" <estimates@baneyconstruction.online>
→ Link to existing deal by claim code. Post note. No task.
```

### Raw Name Subject (potential new claim)
```
Subject: karnatz
Subject: Karnatz solar bid needed
From: "Baney Construction" <estimates@baneyconstruction.online>
→ Fetch body. Search CRM for "karnatz". If no match → create task for Rebeca.
```

### Carrier Email (forwarded through contractor)
```
Subject: Fw: Allstate Claim 0825373012: We've Received Your Email
From: "A-Plus Restoration GC" <aplus.estimates@outlook.com>
→ Carrier detection: "Allstate" in subject → tags + note with notify
```
