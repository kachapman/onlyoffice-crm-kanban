# Release v1.7.0

**Tag:** `v1.7.0`  
**Date:** 2026-06-11  
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v1.7.0 ships FEAT-002: custom user fields on opportunity create now work end-to-end. Two bugs were fixed — a DOM query selector issue that silently skipped all custom fields, and a JSON payload format issue that caused 400 errors when fields were present. All prior v1.6.1 and v1.6.0 features remain unchanged.

No breaking changes. All changes are additive and backward-compatible with prior 1.6.x releases.

---

## FEAT-002: Custom user fields on opportunity create (ISSUE-001 — FIXED)

### Root cause (two independent bugs)

1. **DOM query selector bug** (primary reason fields never saved): `collectCreateOppCustomFieldValues()` used `wrap.querySelector('[data-custom-field-id="..."]')` which matched the wrapper `<div>` (set in `renderCreateOppCustomFields` via `field.dataset.customFieldId`) instead of the actual `<input>`/`<select>`/`<textarea>`. Accessing `.value` on a `<div>` returned `undefined` → empty string → `if (!raw) continue;` — every field was silently skipped and `customFieldList` was absent from the create body.

2. **JSON payload format** (secondary, caused 400 errors when fields were present): `buildCustomFieldListForApi()` returned `{Key, Value}` (PascalCase) format. Combined with flat `customField_{id}` fields, this caused the CRM's `DeserializeXNode` to produce duplicate XML sibling nodes, triggering "Input string was not in a correct format" / "Value does not fall within the expected range".

### Fix

- `collectCreateOppCustomFieldValues()` now finds the wrapper div by `[data-custom-field-id]`, then uses `fieldEl.querySelector("input, select, textarea")` to get the real input element with the user's value.
- `buildCustomFieldListForApi()` returns only `{key, value}` (camelCase) — no duplicate props.
- `buildOpportunityCreateBody()` includes `customFieldList` in `{key, value}` format; no flat `customField_{id}` loop.
- Per-field POST (`POST .../customfield/{fieldId}?fieldValue=...`) confirmed working as fallback.
- `CREATE_OPP_USER_FIELDS_ENABLED=true`.

### Verification

Tested end-to-end: dashboard ↔ proxy ↔ CRM. Created opportunities with text, select, date, and checkbox custom fields; verified they persist in native CRM.

## Documentation & Housekeeping

- Version bumped to 1.7.0 (VERSION, AGENTS.md, README, CHANGELOG.md, new RELEASE_v1.7.0.md, docs/GITHUB_RELEASES.md).
- AGENTS.md last session summary and current version updated.
- ISSUES.md ISSUE-001 marked RESOLVED.
- FUTURE_FEATURES.md FEAT-002 marked COMPLETED.
- Full session history captured; deploy checklist followed.

See the v1.6.1 notes for FEAT-003 attachments, mobile layout fix, and prod stability.

**This release focuses on fixing custom user fields on new opportunity create (FEAT-002 / ISSUE-001), which had been broken since the feature was first prototyped.**

## Full GitHub release text

(Use the body above for the GitHub release; attach the changelog diff or point to CHANGELOG.md.)
