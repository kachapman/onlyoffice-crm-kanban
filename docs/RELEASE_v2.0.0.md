# Release v2.0.0

**Tag:** `v2.0.0`  
**Date:** 2026-06-26  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

Telegram customer bot release. Customers can now check their open project statuses via `@vanguardupdates_bot` using a simple invite-code flow — no commands, no setup. Admins manage customer linking from a new modal in the dashboard. Also includes admin detection from CRM `isAdmin` field, increased bookmarked deals limit, and bot button repositioning in the header.

---

## New Features

### Telegram customer bot (`@vanguardupdates_bot`)
- New async Python bot (`telegram_bot.py`) using `python-telegram-bot` v22.8 + `httpx`.
- **Invite-code flow:** customers send their code → bot verifies via dashboard proxy → links Telegram chat to CRM contact → shows open projects.
- **Number-based drill-down:** reply with `1`, `2`, etc. to see full deal details (amount, stage, latest customer update).
- Customer-facing text uses "projects" terminology (not "deals").
- Runs as a separate process; only needs `TELEGRAM_BOT_TOKEN` + dashboard URL.

### Invite-code infrastructure (`crm_bot_store.py`)
- JSON persistence for chat-to-contact mappings and pending invite codes.
- 8-char alphanumeric codes with 48-hour expiry.
- Codes auto-expire on read; consumed codes create a pending mapping immediately updated on first contact.

### Bot Customers admin modal
- Robot SVG button in the header (next to event-log button).
- Searchable contact picker (type ≥2 chars → CRM contact filter API).
- Note category dropdown for history curation ("Customer Update" type).
- Code generation box with Copy button + expiry countdown + Cancel.
- Existing mappings list with Linked/Pending status badges and × unlink confirmation.

### Admin detection from CRM
- Checks `isAdmin` from `/api/2.0/people/@self` response.
- Falls back to `kenc@vanguardadj.com` email match if field unavailable.
- Presence modal and presence tile admin buttons use `state.currentUserIsAdmin`.

### Server endpoints (7 new)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/bot-customers` | Admin session | List mappings + pending codes |
| POST | `/api/bot-customers/generate-code` | Admin session | Create invite code |
| POST | `/api/bot-customers/cancel-code` | Admin session | Revoke pending code |
| DELETE | `/api/bot-customers/mapping` | Admin session | Unlink customer mapping |
| POST | `/api/bot-customers/verify-code` | Bot Bearer token | Consume invite code |
| GET | `/api/bot/me` | Bot Bearer token | Check chat has mapping |
| GET | `/api/bot/deals` | Bot Bearer token | Fetch open deals + history |
| GET | `/api/check-admin` | Any | Returns `{"isAdmin": bool}` |

### Other
- **Bookmarked deals limit** increased from 15 to 20.
- **`.env`** and **`config.example.env`** updated with `TELEGRAM_BOT_TOKEN`, `BOT_CRM_EMAIL`, `BOT_CRM_PASSWORD`.

---

## Changed
- **Bot button** repositioned from `right: 10.5rem` to `right: 9.5rem`, matching event-log button spacing.
- **Presence admin gating** updated from hardcoded `kenc@vanguardadj.com` email check to `state.currentUserIsAdmin`.
- **Bot CRM authentication** uses a dedicated dashboard CRM session (`bot@vanguardadj.com`), not the admin's session. Token cached 50 minutes.

---

## Upgrade (production)

Requires new environment variables. See `config.example.env`.

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git pull --ff-only origin main
# Edit .env to add: TELEGRAM_BOT_TOKEN, BOT_CRM_EMAIL, BOT_CRM_PASSWORD
docker compose up -d --build
# Start the bot separately (systemd or separate container):
# cd /opt/vanguard/onlyoffice-crm-kanban
# /tmp/botenv/bin/python3 telegram_bot.py &
```

VERIFY steps:
- `cat VERSION` → 1.2.0
- Login to dashboard → see robot button in header (admin only) → open Bot Customers modal.
- Generate a code → send to `@vanguardupdates_bot` on Telegram → confirm linking → see projects.
- Test bookmark limit (now 20).
- Hard-refresh browser after deploy for static assets.

Full changelog: [CHANGELOG.md](../CHANGELOG.md)

---

## Rollback

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git fetch origin
git checkout v1.1.0
docker compose up -d --build
```

Bot will stop (no separate process for it in v1.1.0). Customer mappings in `crm_bot_store.py` are in a Docker volume and preserved.

---

## GitHub Release publishing

Use the body from this file. See [docs/GITHUB_RELEASES.md](./GITHUB_RELEASES.md) for the one-time publish steps or `gh release create` example.
