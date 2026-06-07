# Release v1.3.0

**Tag:** `v1.3.0`  
**Date:** 2026-06-07  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.3.0 delivers the complete Team / Presence feature (status, DMs with replies/reads/emojis/colors, inbox, admin tools for kenc, live indicators) plus substantial UI polish on the modal (instant open, taller messaging areas, resizable window, admin hidden-by-default + tab-scoped). All items from live user testing after the 1.2 deploy were addressed (or explicitly paused). Requires server restart after pull for the new Python presence routes/handlers.

One reply-context rendering bug in chat history is paused per request; core reply functionality (setup, send, embedded text, preview) is present.

---

## New features (Presence / Team)

- Header "Team" button (users SVG, btn-secondary, left of New Tile) with live badge (online count) + self-online green dot + red waiting-messages flash.
- Instant open + roster from CRM people list: green online dots, amber idle (>2h), dark offline + "last seen X", status next to names.
- Status picker: "Status:" label + dark <select> with "Online" default + 3 templates + Custom (emojis OK, 120 char).
- DMs: click any user (online/offline) → thread. Send works to offline (delivered on login). History preserved.
- Inbox on "Messages" tab: recent conversations (snippets, timestamps), click to thread, × clear/archive per convo. Thread also has Clear.
- Replies: click any prior message → reply with quoted context in smaller font ("Replying to: ...") shown in bubble (like Signal/WhatsApp). Works in both directions.
- Emojis: dedicated picker button in input; inserts at cursor. Full Unicode support in messages.
- Read receipts: "read" appears on your sent messages once recipient opens the thread.
- Color coding: received messages always green bubble; your sent messages use current accent color.
- Admin (kenc@vanguardadj.com only): last activity minutes from CRM + dashboard. "Admin" button in actions (says "Admin" when hidden); toggle only appears on Team tab (not Messages); hidden by default.
- Live header indicators update without opening modal (30s poll + early start after login + optimistic self-online + post-heartbeat snapshot).
- Popup polish: messaging areas (list + DM) now allow 480px (much more history visible), DM log has explicit min-height + larger font. Whole window resizable (drag bottom-right corner; min/max + scoped only to this modal).

Backend: new presence_store.py (per-user JSON + per-convo message files), server.py special routes before proxy fallback (users, snapshot, status, dm, heartbeat, clear, mark-read), _require_auth + direct CRM @self/people mediation.

Client: presenceFetch helper (sends X-OnlyOffice-Portal), renderDMLog / renderPresenceInbox / rich message bubbles, openPresenceDMThread, tabs, early bind + ensurePresenceOnLogin, etc.

Reliability: direct presence calls (no more proxy 404s) + hardened routing. (Server process restart required after code pull.)

---

## Fixes & Polish (from live feedback)

- Presence button no longer "does nothing for 5-10s" or errors on every action ("Could not load messages", "unable to send", "could not set status", 404s).
- Status dropdown instead of buttons; "Online" default + "Status:" label + dark styling.
- Sections + last-seen for offline; online above divider.
- Full message tracking (inbox + per-thread + delete/archive) + indicators (self-online dot separate from count + separate red flash for waiting DMs).
- Admin hidden by default + button only on Team tab.
- Taller + resizable modal so "much more messages could be seen at once".
- (Reply context display in sent history bubbles paused per request; everything else for replies is functional.)

See CHANGELOG.md for the complete enumerated list.

---

## Documentation & Housekeeping

- Version bumped to 1.3.0 everywhere (VERSION, AGENTS.md, README, CHANGELOG, new RELEASE_v1.3.md, GITHUB_RELEASES.md).
- Full presence/team live feedback + all polish items documented.
- Reply context rendering bug in history explicitly called out as paused.
- AGENTS.md and docs updated.

---

## Upgrade (production)

**Requires server process restart** (new Python routes/handlers in server.py + presence_store.py).

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git pull --ff-only origin main
# or: git checkout v1.3.0
docker compose up -d --build
# then restart the container / python process if not fully covered by compose
```

VERIFY (high level):
- `cat VERSION` → 1.3.0
- Browser hard-refresh at https://dashboard.vanguardadj.com
- Test: open Team popup instantly, see live indicators on icon, switch tabs, set status (dropdown), click user → thread (with context on replies), send with emoji, see green received / accent sent + "read", use Messages tab inbox + clears, admin toggle only on Team tab and hidden by default, resize the modal taller.

Full changelog: [CHANGELOG.md](../CHANGELOG.md)

See [UPDATE_AND_DEPLOY.txt](./UPDATE_AND_DEPLOY.txt) for the exact safe checklist.

---

## Rollback

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git checkout v1.2.0
docker compose up -d --build
```

Then verify VERSION and test the Team features you care about.
