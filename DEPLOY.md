# Deploying to DigitalOcean (dashboard.publicadjustermidwest.com)

This guide covers updating the server after a commit to GitHub.

**Server path:** `/opt/vanguard/onlyoffice-crm-kanban`

For initial server setup (Docker, Nginx, HTTPS certs), see the one-time setup steps archived in docs/. This document assumes the droplet is already provisioned.

---

## DNS at Bluehost (for dashboard.publicadjustermidwest.com)

1. In **Bluehost → Domains → DNS / Zone Editor** for `publicadjustermidwest.com`.
2. Add an A record: **dashboard** → your DigitalOcean droplet public IPv4.

Verify:

```bash
dig +short dashboard.publicadjustermidwest.com
```

---

## Pulling updates from GitHub

On the droplet:

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
chmod +x deploy/update.sh
./deploy/update.sh
```

Or manually:

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
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
|-------|-------|
| 502 / connection refused | `docker compose ps` and `docker compose logs -f` |
| Login works locally but not on subdomain | `COOKIE_SECURE=true` only works over HTTPS; use certbot |
| Settings not saving | `docker compose logs`; ensure `/app/data` volume is writable |
| CRM API errors | `ONLYOFFICE_PORTAL_URL` correct; droplet can reach office.publicadjustermidwest.com |

---

## Security notes

- The app binds to `127.0.0.1:8765` on the host; only Nginx is public.
- Session cookies are HttpOnly; `COOKIE_SECURE=true` in production.
- Do not commit `.env` or `data/` to GitHub.
