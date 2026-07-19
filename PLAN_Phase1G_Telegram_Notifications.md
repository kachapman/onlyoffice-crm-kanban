# Phase 1G: Telegram Notification Dispatch + Inline Replies

**Status:** Approved  
**Estimated effort:** 3-4 days  
**Depends on:** Phase 1A-1E (PostgreSQL migration, v2 API)

---

## Overview

Enhance the existing Telegram bot to:
1. **Dispatch notifications** to employees when they're tagged in notes or assigned tasks
2. **Support inline replies** — employee replies to a Telegram notification post a threaded note on the project
3. **Quick investigation** — already partially working (search, project info, add note)

**Architecture:** Single bot per deployment. Each company deploys Sietch CRM on their own server and creates their own Telegram bot via BotFather. The bot token is configured in `.env` — no multi-tenancy on a single server.

## Current State

### What Exists
- **One bot** (`@vanguardupdates_bot`) serving both customers and employees
- **`notifications` table** in PostgreSQL with proper schema (user_id, type, opportunity_id, message, payload)
- **`create_tag_notifications` trigger** fires on history_events INSERT for Note/Comment categories
- **`crm_bot_store`** distinguishes employees vs customers via `employee` boolean flag
- **Bot-to-server endpoints** (`/api/bot/*`) for searching deals, adding notes, getting categories

### What's Missing
1. **No Telegram notification dispatch** — notifications only exist in the database
2. **No task assignment notifications** — `notifyCrmTaskResponsible` is a no-op
3. **No inline reply support** — bot can't handle replies to notification messages
4. **Bot-authored notes bypass notifications** — `/api/bot/note` inserts `created_by = NULL`

---

## Architecture

### Data Flow

```
CRM Event (tag in note, task assigned)
    ↓
PostgreSQL Trigger / Server Code
    ↓
INSERT INTO notifications (user_id, type, opportunity_id, ...)
    ↓
Notification Dispatcher (background worker)
    ↓
Look up employee Telegram chat_id from crm_bot_store
    ↓
Send formatted Telegram message via Bot API
    ↓
Store telegram_message_id in notification payload
    ↓
Employee replies in Telegram thread
    ↓
Bot detects reply-to-notification
    ↓
Extract project context from parent message
    ↓
POST /api/bot/note with threaded content
    ↓
Confirm in Telegram thread
```

### Database Changes

#### 1. New table: `telegram_notification_log`

```sql
CREATE TABLE telegram_notification_log (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    sent_by TEXT DEFAULT 'bot'
);

CREATE INDEX idx_telegram_notification_log_notification ON telegram_notification_log(notification_id);
CREATE INDEX idx_telegram_notification_log_chat ON telegram_notification_log(chat_id, sent_at DESC);
```

