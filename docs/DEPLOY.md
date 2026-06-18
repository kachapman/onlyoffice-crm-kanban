# Deploy

**Production directory:** `/opt/vanguard/onlyoffice-crm-kanban`

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git pull
docker compose build
docker compose up -d
```

See `UPDATE_AND_DEPLOY.txt` for the full step-by-step workflow.
See `DEPLOY_v1.1_VERIFY_STEPS.md` for the verify-each-step checklist.
