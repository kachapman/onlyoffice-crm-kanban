# Release v1.4.5

**Tag:** `v1.4.5`  
**Date:** 2026-06-09  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.4.5 delivers major UX improvements for working with opportunity previews and notes while the CRM is under load or down, plus accuracy fixes for the Team/Presence roster and daily visibility in the notifications feed. Key themes: non-blocking side-by-side note editing from preview, one-click delete of history notes in preview, manual refresh button, today highlighting in feed, and a persistent amber crash banner that lets the whole dashboard stay usable (tiles render, local features work, CRM sections go empty) during 5xx outages.

No breaking changes. All changes are additive and backward-compatible with prior 1.4.x releases.

---

## Side-by-side preview note editor + delete + refresh

- From the opportunity preview modal, the "edit" (or quick note flow) now opens the note editor (rich B/I/U/H, tags, due, notify) as a separate popup fixed to the *left* of the preview on desktop or *top* of the preview on mobile (<700px). Both remain fully interactive at once (preview history/details + editor).
- Preview auto-refreshes after successful note submit from the side editor (new event note appears in History & notes immediately).
- New × delete button on individual event note history items inside the preview (confirmDialog + DELETE /api/2.0/crm/history/{id}; only for real note-category non-mail events). Preview re-opens to show updated list.
- New refresh button (⟳) added to the top of the preview head (left of the ✎ edit button) for manual re-fetch of the current opp (handy after side-note adds or external CRM changes).
- Escape in preview closes the side editor first (keeps preview open). Positioning survives re-renders and uses pointer-events trick + fixed cards for true simultaneous use.

## Presence / Team: AFD (Away from Dashboard) + accuracy

- Roster now distinguishes:
  - Online (green): tab visible + heartbeat <10m.
  - Away from dashboard (AFD, subtle slate-gray dot + dedicated "Away from dashboard (N)" section): tab backgrounded but session still active (hb record exists but stale; not cleared by logout).
  - Offline (dark): explicitly signed out (manual or auto 3h — server clears lastHeartbeat on /api/logout) or aged >3h with no record.
- Auto-logout timer aligned to 3h. "Last CRM (proxy):" in admin view is confirmed to come only from real proxied CRM/people API calls.
- Compact tile and header indicators respect AFD state. Result: tab-away users no longer appear falsely "offline".

## Feed / CRM notifications: today line

- Every notification item from the current day (date match on local day) now receives a subtle white left border line (`.feed-item-today` + `border-left: 3px solid rgba(255,255,255,0.25)` with padding adjust) so today's activity stands out visually in the notifications feed / CRM notifications window.

## Crash / 5xx resilience banner + partial UI

- When the backend CRM (or proxy) returns 502/5xx (or any transient "bad gateway / unavailable / proxy" error) during init, refreshAll, presence heartbeats/snapshots, or loads: instead of raw 502 spam + toasts, a persistent subtle amber banner appears on the *right side* of the header meta area.
- Exact text: "CRM is temporarily unreachable and may have crashed. Refresh again in 30 seconds or contact system administrator."
- Amber (#f59e0b bg + dark #1f2937 text) is readable in both light and dark mode; non-dismissible except by successful CRM response (onCRMSuccess hides it) or full page reload.
- All tiles continue to render. CRM-dependent sections (stages, tags, opps, history, feed, portal users, etc.) gracefully show "no content" / empty states. Local features (notes tiles, kanban layout, presence roster from cache, etc.) remain fully usable.
- Quick note / side editor from preview still functions locally and will auto-refresh the preview on submit once connectivity returns.
- 30-second guidance built into the message. Existing mutation queue + transient retry logic continues to protect writes.

## Documentation & Housekeeping

- Version bumped to 1.4.5 (VERSION, AGENTS.md, README, CHANGELOG.md, new RELEASE_v1.4.5.md, docs/GITHUB_RELEASES.md, docs/UPDATE_AND_DEPLOY.txt and deploy verify docs).
- AGENTS.md "Post-v1.2 shipped items" extended with the new features.
- Full session history captured; deploy checklist (local close, git push, prod docker compose + VERIFY blocks) followed exactly.
- Local dev server closed; prod update process documented in this release + terminal walk-through provided to operator.

See the v1.4.1 / v1.4.0 notes for the prior presence, local kanban, and rich notes foundations.

**This release focuses on making preview + note work resilient and delightful even when the OnlyOffice CRM is temporarily down or slow, plus daily visibility and roster accuracy.**

## Full GitHub release text

(Use the body above for the GitHub release; attach the changelog diff or point to CHANGELOG.md.) 
