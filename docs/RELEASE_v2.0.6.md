# Release v2.0.6

**Tag:** `v2.0.6`  
**Date:** 2026-06-29  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v2.0.6 is a hotfix release that fixes preview-modal highlight readability, a Customer Bot modal bug that deleted multiple mappings at once, and missing delete buttons for Customer Update / Text / SMS history events.

## Changes

### Fixed
- **Preview modal: highlighted `<b>` text now readable.** CRM rich-text notes highlight text with `<b style="background-color: rgb(200, 230, 201);">`. The preview modal CSS now targets `b`/`span`/`mark` elements with inline `background-color` or `background` styles across all history body variants, using a darker `rgba(34, 197, 94, 0.65)` background with black text.
- **Customer Bot modal: delete one mapping at a time.** Delete buttons now use the mapping's unique `chatId`. The server removes via the existing `remove_mapping_by_chat()` helper, so deleting one mapping never removes others that share a `contactId` or the employee flag.
- **Preview modal: delete button for Customer Update / Text / SMS events.** The × button now appears for `customer update`, `text message`, `text`, and `sms` history categories in addition to the existing note-style categories.
- **Customer Bot: customer mode latest update hides author.** The non-employee "Latest customer update" header no longer displays the employee's name.

### Files changed
- `public/styles.css`, `public/app.js`, `server.py`, `telegram_bot.py`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`, `docs/RELEASE_v2.0.6.md`

## Deploy steps (on production droplet)

```bash
git pull
docker compose build
docker compose up -d
systemctl restart crm-telegram-bot
```

Hard-refresh browser (Ctrl+Shift+R) for new static assets.
