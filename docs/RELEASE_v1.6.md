# Release v1.6.0

**Tag:** `v1.6.0`  
**Date:** 2026-06-10  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.6.0 delivers post-1.4.5 bug fixes for cross-device DM "of the day" unread state, elimination of random UI hangs after quick notes and pushes, reinforced persistence of status and DM read state across devices and logins/refreshes, and clean mobile quick-edit layout from preview without overlap. Also includes the quick note prefill fix from notes tiles (now renders as rich formatted HTML).

No breaking changes. All changes are additive and backward-compatible with prior 1.4.x releases.

---

## Post-1.4.5 bug fixes (cross-device reliability + no-UI-hang resilience)

- DM "of the day" inbox now correctly shows read/unread cross-device: `renderPresenceInbox` isUnread logic changed to only flag when *latest* message in thread is incoming (from other) and ts > lastReadDms; self-sent responses no longer make threads appear unread on other devices. Added `markPresenceDMRead` immediately after successful DM send.
- Eliminated random UI hangs / "nothing clickable" / browser "page not responding" after quick notes and other pushes: post-submit refreshes (preview + refreshGroup/refreshAll) now always deferred via setTimeout (non-blocking); same for queue processor's refreshAll on stage/due/tag mutations. History notes already skipped from full refresh.
- Status and DM read state (lastReadDms) persistence reinforced across devices and page refreshes/logins (server already persisted in per-user presence json; client now always syncs on snapshot + explicit mark on send/open; no resets except on explicit logout clearing hb).
- Mobile quick-edit from preview no longer overlaps: `layoutSideBySideDealEditAndPreview` now dynamically measures actual side card bottom + 4px gap and repositions preview top (and max-height) on mobile so borders almost touch cleanly (no hard 260px offset).

## Additional fixes

- Quick note prefill from notes tile now correctly renders as rich formatted HTML (markdown converted via `renderBasicMarkdown` into the contenteditable) + explicit clear of the editor on open. (Previously plain text/markdown would appear unformatted.)

## Documentation & Housekeeping

- Version bumped to 1.6.0 (VERSION, AGENTS.md, README, CHANGELOG.md, new RELEASE_v1.6.md, docs/GITHUB_RELEASES.md, docs/UPDATE_AND_DEPLOY.txt and deploy verify docs).
- AGENTS.md last session summary and current version updated to reflect the released fixes.
- Full session history captured; deploy checklist (local close, git push, prod docker compose + VERIFY blocks) followed exactly.

See the v1.4.5 / v1.4.1 / v1.4.0 notes for the prior presence, side editor, crash resilience, and rich notes foundations.

**This release focuses on making DMs, notes, and quick edits reliable and consistent across devices and after writes, with no perceived hangs.**

## Full GitHub release text

(Use the body above for the GitHub release; attach the changelog diff or point to CHANGELOG.md.) 
