# Release v1.2.0

**Tag:** `v1.2.0`  
**Date:** 2026-06-06  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

Post-v1.1.0 testing follow-up. Addresses the full list of fixes and small features identified during live testing after the 1.1 deploy: reliable tile collapse/minimize (including half-width CRM groups while collapsed), calendar double-height scaling, immediate group delete persistence, task descriptions, comma-separated keyword filter now uses inclusive AND semantics, persistent preview on edit, white favicon, friendly linked-email error, full tasks list modal with open/completed toggle + check/uncheck + new task, template management reduced to delete-only modal, crash/5xx banner with exact requested wording and 30s guidance, tasks-list icon (minimal file cabinet), readability styling for the tasks popup, plus supporting docs (AGENTS.md) and cleanup.

---

## Fixes

### Layout, collapse & tiles
- Notes and calendar tiles: collapse button now reliably hides body content (toolbar stays visible). Added specific CSS rules to override tile min-height constraints when `.tile-body-collapsed`.
- Calendar double-height: content now scales properly (month grid uses flex + body constraints + day min-heights instead of leaving empty space).
- CRM group tiles: minimize/collapse now preserve the chosen half or quarter width (the collapsed bar stays narrow instead of snapping to full width). Width classes (`tile-half`/`tile-quarter`) are computed and applied before any collapsed early-return.
- Group removal: delete now triggers an immediate `saveUserProfileToServer({quiet:true})` so the change is not lost on quick reload.
- Tasks (compact rows): description text is rendered (`.task-desc`, truncated) in addition to title.

### CRM notifications
- Keyword filter: comma-separated values are now matched with **AND** (inclusive) semantics. The input is split, trimmed, and every token must appear in the notification blob (`tokens.every(token => blob.includes(token))`). Single keywords continue to work. Placeholder updated.
- Graceful handling for "Linked email ... wasn't found" (and similar message-not-found cases) in the opportunity preview modal.

### Preview & assets
- Preview modal is now persistent: opening the edit form from the preview does not close it; after a successful edit the preview data refreshes in place.
- Favicon and related meta / logo images switched to the white ship variant for visibility on both light and dark surfaces.

### Tasks list popup (readability)
- Light theme backgrounds and text for the full tasks list (`#tasks-list-modal`): body uses white with subtle inset shadow/border, rows use light gray with hover, done rows are dimmed + strikethrough, meta text muted, headers contrasted. Checkboxes use blue accent. Makes long lists easy to scan.

### CRM backend errors
- Crash / 5xx notification banner for OnlyOffice CRM proxy failures.
  - Triggered from the central `api()` wrapper on `!res.ok && status >= 500` (or JSON parse failure) when the path includes `/crm/`.
  - Exact wording requested: "OnlyOffice CRM backend error (e.g. 502 on history). Dashboard may be out of date. Refresh page now — recommended in ~30 seconds."
  - "Refresh page now" button performs `location.reload()`.
  - Sticky, role="alert", throttled (~15 s), auto-removed on any successful CRM-path response.
  - Testable locally by blocking or throttling `/api/proxy/api/2.0/crm/*` requests in DevTools Network panel.

---

## New features

### Tasks list modal (full view)
- New discreet button (minimalistic light file-cabinet SVG icon, after emoji iterations) injected into the tasks panel header (flex row, to the left of the user selector). `id="tasks-list-btn"`.
- Opens `#tasks-list-modal`:
  - Fetches both open tasks (`/api/2.0/crm/task/filter?isClosed=false`) and completed (`isClosed=true`), merges, and renders.
  - "Show completed" toggle re-renders the visible set (open always shown; completed optional).
  - Per-row checkbox: checking closes the task (POST /close, optimistic removal or move to done list, re-render). Unchecking a done row reopens it.
  - Title is a deep link (reuses `crmTaskUrl`).
  - Shows due date + responsible person.
  - Footer "New Task" button opens the existing create-task modal.
- Reuses existing task row/checkbox patterns, `api()` wrapper, profile save scheduling, and optimistic UI style from the compact tasks tile.

### Group templates — delete-only management
- The previous "Manage templates" flow (edit names + delete via prompts) has been replaced with a focused delete-only popup.
- Button on group toolbar now opens `#template-delete-modal`.
- The modal lists every saved template across all groups.
- Each entry has an × control; clicking it confirms, removes the template from the matching group's `templates` array, calls `saveUserProfileToServer`, then refreshes every group template `<select>` and the list inside the modal.
- No rename or edit paths remain (per explicit request: "We dont need to edit them").

### Icon for tasks list
- Final icon chosen after feedback: a simple, light, minimalistic file-cabinet (two horizontal lines) drawn with SVG `stroke="currentColor"` so it inherits theme color. Replaces earlier emoji trials.

---

## Changed / removed
- Template UI: "edit" capability removed; only deletion via the dedicated list + × modal remains.
- Keyword filter semantics: OR → AND (all provided keywords must match).
- Several tile CSS rules and JS layout application order were adjusted so that collapse, minimize, and width choices compose correctly for all tile types.
- FUTURE_FEATURES.md: the parked FEAT-009 crash-notification entry was removed (feature already shipped and documented here + in conversation for test steps).

---

## Upgrade (production)
Does **not** require DNS, nginx, or certificate changes if v1.1.0 is already live. See [UPDATE_AND_DEPLOY.txt](./UPDATE_AND_DEPLOY.txt) (Part B — verify each step).

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git pull --ff-only origin main
# or: git checkout v1.2.0
docker compose up -d --build
```

VERIFY steps (high level):
- `cat VERSION` → 1.2.0
- `git status` clean
- Browser hard-refresh (Ctrl+Shift+R) at https://dashboard.vanguardadj.com after deploy (static JS/CSS are aggressively cached).
- Test: collapse notes/calendar/groups (half width while collapsed), comma keywords (AND), open the tasks list via cabinet icon, toggle completed, check/uncheck tasks, delete a template via the new modal, trigger a 5xx on a /crm/ call to see the banner.

Full changelog: [CHANGELOG.md](../CHANGELOG.md)

---

## Rollback

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git fetch origin
git checkout v1.1.0
docker compose up -d --build
```

User dashboard data in the Docker volume is **not** removed by rollback.

---

## GitHub Release publishing

Use the body from this file (or the corresponding section in CHANGELOG.md). See [docs/GITHUB_RELEASES.md](./GITHUB_RELEASES.md) for the one-time publish steps or `gh release create` example.
