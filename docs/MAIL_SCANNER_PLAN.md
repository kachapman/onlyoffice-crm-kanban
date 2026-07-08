# Mail Scanner — Planning Document

> Created 2026-07-08. Last updated 2026-07-08.
> Scanned 200+ conversations from bot@vanguardadj.com inbox (accounts: requests@sherwoodestimates.com, crm@vanguardadj.online).
> Source of truth for the auto mail scanner feature.

---

## 1. Deployment

### Where it runs
- **Dashboard droplet** (same as the existing dashboard), NOT the CRM droplet.
- The scanner is extremely lightweight:
  - Sleeps 120s between polls (near-zero CPU)
  - Each active processing cycle: ~5–10 REST API calls to the CRM, each <1s
  - Memory: ~50MB Python process
- The CRM droplet should stay **isolated** — previous issues with other apps breaking CRM access.

### Process model
- `mail_scanner.py` launched as a **background daemon thread** inside `server.py` on startup
- Runs as long as the dashboard is alive
- Config via `.env` + `data/mail_scanner/contractors.json`
- Scanner uses CRM API **directly** (bearer token auth), not through the proxy

---

## 2. What's in the CRM Inbox — Five Categories

### A. Contractor CRM Notifications (Acculynx — reply@mail.acculynx.com)
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

### B. BCC Records (crm@vanguardadj.online — PRIMARY BCC ADDRESS)
When Ken, Claudiu, Rebeca, or Derek email carriers on behalf of a contractor, they BCC `crm@vanguardadj.online`. These use the **contractor's email address** as the FROM:
- `aplus.estimates@outlook.com` — A-Plus Restoration GC
- `baney.estimates@outlook.com` / `estimates@baneyconstruction.online` — Baney Construction

**Subject**: Just a claim code (e.g. `0825274129`, `130B6K996`, `600-1337000`).
**Purpose**: Record of outbound communication → link to existing deal, no task.

### C. Forwarded Carrier Responses (through A-Plus/Baney addresses)
Contractor forwards the insurance carrier's response to us. These go to `crm@vanguardadj.online`.

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
| `{Name} has mentioned you on the Contact "{Contact}"` | Low priority — skip or post info note |

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
- On first run, marks ALL existing conversations as processed (only processes new ones going forward)

### State persistence
| File | Purpose |
|---|---|
| `data/mail_scanner/processed_ids.json` | Set of processed conversation IDs |
| `data/mail_scanner/log.jsonl` | Append-only structured log of every action |
| `data/mail_scanner/contractors.json` | Contractor config (email domains, actions, etc.) |
| `data/mail_scanner/cached_tags.json` | Cached CRM tag list (canonical tag titles) |

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
| **jobnimbus_mention** | — | Skip | — | — | — |
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
| **uncertain** | — | — | — | Rebeca: cat=Follow-Up "Review email: {subject}" | Yes |

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
| `/api/2.0/mail/conversations.json?folder=1&page_size=50` | GET | List inbox conversations |
| `/api/2.0/mail/messages/{id}.json` | GET | Full message with htmlBody |
| `/api/2.0/mail/conversations/crm/link.json` | PUT | Link email to CRM entity |

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

## 10. Implementation Order

### Phase 1 — Core scanner framework
- [ ] `mail_scanner.py`: class, auth, polling loop, persistence (processed_ids)
- [ ] Integrate into `server.py` as daemon thread
- [ ] `.env` config loading
- [ ] Contractors JSON config loader
- [ ] Tag list cache (fetch on startup)

### Phase 2 — Classifier + dedup
- [ ] All 12 classifier rules (ordered, regex-based)
- [ ] Body fetch for low-confidence cases
- [ ] Body sanitization
- [ ] Three-level dedup (job ID → claim # → name + address)

### Phase 3 — Actions
- [ ] Create deal (with custom fields: claim #, job ID, address)
- [ ] Post note (sanitized, with optional notifyUserList)
- [ ] Create task (with notification)
- [ ] Link email to deal
- [ ] Add tags (with canonical title lookup)

### Phase 4 — Client-side
- [ ] Task tile category filter (tabs)
- [ ] Admin API endpoints (GET/PUT contractors)

### Phase 5 — Admin UI (future)
- [ ] Admin tab inside Email quick view modal
- [ ] Contractor list editor
- [ ] Scanner status/log viewer

---

## Appendix: Real Email Samples

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
