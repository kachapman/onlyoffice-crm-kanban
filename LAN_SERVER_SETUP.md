# LAN Server Setup — Sietch CRM

## Where we are

### Phase 2H (Documents Modal) — ALL CODE COMPLETE, needs real-server testing
All code is written and pushed to GitHub (`new-crm` branch). Commits:
- `1a2e654` — Backend: new documents API endpoints (personal/company/search/batch/copy/upload)
- `c5de6e5` — Frontend: documents modal JS + HTML + CSS
- `bd4bf66` — Frontend: right-click context menu + preview modal docs tab overhaul
- `4be8a1e` — Fix: documents icon (Tabler files), remove refresh button

### What Phase 2H does
- Header "Documents" button (Tabler files icon) opens a modal with 3 scopes:
  - **Projects** — browse/search all project documents; pick from 5 recent projects or search all
  - **My Docs** — personal documents (not tied to any project)
  - **Company** — company-shared documents
- Per-scope: upload files, batch delete/move/copy, right-click context menu (open in editor, download, rename, move, copy, delete)
- Project preview modal "Documents" tab overhauled with icons, size, date, checkboxes, upload, batch delete
- **Backend** new endpoints: `GET /api/v2/documents/personal`, `/company`, `/search`, `PATCH /api/v2/documents/{id}`, `POST /api/v2/documents/{id}/copy`, `/batch-delete`, `/batch-move`, `/batch-copy`, `/personal/upload`, `/company/upload`, `GET /api/v2/projects/simple`

### What needs real infrastructure to test
- **Documents upload** — needs OnlyOffice Document Server (Docker) for `/api/v2/documents/{id}/editor-config` to work
- **Actual file storage** — needs the `shared/` directory on the server filesystem
- **Full app function** — needs PostgreSQL with the sietch_crm database (already imported: 1,191 opps, 38,898 history events, 16 contacts, 11 users)

---

## LAN server setup checklist

### 1. Pull latest code
```bash
cd ~/new-crm  # or wherever you cloned
git pull origin new-crm
```

### 2. Restore the database (if not already present)
```bash
# As postgres user, create and restore:
createdb sietch_crm
psql sietch_crm < sietch_crm_backup.sql
```

### 3. Configure environment
```bash
cp config.example.env .env
# Edit .env with:
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=sietch_crm
DB_USER=postgres
DB_PASSWORD=<your postgres password>

# OnlyOffice Document Server (required for Documents modal to open files):
DOCS_PUBLIC_URL=https://<your-docserver-host>:9443
DOCS_JWT_SECRET=<generate a secret — must match what's set in the Document Server container>
```

### 4. Start OnlyOffice Document Server (Docker)
```bash
docker run -d \
  --name onlyoffice-docserver \
  -p 9443:443 \
  -v /opt/onlyoffice/Data:/var/www/onlyoffice/Data \
  -v /opt/onlyoffice/logs:/var/log/onlyoffice \
  -e JWT_SECRET=<same secret as above> \
  onlyoffice/documentserver
```
Wait ~30-60s for it to start. Verify:
```bash
curl -k https://localhost:9443/healthcheck
```
Should return something truthy.

### 5. Start the dashboard
```bash
./start.sh
# Or directly:
DB_HOST=127.0.0.1 ./.venv/bin/python3 server.py
```
Server binds to `0.0.0.0:8765` — accessible at `http://<server-lan-ip>:8765` on your LAN.

### 6. Test the Documents modal
1. Open `http://<server-lan-ip>:8765` in browser
2. Login with your real credentials (bot@publicadjustermidwest.com / FRi3tz4yWXrMTEZ)
3. Click the **Documents** button (files icon, right of email inbox button)
4. Switch between Projects / My Docs / Company scopes
5. Click a recent project name to see its documents
6. Right-click any document row to see the context menu (open, download, rename, move, copy, delete)
7. Double-click a document to open it in OnlyOffice editor
8. Test upload, batch delete, batch move/copy
9. Open a deal preview → Documents tab — should show file icons, checkboxes, upload button

---

## What's NOT yet done

Per `sietch-crm-plan.md` Phase 2H:
- [ ] Context menu rename/move/copy fully tested with real Document Server
- [ ] Drag-and-drop upload in documents modal
- [ ] Documents tab in project preview fully tested

Other known items (from plan):
- Phase 2D: Tile layout persistence improvements
- Phase 2E/F/G: Additional tile types not started
- Contacts: Section and tile support for imported contacts
- FEAT-003: Attachments upload

---

## Next session on the LAN server

1. Verify Phase 2H Documents modal fully works with real Document Server
2. Fix any remaining issues found during testing
3. Move on to: contacts section/tile, or next phase from `sietch-crm-plan.md`