**Purpose:** Tracks which Telegram messages correspond to which notifications. Enables:
- Reply detection (reply_to_message → notification → project)
- Deduplication (don't send same notification twice)
- Audit trail

#### 2. Extend `notifications` table (optional)

Add column to track Telegram delivery status:

```sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS telegram_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS telegram_sent_at TIMESTAMP;
```

### Server-Side Changes

#### 1. Notification Dispatcher (`notification_dispatcher.py` — new file)

Background worker that:
- Polls `notifications` table for unsent Telegram notifications
- Looks up employee chat_id from `crm_bot_store`
- Sends formatted message via Telegram Bot API
- Logs message_id in `telegram_notification_log`

**Implementation approach:**
- Use `threading.Timer` or `asyncio` background task (similar to presence heartbeat)
- Poll every 5-10 seconds for new notifications
- Batch sends to avoid rate limits (max 30 messages/second per bot)

**Message format:**
```
📋 Note tagged you
Project: [Project Title]
By: [Actor Name]
Category: [Category]

[Truncated note content...]

Reply to this message to add a note →
```

#### 2. Implement `/api/bot/send-message` (server.py)

Replace the 501 stub with actual implementation:
- Accept `chatId`, `text`, `parseMode`, `replyToMessageId` (optional)
- Call Telegram Bot API `sendMessage`
- Return message_id for tracking

#### 3. Add task notification trigger (init.sql)

New trigger for task assignment notifications:

```sql
CREATE OR REPLACE FUNCTION create_task_notifications()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.responsible_user_id IS NOT NULL 
       AND NEW.responsible_user_id != NEW.created_by THEN
        INSERT INTO notifications (user_id, type, opportunity_id, actor_user_id, message, payload)
        VALUES (
            NEW.responsible_user_id,
            'task_assigned',
            NEW.opportunity_id,
            NEW.created_by,
            (SELECT u.display_name || ' assigned you a task: ' || NEW.title
             FROM users u WHERE u.id = NEW.created_by),
            jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title, 'due_date', NEW.due_date)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_task_notifications
    AFTER INSERT ON tasks
    FOR EACH ROW EXECUTE FUNCTION create_task_notifications();
```

#### 4. Fix `/api/bot/note` to populate `history_notify_users`

Currently bot-created notes have `created_by = NULL` and don't notify anyone. Fix:
- Accept optional `notifyUserList` in request body
- Or: auto-notify the employee who created the note (if they want confirmation)

### Bot Changes (telegram_bot.py)

#### 1. Reply Handler

Add handler for `MessageHandler(filters.REPLY)`:

```python
async def handle_reply(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle replies to notification messages."""
    if not update.message or not update.message.reply_to_message:
        return
    
    reply_to = update.message.reply_to_message
    message_id = reply_to.message_id
    chat_id = update.effective_chat.id
    
    # Look up notification from telegram_notification_log
    log = db.query_one(
        "SELECT notification_id FROM telegram_notification_log WHERE chat_id = %s AND message_id = %s",
        (chat_id, message_id)
    )
    if not log:
        return  # Not a reply to a notification
    
    # Get notification details
    notification = db.query_one(
        "SELECT opportunity_id, payload FROM notifications WHERE id = %s",
        (log["notification_id"],)
    )
    if not notification:
        return
    
    opp_id = notification["opportunity_id"]
    content = update.message.text
    
    # Post note to project
    resp = httpx.post(
        f"{DASHBOARD_URL}/api/bot/note",
        headers={"Authorization": f"Bearer {TELEGRAM_BOT_TOKEN}"},
        json={
            "opportunityId": opp_id,
            "content": content,
            "categoryId": 1,  # Note category
            "createdBy": mapping["contactId"] if mapping else None
        }
    )
    
    if resp.status_code == 200:
        await update.message.reply_text(
            f"✅ Note added to project",
            reply_to_message_id=message_id
        )
```

#### 2. Notification Message Formatting

Create formatted notification messages with project context:

```python
def format_notification_message(notification, project_title, actor_name):
    """Format notification for Telegram."""
    type_ = notification["type"]
    payload = notification["payload"] or {}
    
    if type_ == "note_tagged":
        return (
            f"📋 <b>Note tagged you</b>\n\n"
            f"Project: <b>{escape_html(project_title)}</b>\n"
            f"By: {escape_html(actor_name)}\n\n"
            f"{_truncate_html(notification['message'] or '', 500)}\n\n"
            f"↩️ Reply to add a note"
        )
    elif type_ == "task_assigned":
        return (
            f"✅ <b>Task assigned to you</b>\n\n"
            f"Project: <b>{escape_html(project_title)}</b>\n"
            f"Task: {escape_html(payload.get('task_title', ''))}\n"
            f"Due: {payload.get('due_date', 'No due date')}\n\n"
            f"↩️ Reply to add a note"
        )
```

#### 3. Register New Handler

```python
# In main():
app.add_handler(MessageHandler(filters.REPLY & ~filters.COMMAND, handle_reply))
```

### Frontend Changes

#### 1. Notification Preferences UI

Add toggle switches for:
- "Send Telegram notifications when tagged in notes"
- "Send Telegram notifications for task assignments"

Store in `notification_preferences` table (already defined but unused).

#### 2. Telegram Notification Status

Show in notification feed items:
- "Sent to Telegram" indicator
- "Replied from Telegram" indicator (if note was created via bot reply)

---

## Implementation Phases

### Phase A: Notification Dispatcher (1-2 days)

1. **Create `notification_dispatcher.py`**
   - Background polling worker
   - Look up employee chat_ids
   - Send Telegram messages via Bot API
   - Log in `telegram_notification_log`

2. **Add database tables**
   - `telegram_notification_log`
   - Optional: extend `notifications` with `telegram_sent` columns

3. **Implement `/api/bot/send-message`**
   - Replace 501 stub with actual Telegram API call

4. **Test**
   - Manually insert notification → verify Telegram message sent
   - Verify employee vs customer routing
   - Verify message formatting

### Phase B: Task Notifications (0.5 day)

1. **Add `create_task_notifications` trigger**
   - Fire on INSERT to tasks
   - Notify responsible_user_id (if different from created_by)

2. **Wire up in frontend**
   - Implement `notifyCrmTaskResponsible` (currently no-op)
   - Or: rely on server-side trigger (simpler)

3. **Test**
   - Create task assigned to another user → verify notification

### Phase C: Inline Replies (1-1.5 days)

1. **Add reply handler in telegram_bot.py**
   - Detect replies to notification messages
   - Extract project context
   - Post note via `/api/bot/note`

2. **Update `/api/bot/note`**
   - Accept `createdBy` parameter (employee ID)
   - Populate `history_notify_users` for bot-created notes

3. **Test**
   - Receive notification → reply → verify note appears in project history
   - Verify threaded display in Telegram

---

## Message Format Examples

### Note Tagged Notification

```
📋 Note tagged you

Project: Smith v. State Farm - Roof Damage Claim
By: John Smith

Hey @mike, can you review the estimate on this one? The contractor
quoted $15,000 but I think we should push back...

↩️ Reply to add a note
```

### Task Assigned Notification

```
✅ Task assigned to you

Project: Johnson v. Allstate - Water Damage
Task: Review contractor estimate
Due: 2026-07-25

↩️ Reply to add a note
```

### Reply Confirmation

```
✅ Note added to project

Project: Smith v. State Farm - Roof Damage Claim
Category: Note
```

---

## API Endpoints

### New Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/bot/send-message` | POST | Bot token | Send Telegram message |
| `/api/bot/notifications/pending` | GET | Bot token | Get unsent notifications |
| `/api/bot/notifications/sent` | POST | Bot token | Mark notification as sent |

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `/api/bot/note` | Accept `createdBy` parameter, populate `history_notify_users` |

---

## Configuration

### Environment Variables

```bash
# Existing
TELEGRAM_BOT_TOKEN=...

# New
TELEGRAM_NOTIFY_ENABLED=true
TELEGRAM_NOTIFY_POLL_INTERVAL=5  # seconds
TELEGRAM_NOTIFY_BATCH_SIZE=10
```

### Notification Preferences

Store in `notification_preferences` table:

| Type | Default | Description |
|------|---------|-------------|
| `telegram_note_tagged` | true | Send when tagged in note |
| `telegram_task_assigned` | true | Send when task assigned |
| `telegram_task_due_soon` | false | Send 24h before task due date |

---

## Files to Create/Modify

### New Files
- `notification_dispatcher.py` — Background notification sender
- `docs/TELEGRAM_NOTIFICATIONS.md` — Setup guide

### Modified Files
- `init.sql` — Add `telegram_notification_log` table, task notification trigger
- `server.py` — Implement `/api/bot/send-message`, update `/api/bot/note`
- `telegram_bot.py` — Add reply handler, notification formatting
- `public/app.js` — Notification preferences UI
- `public/index.html` — Notification preferences modal section
- `config.example.env` — Add notification config vars

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Telegram rate limits (30 msg/sec) | Notifications delayed | Batch sends, queue with backoff |
| Bot token compromised | Spam notifications | Store in .env, rotate if exposed |
| Employee not linked to bot | No notification sent | Prompt admin to link via `/start` |
| Reply to old notification | Note posted to stale project | Check notification age (< 7 days) |
| Database trigger race condition | Duplicate notifications | Use `ON CONFLICT DO NOTHING` |

---

## Testing Checklist

- [ ] Tag user in note → Telegram notification sent
- [ ] Assign task to user → Telegram notification sent
- [ ] Reply to notification → Note posted to project
- [ ] Reply appears in project history
- [ ] Employee vs customer routing correct
- [ ] Message formatting clean (HTML parse mode)
- [ ] Rate limiting works (no 429 errors)
- [ ] Notification preferences respected
- [ ] Bot start shows employee commands
- [ ] Cancel pending note flow works

---

## Next Steps

1. Get user approval on this plan
2. Implement Phase A (Notification Dispatcher)
3. Test with manual notification insertion
4. Implement Phase B (Task Notifications)
5. Implement Phase C (Inline Replies)
6. Full integration test
7. Update AGENTS.md and CHANGELOG.md
