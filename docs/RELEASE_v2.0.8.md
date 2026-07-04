# Release v2.0.8

**Tag:** `v2.0.8`
**Date:** 2026-07-04
**Repository:** [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban)

## Summary

v2.0.8 is an infrastructure + upload hotfix. After the sherwood-toolbox deployment, `dashboard.publicadjustermidwest.com` is served directly by the host's nginx (not the Docker `estimate-nginx` container). The required upload/timeout settings were missing from the active host site file, causing 413 errors on PDF/image attachments (`UploadProgress.ashx`) and upstream timeouts on tag/history calls.

All documentation, deploy scripts, and references have been updated to reflect that the **host nginx site file** (`/etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com`) is now the permanent source of truth for this domain.

## Changes

### Fixed / Infrastructure
- **Host nginx is now the permanent front-end** for `dashboard.publicadjustermidwest.com`. The Docker `estimate-nginx` + `/opt/estimate-enhancer/nginx.conf` path is historical for this domain.
- **Restored PDF/image attachments in edit/quick-note/side modals.** Added the three directives to the host site file (matching sherwood-toolbox convention on the host):
  - `client_max_body_size 100m;`
  - `proxy_request_buffering off;`
  - `proxy_read_timeout 120s;`
- These lines live inside the https server block before `location /`.
- `proxy_read_timeout 120s` also eliminates many of the "upstream timed out" errors on tag/history/user-profile calls.
- All docs updated (especially `docs/DASHBOARD_INFRASTRUCTURE.md` with a new 2026-07 section).
- Historical deploy scripts (`deploy/`) left in place but marked with clear "HISTORICAL" headers.
- `docker-compose.yml` external network declaration left unchanged (harmless).

### Files changed
- Host nginx site file (on droplet), `docs/DASHBOARD_INFRASTRUCTURE.md`, `docs/PRODUCTION_SERVER_NOTES.txt`, `docs/UPDATE_AND_DEPLOY.txt`, `docs/DEPLOY_v1.1_VERIFY_STEPS.md`, `AGENTS.md`, `docs/MIGRATE_DOMAINS.md`, `docs/CUTOVER_RUNBOOK.md`, `romanian_roadtrip.md`, `FUTURE_FEATURES.md`, `README.md`, `CHANGELOG.md`, `VERSION`, deploy/ historical script headers, plus the commit that landed the doc overhaul.

## Deploy steps (on production droplet)

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git pull
docker compose build --no-cache
docker compose up -d
```

No `systemctl restart crm-telegram-bot` needed for this release.

## Post-deploy verification (host nginx)

```bash
# Confirm the three lines are inside the active https block
sudo nginx -T 2>/dev/null | sed -n '/dashboard.publicadjustermidwest.com/,/^\}/p'

sudo nginx -T 2>/dev/null | grep -E 'client_max_body_size|proxy_request_buffering|proxy_read_timeout' | cat

curl -sI https://dashboard.publicadjustermidwest.com/ | head -3
curl -s https://dashboard.publicadjustermidwest.com/api/config | head -c 200
```

Hard-refresh browser (Ctrl+Shift+R) for new static assets. Then test a real PDF/image attachment in the edit modal.
