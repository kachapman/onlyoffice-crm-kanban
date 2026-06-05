# Deploy v1.1.0 on the server — verify each step

Use this on the **DigitalOcean droplet** only.  
**Do not** change Bluehost DNS, `/opt/estimate-enhancer/nginx.conf`, or host `certbot --nginx` for a normal app update.

**Repo path:** `/opt/vanguard/onlyoffice-crm-kanban`  
**Public URL:** https://dashboard.vanguardadj.com

---

## Step 1 — Connect to the server

```bash
ssh root@159.89.229.126
```

**STOP — verify**

```bash
hostname
pwd
```

- You should see the droplet hostname (e.g. `ubuntu-webapp1-estimateanalyzer`).
- If SSH fails, fix access before continuing. **Do not proceed.**

---

## Step 2 — Confirm DNS (optional, no changes)

```bash
dig +short dashboard.vanguardadj.com A @8.8.8.8
```

**STOP — verify**

- Output should be **`159.89.229.126`** (your droplet).
- If the IP is wrong, fix DNS at Bluehost first. **Do not deploy until DNS is correct.**

---

## Step 3 — Go to the app directory

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
```

**STOP — verify**

```bash
git remote -v
git branch --show-current
ls docker-compose.yml deploy/update.sh
```

- Remote should include `github.com/kachapman/onlyoffice-crm-kanban`.
- Branch should be `main` (unless you intentionally use a tag).
- `docker-compose.yml` and `deploy/update.sh` must exist.
- If the directory is missing, clone the repo before continuing. **Do not proceed.**

---

## Step 4 — Backup user data (recommended)

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
docker run --rm -v onlyoffice-crm-kanban_dashboard-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/dashboard-data-$(date +%F).tar.gz -C /data .
ls -lh /backup/dashboard-data-*.tar.gz | tail -1
```

**STOP — verify**

- The last line shows a `.tar.gz` file with non-zero size.
- If backup fails, investigate `docker volume ls` for `onlyoffice-crm-kanban_dashboard-data`. **Do not proceed until backup succeeds or you accept the risk.**

---

## Step 5 — See what version you have now

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git fetch origin
git log -1 --oneline
git describe --tags --always 2>/dev/null || true
```

**STOP — verify**

- Note the current commit (e.g. `236e77b` = v1.0 era, `32d86b6`+ = v1.1).
- If `git fetch` fails, fix GitHub access (SSH key or HTTPS). **Do not pull until fetch works.**

---

## Step 6 — Pull v1.1 code

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git checkout main
git pull --ff-only origin main
```

To pin exactly the release tag instead:

```bash
git checkout v1.1.0
```

**STOP — verify**

```bash
git log -1 --oneline
cat VERSION 2>/dev/null || echo "no VERSION file"
```

- Latest `main` should include `VERSION` with **`1.1.0`** and commit message mentioning v1.1.
- If `git pull` reports conflicts or merge commits, stop and resolve. **Do not run Docker until the tree is clean.**

```bash
git status
```

- Must show **nothing to commit, working tree clean** (except maybe untracked local files like `.env`).

---

## Step 7 — Rebuild and restart (app container only)

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
docker compose build
docker compose up -d
```

Or:

```bash
chmod +x deploy/update.sh
./deploy/update.sh
```

**STOP — verify**

```bash
docker compose ps
```

- Service `dashboard` (container `vanguard-crm-dashboard`) status **`running`**.
- If **Exited** or **Restarting**, run `docker compose logs --tail=80 dashboard` and fix before continuing. **Do not proceed.**

---

## Step 8 — App responds on localhost (bypass nginx)

```bash
curl -s http://127.0.0.1:8765/api/config
```

**STOP — verify**

- JSON includes `"portalUrl"` (e.g. `https://office.vanguardadj.com`).
- If connection refused, container is not listening — return to Step 7 logs. **Do not proceed.**

---

## Step 9 — Nginx can reach the dashboard (Docker network)

```bash
docker exec estimate-nginx wget -qO- http://vanguard-crm-dashboard:8765/api/config
```

**STOP — verify**

- Same JSON as Step 8.
- If this **fails** but Step 8 worked, fix network only (no DNS/nginx.conf edit yet):

```bash
docker network connect estimate-enhancer_estimate-network vanguard-crm-dashboard 2>/dev/null || true
docker exec estimate-nginx wget -qO- http://vanguard-crm-dashboard:8765/api/config
```

- Repeat until JSON appears. **Do not open the public URL until this passes.**

---

## Step 10 — Public HTTPS and domain

```bash
curl -sI https://dashboard.vanguardadj.com/ | head -5
curl -s https://dashboard.vanguardadj.com/api/config
```

**STOP — verify**

- First command: **`HTTP/2 200`** or **`HTTP/1.1 200`** (not 502/503/521).
- Second command: same JSON as Step 8.
- If **502** after Step 9 passed: reload nginx only:

```bash
docker exec estimate-nginx nginx -t
docker exec estimate-nginx nginx -s reload
curl -sI https://dashboard.vanguardadj.com/ | head -5
```

- **Do not edit** `/opt/estimate-enhancer/nginx.conf` unless Step 9 never worked.
- **Do not run** host `certbot --nginx` on this droplet.

---

## Step 11 — Browser smoke test

1. Open https://dashboard.vanguardadj.com
2. Log in with CRM credentials.
3. Confirm **CRM notifications** show events (or a clear empty message after loading finishes).
4. Open a **notes** tile → **File** → confirm **Restore from archive…** exists.
5. Confirm existing groups/tiles/layout are still present.

**STOP — verify**

- Login works; no certificate warning.
- Settings/tiles from before the deploy are still there.
- If anything is wrong, see **Rollback** below before making nginx/DNS changes.

---

## Rollback (only if Step 11 fails)

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git fetch origin
git checkout v1.0.0
docker compose up -d --build
```

Then repeat **Steps 8–11**. User data in the Docker volume is kept.

---

## What this deploy does **not** change

| Item | Action |
|------|--------|
| Bluehost DNS A record `dashboard` | No change |
| `estimate-nginx` config file | No change |
| TLS certificates | No change |
| Server `.env` | No change |
| Docker volume `dashboard-data` | Preserved |

---

## Publish GitHub Release notes (optional)

If the GitHub **Release** page for `v1.1.0` is empty, paste the body from [RELEASE_v1.1.md](./RELEASE_v1.1.md) at:

https://github.com/kachapman/onlyoffice-crm-kanban/releases