# Release v1.1.0

**Tag:** `v1.1.0`  
**Date:** 2026-06-05  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

Dashboard UX release on top of v1.0: fixes the CRM notifications feed, adds notes archive/restore and server persistence, improves load time for large boards, and polishes tile toolbars and kanban cards.

---

## Fixes

### CRM notifications
- **Fixed empty notifications feed** — regression after slim/paginated loading; restored bulk CRM history + mail queries so events show again.
- **Fixed premature “no events” message** — feed waits for the initial fetch to finish before showing an empty state.
- **Fixed hidden notifications** — hidden items persist on the server with snapshots (not just a key list); **Show hidden** toolbar restores them to the feed.
- Mail/history merge dedupes history vs mail for the same opportunity event.

### Notes
- **Archived notes are not auto-deleted** — archived tiles stay in the server profile until you remove them explicitly.
- Removed broken **restore-from-archive** flow under **Add tile** (replaced by File menu on each note tile).

### Dashboard / data
- User profile save no longer stores full opportunity lists on groups (faster saves; groups refetch when expanded).
- Feed keyword filter and hidden-notification preferences sync with server profile.

---

## New features

### CRM notifications
- **90-day** notification window (was 30).
- **200-event cap** on loaded notifications (performance guardrail).
- **Loading spinner** in the feed header while data is loading (and when loading more).
- **Scroll for older notifications** until the 200-event cap is reached.
- **5-minute session cache** for the feed to reduce repeat API calls.
- **Hidden notifications** modal (eye-off toolbar icon): list hidden items with dates, **Show** to restore.

### Notes tiles
- **Server-side save** per user (`notesTiles` in `/api/user-profile`); survives browser change and server restart.
- **File** menu on each notes tile:
  - Save as `.txt` / `.md`
  - **Archive** (hides tile from board; content kept on server)
  - **Restore from archive…** — list archived tiles with **archive date**; selecting one **fills the current note** (does not re-add a tile)
  - **Duplicate**
- **Add tile** presets: **Daily** (standup template), **Claim checklist** (built from CRM checkbox user fields: Measurement Report, Insurance Documents, Inspection Photos, etc.).
- **Quarter-width** layout option for notes tiles.
- Toolbar: **Edit** / **Preview** labels; icons for copy, insert date/time, print preview, open CRM quick note; accent color; pin default preview on load.
- Footer: last-saved time and word/character count.

### Opportunity groups & kanban
- **Preview** button (monitor icon) on kanban cards → opportunity preview modal.
- **Save template** button uses a standard **save (floppy disk) icon** instead of text.
- **Red X** icon to remove a group tile (with confirm dialog).

### Calendar tiles
- **Red X** icon to remove calendar tile (with confirm).

### Dashboard performance
- **Minimized tiles skip CRM API calls** until expanded (feed, tasks, groups, calendars).
- **Parallel bootstrap** on login: portal users, user profile, stages, tags, custom field definitions.
- **Deferred custom-field enrichment** on opportunity cards (`IntersectionObserver` + queue, limited concurrency).
- Status line reports how many minimized tiles were skipped during load.

### Tile chrome (all tile types)
- **Minimize** control in the layout button group (left of width/height).
- Layout controls use **icons** (quarter / half / full width, double height, expand tile).

---

## Changed / removed

- Removed **link deal** from notes tiles.
- Renamed **Daily Standup** preset label to **Daily**.
- **Remove** on tiles is an icon-only **red X** (groups, calendar, notes).
- Archived-notes picker removed from **Add tile → Notes**.

---

## Upgrade (production)

Does **not** require DNS, nginx, or certificate changes if v1.0 is already live. See [UPDATE_AND_DEPLOY.txt](./UPDATE_AND_DEPLOY.txt) (Part B — verify each step).

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git pull --ff-only origin main
docker compose up -d --build
```

Or checkout the tag: `git checkout v1.1.0`

Full changelog: [CHANGELOG.md](../CHANGELOG.md)

---

## Rollback

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git fetch origin
git checkout v1.0.0
docker compose up -d --build
```

User dashboard data in the Docker volume is **not** removed by rollback.