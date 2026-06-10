# Release v1.6.1

**Tag:** `v1.6.1`  
**Date:** 2026-06-11  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.6.1 ships FEAT-003 (attachments on event notes) with full native CRM support (UploadProgress.ashx multipart uploads + form-urlencoded history.json with fileId[]), text priority, 25MB limit, plain no-icon pre-submit selected file list, and a right-side status queue list in the header (near mutation-sync-status) showing pending + completed note actions with success checks / X fails, auto-clear after exactly 10s. All note paths supported (deal-edit, quick-note, side-by-side, notes-tile prefill).

Also includes: mobile preview+editor vertical stack no longer overlaps (dynamic measurement + ResizeObserver + constraints); deferred preview re-open in deal-edit submit to eliminate hangs after notes/edits (only on prod); version "v1.6.1" added next to Sign out (to the right of portal URL in meta, properly spaced); server.py proxy fix to forward form-urlencoded/multipart so attachments work when going through the deployed dashboard droplet; hotfix for prod upload (X-OnlyOffice-Portal header + nginx body size config); rolled back "show empty stages" checkbox visibility for tag-sorted groups (the prior change had broken group tile rendering).

No breaking changes. All changes are additive and backward-compatible with prior 1.6.0 / 1.4.x releases.

---

## FEAT-003: Attachments on event notes

- Attach files (≤25 MB each) when creating event notes from Deal Edit and Quick Note (including side-by-side from preview and prefill from notes tile).
- Native CRM upload flow: client uploads via proxied `UploadProgress.ashx` (multipart, using current UserID from /people/@self), then history create uses `application/x-www-form-urlencoded` with repeated `fileId[]` (plus content, categoryId, entity*, created).
- Text is always priority (note sent even if some/all uploads fail; per-fail error toast).
- Pre-submit selected files: plain filename (size) list with × remove (no icons, per spec).
- Right-side status list in header (near `#mutation-sync-status`): shows pending + all completed note actions; success = checkmark, fail = ✕; completed items auto-clear after exactly 10 seconds.
- Reuses existing preview attachment rendering (`renderHistoryAttachmentsAside`), queue resilience (history items skip heavy refresh), rich note editor, and `currentUserId`.
- Server proxy (`server.py`) updated to correctly forward `multipart/form-data` (uploads) and `application/x-www-form-urlencoded` (history with attachments) — required for the extra hop through the dashboard when deployed to the droplet.

## Additional fixes

- Mobile vertical stacking of deal preview + deal/quick-note editor: improved dynamic measurement (actual side card bottom + 4px gap), ResizeObserver for live re-adjust, and max-height constraints in `layoutSideBySideDealEditAndPreview` to prevent overlap at the top.
- Hanging after deal edits and event notes (observed on prod, not local test server): deferred the preview re-open (`openOpportunityPreviewModal`) in `submitDealEditForm` success path (was immediate heavy fetch + full render); board refreshes were already deferred with setTimeout.
- Added version number ("v1.6.1") next to "Sign out" button (positioned in header meta, to the right of the portal URL, with spacing so it is not confused with the URL).
- Rolled back "show empty stages" checkbox visibility for tag-sorted groups (the change to expose it for `groupBy=tag` had completely broken group tile rendering); now only shown for `groupBy=stage` as before.
- Server proxy fix for form-urlencoded + multipart (see FEAT-003) ensures attachments (and any future form posts) work when the dashboard is accessed via the deployed droplet.
- Hotfix: added `X-OnlyOffice-Portal` header to the direct `UploadProgress.ashx` fetch (was missing and caused uploads to fail through the droplet proxy while text notes succeeded). Confirmed working on droplet after also setting `client_max_body_size 50m;` and `proxy_request_buffering off;` in the dashboard location of `/opt/estimate-enhancer/nginx.conf`.

## Documentation & Housekeeping

- Version bumped to 1.6.1 (VERSION, AGENTS.md, README, CHANGELOG.md, new RELEASE_v1.6.1.md, docs/GITHUB_RELEASES.md, docs/UPDATE_AND_DEPLOY.txt and deploy verify docs).
- AGENTS.md last session summary and current version updated.
- Full session history captured; deploy checklist followed.
- Local dev server closed; prod update process will follow the standard steps.

See the v1.6.0 / v1.4.5 notes for the prior bug fixes, side editor, presence AFD, crash resilience, and rich notes foundations.

**This release focuses on attachments (FEAT-003) plus small UX/stability fixes to make the feature (and prior v1.6.0 work) fully functional on the deployed server, with no perceived hangs or layout breakage.**

## Full GitHub release text

(Use the body above for the GitHub release; attach the changelog diff or point to CHANGELOG.md.) 
