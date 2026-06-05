# Release v1.0.0

**Tag:** `v1.0.0`  
**Date:** 2026-06-05  
**Commit:** Production baseline before the June 5 dashboard UX release.

## Summary

First tagged release of the Vanguard CRM Kanban workspace dashboard: multi-tile board, server-backed user profiles, Docker production deploy, and core CRM workflows (opportunities, tasks, notifications).

## Highlights

- **Kanban opportunity groups** with filters, saved templates, stage/tag columns, and card actions.
- **CRM notifications** and **Tasks** tiles with keyword filter and layout (half/full, collapse).
- **Add tile** flow for opportunity groups, **calendar** (public ICS), and **notes**.
- **Per-user settings** persisted via `PUT /api/user-profile` (groups, layout, calendars, notes, feed preferences).
- **Global opportunity search** in the dashboard header.
- **New opportunity**, **quick note**, and **deal edit** modals.
- **Docker / GitHub** deploy path documented for `dashboard.vanguardadj.com`.

## Install / run

```bash
./start.sh
# http://127.0.0.1:8765
```

See [DEPLOY.md](../DEPLOY.md) for production.