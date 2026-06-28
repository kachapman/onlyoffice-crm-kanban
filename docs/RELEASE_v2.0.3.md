# Release v2.0.3

**Tag:** `v2.0.3`  
**Date:** 2026-06-27  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v2.0.3 finishes the Customer Bot search flow and fixes the mobile bot button position.

## Changes

### Added
- **Customer Bot: search by project title.** Linked customers type a project name (or part of it). The bot searches open deals by title: 0 matches → not found; 1 match → full detail; 2+ matches → numbered list, reply with a number for detail.
- **Server-side search filter.** Added `?search=` parameter to `/api/bot/deals` (filters already-fetched contact deals by title substring).
- **Customer Bot `/help` command.** Customers can send `/help`, "help", or "?" for instructions.

### Changed
- **Customer Bot modal renamed.** User-visible title and trigger button label changed from "Bot Customers" to "Customer Bot".
- **Customer Bot welcome message simplified.** After linking, customers are told to send a project name instead of receiving a full list.

### Fixed
- **Mobile: bot button actually moves below sign-out.** The previous mobile override was overridden by the desktop `.bot-customers-btn` rule due to CSS source order. Moved mobile header-button overrides to after the desktop rule so the bot button sits directly under sign-out.

### Files changed
- `telegram_bot.py`, `server.py`, `public/app.js`, `public/index.html`, `public/styles.css`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`, `docs/RELEASE_v2.0.3.md`

## Deploy steps (on production droplet)
```
git pull
docker compose build
docker compose up -d
systemctl restart crm-telegram-bot
```
Hard-refresh browser (Ctrl+Shift+R) for new static assets.

Note: the `systemctl restart crm-telegram-bot` step is required because this release changes `telegram_bot.py`.
