# Release v1.8.0

## Stale Deals Tile — Attempted, debugged, and scrapped

### What was tried

**Attempt A (activity-based):**
- Used `state.feedRawItems` (CRM notifications feed) to find the last activity event per opportunity.
- Computed days since last event. If no event found in the feed window, showed "no activity in N days."
- Added caching (`localStorage` daily key), midnight refresh, severity colors (amber/orange/red), and a threshold dropdown.
- **Failed:** The feed only covers the last 30 days (max 150 events). Most opportunities had no activity found in that window. The fallback to `opp.created` (creation date) was misleading.

**Attempt B (due-date-based):**
- Switched to `expectedCloseDate` on opportunity objects. If the due date was more than N days in the past, the deal was "stale."
- Added threshold dropdown (1 week / 30 days / 90+ days). Bread emoji 🍞 for stale indicator.
- **Failed:** During testing, no deals were listed in any time period. The `expectedCloseDate` on open deals was not reliably past-due.

**Scrapped:** All stale deals code removed from `public/app.js`, `public/index.html`, `public/styles.css`.

### Root cause
- `expectedCloseDate` on open deals was not reliably past-due in the test data.
- The concept of "stale" needs a different data source (e.g., actual last-modified timestamp on opportunities, which the CRM API does not provide directly).

### Future
- May revisit with a proper CRM-side query or different staleness metric.
- See ISSUES.md ISSUE-004 for full post-mortem.

---

## Fix: Production version display showing "vdev"

### Root cause
- `Dockerfile` did not copy the `VERSION` file into the container.
- `server.py` fell back to `APP_VERSION = "dev"`, so the UI showed `vdev`.

### Fix
- Added `COPY VERSION ./` to `Dockerfile`.

### Verify
- On next Docker build, `GET /api/config` should return `"version": "1.8.0"`.

---

## Files changed
- `public/app.js` — All stale deals tile code removed
- `public/index.html` — Stale deals add-tile option and form removed
- `public/styles.css` — All stale deals CSS removed
- `Dockerfile` — `COPY VERSION ./` added
- `VERSION` — Already set to `1.8.0`
- `CHANGELOG.md` — Updated
- `AGENTS.md` — Updated
- `README.md` — Version updated
- `ISSUES.md` — ISSUE-004 added
- `FUTURE_FEATURES.md` — FEAT-023 updated to scrapped
- `Toaster_Features` — Stale deals tile marked scrapped
- `docs/GITHUB_RELEASES.md` — v1.8.0 entry added
- `docs/RELEASE_v1.8.0.md` — This file
