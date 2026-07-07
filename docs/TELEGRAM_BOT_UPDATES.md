# Telegram Bot Updates — @vanguardupdates_bot

## v2.1.0 (shipped 2026-07-07)

### Inline Keyboard Navigation
- Search results render as tappable buttons (numbered reply fallback preserved).
- Deal detail screen has "New Search" and "Add Note" (employee) buttons.

### Employee Note Creation
- From any deal detail, employee taps "Add Note" → types text → chooses a category from a curated inline keyboard.
- Category picker uses regex matching with priority ordering (Quick Context > Note > Text > Call > Email > Customer Update). No icons on buttons. No "Default" button.
- Notes are posted via dashboard proxy (`POST /api/bot/note`).

### Role-Aware Onboarding
- **`/start`**: Linked employees see commands; linked customers see search prompt; unlinked users see invite code prompt.
- **`/help`**: Three variants — customer, employee, unlinked.
- "your agent" → "Vanguard Adjusting" in all customer-facing text.

### Bug Fix
- `allowed_updates` used plural `"messages"` (silently ignored by Telegram). Fixed to `Update.MESSAGE` / `Update.CALLBACK_QUERY`.

---

## v2.1.1 (planned)

### `/tag` Command — List Deals by Tag
- Employee types `/tag` → bot shows all tags as inline buttons → tap a tag → shows all open deals with that tag.
- Server-side batch fetches tags for all open deals (12-thread parallel), returns deduplicated tag list.
- `GET /api/bot/tags` and `tag` query param on `GET /api/bot/deals`.

### Broadcast Message (Dashboard UI)
- New "Broadcast Message" section in the Bot Customers admin modal.
- Recipient dropdown populated from existing mappings.
- Rich text textarea (Telegram HTML: `<b>`, `<i>`, `<a>`, `<code>`, etc.).
- Calls `POST /api/bot/send-message` on the server, which proxies to Telegram Bot API `sendMessage` with `parse_mode="HTML"`.

### Usage Log (Dashboard UI)
- "Usage Log" button in Bot Customers modal.
- Tracks request counts per chat_id for `/api/bot/me`, `/api/bot/deals`, `/api/bot/note`.
- Stored in `data/bot-customers/{portal}/usage.json`.
- `GET /api/bot/usage` returns per-mapping stats with endpoint breakdown.

### Removed
- `/projects` command (replaced by `/tag`).
- Admin detection (scrapped).
- Note type button icons.
