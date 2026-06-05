# Changelog

All notable changes to the CRM Kanban dashboard are documented here.

## [1.1.0] — 2026-06-05

### CRM notifications
- Fixed empty notifications feed after pagination refactor; restored reliable history + mail loading.
- Feed window extended to **90 days**; display capped at **200** most recent events.
- Discreet loading spinner in the feed header while fetching.
- Hidden notifications stored on the server with snapshots; toolbar button to review and restore.
- Scroll-to-load-more for older items (until the 200-event cap).

### Notes tiles
- Server-side persistence per user (`notesTiles` in user profile); archived tiles are not auto-deleted.
- **File** menu: save as `.txt` / `.md`, archive, duplicate, **restore from archive** (pick archived tile by date; fills current note).
- Presets including **Daily** and **Claim checklist** (from CRM checkbox user fields).
- Quarter-width layout; Edit / Preview labels; icon actions for copy, date, print, CRM quick note.
- Removed archived-notes list from **Add tile** (restore lives on each note tile).

### Dashboard performance
- Minimized tiles skip CRM fetches until expanded.
- Parallel bootstrap (profile, stages, tags, definitions).
- Opportunity custom fields enriched on visible cards via `IntersectionObserver` (queued, limited concurrency).

### UI
- **Red X** icon to remove group, calendar, and notes tiles.
- **Save template** uses standard save (floppy) icon on group tiles.
- Minimize control in tile layout group (all tile types).
- Kanban card **preview** button (monitor icon) opens opportunity preview modal.

---

## [1.0.0] — 2026-06-05

First production-ready release on GitHub.

### Core dashboard
- OnlyOffice CRM kanban with opportunity groups (stage/tag filters, templates, red-deal filter).
- Pinned **CRM notifications** and **Tasks** panels with layout controls.
- Global opportunity search in the header.
- Create opportunity and quick-note modals; deal edit from cards.

### Tiles
- **Add tile**: opportunity groups, calendar (ICS feed), notes.
- Per-user dashboard profile on server (`/api/user-profile`): groups, layout, calendars, notes, feed keyword, hidden feed keys.
- Calendar monthly view with timezone selector and event detail modal.

### Deploy & ops
- Docker Compose deploy to DigitalOcean (`dashboard.vanguardadj.com`).
- GitHub Actions deploy workflow; production server notes and estimate-nginx network in compose.
- Documentation: `DEPLOY.md`, `docs/UPDATE_AND_DEPLOY.txt`, `docs/PRODUCTION_SERVER_NOTES.txt`.