# Known issues

## ISSUE-001 — New Opportunity: custom user fields do not persist

**Status:** Open (UI disabled as of 2026-06-04)  
**Priority:** High  
**Area:** Create opportunity modal (`public/app.js`), API proxy (`server.py`)

### Summary

Values entered in CRM **user fields** on **New Opportunity** are not stored on the created deal, even though the opportunity itself is created successfully (title, stage, responsible, tags, etc.).

The dashboard temporarily hides all create-opportunity user field inputs. A hint in the modal states that custom user fields are not available yet. Re-enable by setting `CREATE_OPP_USER_FIELDS_ENABLED = true` in `public/app.js` after the save path is verified end-to-end.

### Symptoms

- User fills one or more opportunity user fields in the create modal and submits.
- Toast or error may report fields not saved; CRM shows the new opportunity without those field values.
- Per-field POST, PUT `customFieldList`, and verification re-read have all been tried; CRM often accepts requests without error but values do not appear (or invalid `Key` values are silently ignored).

### What was tried

1. **Definitions only** from `GET /api/2.0/crm/opportunity/customfield/definitions` (other definition endpoints produced wrong IDs).
2. **Create body** `customFieldList` as `[{ Key, Value }]` on `POST /api/2.0/crm/opportunity`.
3. **Per-field POST** `POST /api/2.0/crm/opportunity/{id}/customfield/{fieldId}?fieldValue=...` (native CRM style), with JSON and form-urlencoded fallbacks.
4. **Full PUT** merge of `customFieldList` on existing opportunity after create.
5. **Verify** via `GET .../customfield` re-read; surface `CRM did not store: …` when mismatch.
6. **Proxy fix** in `server.py`: empty `{}` body on custom-field POST no longer sent (breaks query-string `fieldValue` binding).
7. **Date fields** formatted as `MM/DD/YYYY` per tenant conventions.
8. **Excluded labels** from UI (Same Adjuster, Photo Drive Link, Members, address fields, etc.) — did not fix persistence for remaining fields.

### Likely causes (to confirm)

- [ ] Capture **native CRM** “New opportunity” create in browser DevTools → Network; compare payload and field IDs to this app.
- [ ] Confirm tenant API version and whether opportunity custom fields require a different endpoint or `fieldValue` encoding for SelectBox / MultiSelect types.
- [ ] Check whether POST create must omit `customFieldList` and only use per-field POST after create (order/timing).
- [ ] Run `scripts/probe_custom_fields.py` against the same portal session and compare stored values.
- [ ] Inspect proxy logs for 4xx/5xx on custom-field routes (silent 200 with no write is possible on bad Key).

### Files to change when fixing

| File | Role |
|------|------|
| `public/app.js` | `CREATE_OPP_USER_FIELDS_ENABLED`, `renderCreateOppCustomFields`, `collectCreateOppCustomFieldValues`, `applyCreateOpportunityCustomFields`, `buildOpportunityCreateBody` |
| `server.py` | Proxy body handling for `/customfield/{id}` POST |
| `scripts/probe_custom_fields.py` | Manual API probe |

### Acceptance criteria

1. Set `CREATE_OPP_USER_FIELDS_ENABLED = true`.
2. Create opportunity with at least one text, select, checkbox, and date user field filled.
3. Open the same deal in native CRM — all values match.
4. No “user fields not saved” toast; verification re-read passes.

### References

- OnlyOffice CRM opportunity custom fields: definitions `GET .../opportunity/customfield/definitions`, values `GET/POST .../opportunity/{id}/customfield/{fieldId}`.
- Board deal edit uses full GET + PUT for standard fields; custom fields on **edit** may need separate verification (out of scope for ISSUE-001 unless reported).