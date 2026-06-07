# Release v1.4.0

**Tag:** `v1.4.0`  
**Date:** 2026-06-08  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.4.0 polishes the local kanban tile (title now editable in the standard tile title bar, edit button left of delete, stage column colors visible via header dot, add-task inline input no longer crashes on blur/removeChild, column drag scrapped in favor of slide buttons in the edit UI) and makes the Team/Presence demo message + blue unread indicator fully reliable and session-persistent (no more flashing on/off after reload; stays until you click the demo in the inbox). The Messages inbox now has obvious dark/light shading + blue accent border + dot to distinguish unread vs read threads (demo specially handled). All changes from the long live-testing session are complete, tested, and documented. No server changes required.

---

## Fixes & Polish (Local Kanban)

- Editable board name moved into the tile's title bar (`.tile-toolbar-title`, using `dataset.tileLabel` + dblclick contentEditable) exactly like notes/groups. No more internal duplicate name or forced hide of toolbar title.
- Per-column edit (✎) button is now to the left of the × delete button.
- Color picker for stages now visibly affects the column header (added `<span class="column-dot">` styled like group kanbans; always present, not just card left borders).
- "Add task" (and +status) inline dark fields no longer throw `NotFoundError: removeChild` (the node was moved in a blur handler). Implemented with `submitted` flag + `setTimeout(0)` cleanup guard on parentNode.
- Column drag/reorder fully removed (no more `draggable`, `'col:'` dataTransfer, `makeReorderDrop`, or col: branches in drop handlers — it never worked reliably). Edit UI now provides ◀ / ▶ slide buttons that reorder the array, persist, rebuild the board, and re-open the editor on the moved column.

## Presence / Team (demo indicator + inbox cues)

- Demo/test message now injected for every new user/session with the exact requested concise text explaining team presence (green dot + count) and messaging (roster + Messages tab for DMs/replies/reads). No mention of admin area.
- Blue unread counter bubble (top-right on Team button) now appears immediately on reload and stays on (via sync force in `ensurePresenceOnLogin` + re-assert on every `updatePresenceHeaderBadge` call) until you explicitly click the demo message to "read" it.
- Introduced `demoMessageReadThisSession` flag (false on new load, true only on click of demo in inbox via `markPresenceDMRead`). Blue indicator and inbox shading for demo now key off this flag (stable across snapshots, no ts/lastRead races causing flash-off).
- Messages inbox now clearly indicates unread vs read threads with dark/light shading: `.unread` rows get surface-2 bg + prominent blue left border + blue ● dot; `.read` rows are faded with muted text. Demo row specially forced by the session flag + always labeled "just now (demo)" (no more 20k-day timestamps).
- Header indicator is refreshed on popup close (and live on thread open) so count only reflects messages you haven't clicked/read.
- Demo message always present in the inbox list (re-injected after any server overwrite) but respects the read flag for both count and visual state.

## Documentation & Housekeeping

- Version bumped to 1.4.0 (VERSION, AGENTS.md, README, CHANGELOG, new RELEASE_v1.4.md, GITHUB_RELEASES.md, UPDATE_AND_DEPLOY.txt).
- New session chat history document added: `docs/SESSION_2026-06-07.md` (full summary of the conversation + fixes with date stamp).
- All prior local-kanban and presence live feedback now reflected in docs.

See also [docs/RELEASE_v1.4.md](./docs/RELEASE_v1.4.md) wait, this is it. Full details in source (public/app.js local kanban render/bind/build + presence fetch/ensure/badge/inbox + new flag) and the session log.

**No server changes** (pure frontend + docs for this release).
