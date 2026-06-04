# Deploying to DigitalOcean (dashboard.vanguardadj.com)

This guide covers Docker deployment on Ubuntu, DNS at Bluehost, GitHub workflow, and per-user server storage.

## What gets saved per user

After login, the dashboard saves a **user profile** on the server (under `/app/data/user-profiles/` in Docker), keyed by:

- OnlyOffice **portal URL** (e.g. `https://office.vanguardadj.com`)
- CRM **user id** from your login

Stored settings include: opportunity groups & filters, tile layout, calendar tiles, notes tiles, group templates, hidden notifications, and feed keyword filter.

Data survives logout, browser changes, and server restarts. It is **not** in git (`data/` is ignored).

---

## DNS at Bluehost (for dashboard.vanguardadj.com)

1. In **Bluehost → Domains → DNS / Zone Editor** for `vanguardadj.com`.
2. Add a record:

| Type | Host / Name | Points to | TTL |
|------|-------------|-----------|-----|
| **A** | `dashboard` | Your DigitalOcean droplet **public IPv4** | 300 (or default) |

Result: `dashboard.vanguardadj.com` → droplet IP.

**Optional:** If Bluehost supports CNAME for subdomains and you use a stable hostname for the droplet, you can CNAME `dashboard` → that hostname instead.

3. Wait for DNS propagation (often 5–30 minutes; up to 48h).

Verify:

```bash
dig +short dashboard.vanguardadj.com
```

---

## GitHub: upload the project (you do this — not the AI)

I cannot log into your GitHub account. On your machine:

```bash
cd /home/zionad/crm-kanban   # or your clone path

# If not already a repo:
git init
git add Dockerfile docker-compose.yml .dockerignore server.py ics_calendar.py user_profile_store.py notes_store.py public deploy config.example.env DEPLOY.md README.md ISSUES.md .gitignore
git commit -m "CRM dashboard: Docker deploy and per-user profiles"

# Create an empty repo on GitHub (no README), then:
git remote add origin git@github.com:YOUR_USER/crm-kanban.git
git branch -M main
git push -u origin main
```

Use **SSH keys** or **GitHub CLI** (`gh auth login`) for push access.

To give a collaborator access: GitHub repo → **Settings → Collaborators**.

---

## One-time droplet setup (Ubuntu)

```bash
# SSH into the droplet
ssh root@YOUR_DROPLET_IP

apt update && apt upgrade -y
apt install -y git docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

systemctl enable docker nginx

# Clone your repo
mkdir -p /opt/vanguard
cd /opt/vanguard
git clone git@github.com:YOUR_USER/crm-kanban.git
cd crm-kanban

# Configure environment
cp config.example.env .env
nano .env
```

Set in `.env`:

```env
ONLYOFFICE_PORTAL_URL=https://office.vanguardadj.com
PORT=8765
ONLYOFFICE_SSL_VERIFY=true
COOKIE_SECURE=true
```

```bash
# Start the app (listens on 127.0.0.1:8765 only)
docker compose up -d --build

# Nginx reverse proxy
sudo cp deploy/nginx-dashboard.conf /etc/nginx/sites-available/dashboard.vanguardadj.com
sudo ln -sf /etc/nginx/sites-available/dashboard.vanguardadj.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS (Let's Encrypt)
sudo certbot --nginx -d dashboard.vanguardadj.com
```

Open **https://dashboard.vanguardadj.com** and log in with your CRM credentials.

---

## Pulling updates later

On the droplet:

```bash
cd /opt/vanguard/crm-kanban
chmod +x deploy/update.sh
./deploy/update.sh
```

Or manually:

```bash
git pull
docker compose build
docker compose up -d
```

---

## Backups

Back up the Docker volume (user profiles):

```bash
docker run --rm -v crm-kanban_dashboard-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/dashboard-data-$(date +%F).tar.gz -C /data .
```

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| 502 / connection refused | `docker compose ps` and `docker compose logs -f` |
| Login works locally but not on subdomain | `COOKIE_SECURE=true` only works over HTTPS; use certbot |
| Settings not saving | `docker compose logs`; ensure `/app/data` volume is writable |
| CRM API errors | `ONLYOFFICE_PORTAL_URL` correct; droplet can reach office.vanguardadj.com |

---

## Security notes

- The app binds to `127.0.0.1:8765` on the host; only Nginx is public.
- Session cookies are HttpOnly; `COOKIE_SECURE=true` in production.
- Do not commit `.env` or `data/` to GitHub.