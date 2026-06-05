# Release v1.1.0

**Tag:** `v1.1.0`  
**Date:** 2026-06-05  

## Summary

Dashboard UX, notifications reliability, notes/archive workflow, and load-time improvements on top of v1.0.

## New & improved

### CRM notifications
- Feed works again after history/mail loading fix.
- **90-day** window, **200-event** cap, loading indicator, hidden-notifications manager, scroll for more (within cap).

### Notes tiles
- Saved on server per user; archives retained (no auto-delete).
- File menu: export, archive, duplicate, **restore from archive** into the current note.
- Daily / claim checklist presets; quarter-width; toolbar icons.

### Performance
- Collapsed tiles defer CRM API calls.
- Faster initial load; custom fields load for visible cards only.

### UI polish
- Red **X** to remove tiles; save icon for group templates.
- Tile minimize + layout icons; kanban **preview** on cards.

## Upgrade

Pull `main` or checkout `v1.1.0`, rebuild/restart Docker if deployed:

```bash
git pull origin main
docker compose up -d --build
```

Local:

```bash
./start.sh
```

Full list: [CHANGELOG.md](../CHANGELOG.md).