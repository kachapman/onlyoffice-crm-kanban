# Release v2.0.5

**Tag:** `v2.0.5`  
**Date:** 2026-06-29  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v2.0.5 improves the Telegram Customer Bot's employee mode by fetching full email bodies from the CRM's legacy mail handler, displaying event authors, and fixing HTML/rendering issues that broke rich-text messages.

## Changes

### Added
- **Customer Bot (employee mode): full email body fetch.** The dashboard proxy calls `/Products/CRM/HttpHandlers/filehandler.ashx?action=mailmessage&message_id={id}` to retrieve the complete email body and injects it into employee history events, replacing CRM's truncated mail summary.
- **Customer Bot (employee mode): event author display.** Non-mail history events show the creator's display name next to the date, e.g. `[Note] — Jun 28, 2026 (Ken Chapman)`. Author is hidden for `Customer Update` events so customers do not see employee names.
- **Customer Bot: HTML-safe message truncation.** When a deal detail exceeds Telegram's length limit, the bot now closes open HTML tags and strips partial tags before truncating, keeping the message valid HTML.
- **Customer Bot: plain-text fallback strips tags.** If Telegram rejects the HTML message, the fallback sends tag-stripped plain text instead of literal `<b>`/`<i>` tags.

### Changed
- **Customer Bot (employee mode): mail body cap and truncation marker.** Long email bodies are capped at 1200 characters and end with `[truncated]`.
- **Customer Bot: distinct footer.** The closing prompt now has a separator line and is italicized so it doesn't blend into email/note content.
- **Customer Bot (employee mode): tighter email formatting.** Raw CRM email HTML is converted to plain text with normalized whitespace, so forwarded emails no longer have leading spaces or words broken across lines.

### Fixed
- **Customer Bot (employee mode): email address HTML parse errors.** Forward/reply attribution lines like `Grasshopper <notifications@grasshopper.com>` are now HTML-escaped so Telegram doesn't treat the email address as an unsupported tag.
- **Customer Bot (employee mode): forwarded header parsing.** The bot correctly extracts `From`/`Date` from forwarded email headers and no longer swallows the first paragraph of the body.

### API notes / gotchas
- CRM history events only store a truncated mail JSON; the full body must be fetched via the legacy `filehandler.ashx` endpoint.
- `/api/2.0/mail/messages/{id}` returned empty body fields for the bot; the native CRM MailViewer uses `filehandler.ashx` for the body.
- The `message_id` used by the filehandler is the history event's `messageId`/`mailMessageId`, not the `id` shown in `MailViewer.aspx?id=...`.
- The bot's CRM account must be an OnlyOffice admin with mail module access for the filehandler to return email bodies.
- See `ISSUES.md` ISSUE-010 for full details.

### Files changed
- `server.py`, `telegram_bot.py`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`, `ISSUES.md`, `docs/RELEASE_v2.0.5.md`

## Deploy steps (on production droplet)

```bash
git pull
docker compose build
docker compose up -d
systemctl restart crm-telegram-bot
```

Hard-refresh browser (Ctrl+Shift+R) for new static assets.

Note: the `docker compose build/up -d` step is required because this release changes `server.py`.
