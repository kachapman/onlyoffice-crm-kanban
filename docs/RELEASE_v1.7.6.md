# v1.7.6

## Feed: mail events removed
- `fetchFeedMailInitial`, mail batch in `loadMoreNotificationFeed`, `mailExhausted` from `feedCanLoadMore` all removed. Mail events (CRM. New event added to...) no longer clutter the feed.

## [Notified:] auto-inject experiment (tried and reverted)
- Attempt A: auto-inject `[Notified: Name1, ...]` into event content so keyword filter could find notification events.
- User reported text was same font and squished; scrapped. Manual `@ken` keyword filter remains the mechanism.

## FEED_MAX_EVENTS
- Settled at 150 (mail removal already reduces noise).

## UI: Preview modal fields styled as cards
- `border`, `border-radius: 8px`, `box-shadow`, `background: var(--surface-2)` on each field.
- Checkbox values ("Yes"/"No") render as `.field-value-tag` pill.
- Success probability field removed.

## UI: Tasks as cards, not rows
- `border-radius: 8px`, border, shadow, margin-bottom. Removed full-width layout toggle from tasks tile and CRM notifications tile.

## Server: gzip + Cache-Control
- Static files: `Cache-Control: public, max-age=86400`.
- Gzip for all responses (app.js 553KB→134KB).
- Proxy-side response cache (60s tag/stage/customfield, 15s filter/history).

## Fixes
- `modal-card-deal-edit .modal-form` scroll-padding-bottom so fields don't hide behind sticky action bar.
- Full-width button removal now works on already-rendered tiles (queries `[data-layout="full"]`).
