# Release v2.0.9 — 2026-07-05

**Tag:** `v2.0.9`

## Summary
Hotfix for backdate UI + Quick Context visual polish. Native date picker was implemented in JS/CSS but the visible `<input type="date">` elements were not present in the committed HTML, causing the feature to appear broken on fresh loads despite working in a cached session. Quick Context items received the Tabler thumbtack icon and faint blue hue.

## Changes

### Fixed
- **Backdate date picker restored.** Bare native `<input type="date" id="deal-edit-note-created" class="note-backdate-input">` and same for quick-note, inserted directly after the note-editor div before attachments. No wrapper, icon, or discreet label. Width rules (max-width 138px, padding) ensure full `mm/dd/yyyy` is visible.
- **Submission path already correct.** `app.js` reads the value and passes `created` to `createOpportunityHistoryEvent`; the history POST includes the chosen date.
- **Quick Context styling.** HISTORY_ICON_PIN now uses exact Tabler pin SVG (flat head). `.opp-preview-history-item--quick-context` gets blue left border + background tint modeled on existing High Priority amber treatment.

### Files changed
- `public/index.html` (two inputs), `public/styles.css` (backdate width + quick-context hue), `public/app.js` (icon + quick-context detection, already present), `CHANGELOG.md`, `VERSION`, `AGENTS.md`, `docs/RELEASE_v2.0.9.md`.

## Deploy
```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git pull
docker compose build --no-cache
docker compose up -d
```
Hard refresh browser.

## Verification
- Open deal-edit note and quick-note: visible native date picker appears below the editor, before attachments.
- Pick a past date, save note: history event shows the chosen date.
- Quick Context items in preview show Tabler pin icon + light blue background.
- Empty date field → falls back to "now".
