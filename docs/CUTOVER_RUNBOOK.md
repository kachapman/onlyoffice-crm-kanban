# Domain Cutover Runbook

**Move CRM:** `office.vanguardadj.com` → `office.publicadjustermidwest.com`  
**Move dashboard:** `dashboard.vanguardadj.com` → `dashboard.publicadjustermidwest.com`

Droplet IPs stay the same. User emails stay `@vanguardadj.com`.

This runbook does the **dashboard side first**, then the **CRM side**. That way the dashboard is already waiting on the new domain when the CRM container is recreated.

---

## Pre-flight

- [ ] New DNS A records added and propagated:
  - `office.publicadjustermidwest.com` → `68.183.130.39`
  - `dashboard.publicadjustermidwest.com` → `159.89.229.126`
- [ ] Old DNS records still exist during cutover (do not remove yet).
- [ ] Code/config fallbacks already updated in this repo (`config.example.env`, `server.py`, `app.js`, `AGENTS.md`).
- [ ] Notification mail-cache changes have been rolled back.
- [ ] Commit and push to GitHub before deploying.

Verify DNS:

```bash
dig +short office.publicadjustermidwest.com A @8.8.8.8
dig +short dashboard.publicadjustermidwest.com A @8.8.8.8
```

---

## 1. Dashboard Droplet (`159.89.229.126`)

> Do this first. The dashboard will be ready on the new domain; it will not fully function until the CRM side is also cut over, but certs and config will be in place.

### 1a. Reverse proxy / TLS

**Note (2026-07):** As of the sherwood-toolbox cutover, `dashboard.publicadjustermidwest.com` is served by the **host's nginx** (systemd site file `/etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com`), not the Docker `estimate-nginx` container. The steps below are the historical path. For the current world, back up and edit the host site file instead, ensure the upload lines are present (`client_max_body_size 100m; proxy_request_buffering off; proxy_read_timeout 120s;`), and reload with `sudo nginx -t && sudo systemctl reload nginx`. See `docs/DASHBOARD_INFRASTRUCTURE.md`.

Historical steps (estimate-nginx era):

Back up nginx config:

```bash
sudo cp /opt/estimate-enhancer/nginx.conf /opt/estimate-enhancer/nginx.conf.$(date +%Y%m%d).bak
```

Edit `/opt/estimate-enhancer/nginx.conf`:

- Change `server_name dashboard.vanguardadj.com` → `server_name dashboard.publicadjustermidwest.com`
- Change cert paths to `/etc/letsencrypt/live/dashboard.publicadjustermidwest.com/...`
- Keep `proxy_pass http://vanguard-crm-dashboard:8765;`
- Ensure the HTTP server block still serves the ACME webroot:

```nginx
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

If `/var/www/certbot` is not mounted into `estimate-nginx`, add it to `/opt/estimate-enhancer/docker-compose.yml` under the nginx service volumes:

```yaml
- /var/www/certbot:/var/www/certbot:ro
```

Then recreate the nginx container:

```bash
cd /opt/estimate-enhancer
docker compose up -d
```

Generate the new certificate:

```bash
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d dashboard.publicadjustermidwest.com
```

Reload nginx:

```bash
docker exec estimate-nginx nginx -t
docker exec estimate-nginx nginx -s reload
```

### 1b. Dashboard app

Pull latest code and migrate user data:

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git pull

cd data
for DIR in user-profiles user-presence dashboard-notes presence-messages; do
  if [ -d "$DIR/office.vanguardadj.com" ]; then
    cp -a "$DIR/office.vanguardadj.com" "$DIR/office.publicadjustermidwest.com"
    echo "Migrated $DIR"
  fi
done
cd ..
```

Update `.env`:

```bash
ONLYOFFICE_PORTAL_URL=https://office.publicadjustermidwest.com
PORT=8765
ONLYOFFICE_SSL_VERIFY=true
COOKIE_SECURE=true
```

Rebuild and restart:

```bash
docker compose up -d --build
```

Quick dashboard-only verification:

```bash
curl -s https://dashboard.publicadjustermidwest.com/api/config | grep portalUrl
# Expect: "portalUrl": "https://office.publicadjustermidwest.com"
```

The dashboard will return 502s or login failures until the CRM side is ready.

---

## 2. CRM Droplet (`68.183.130.39`)

> This is the user-facing downtime step. The CRM will be unavailable for roughly 5–10 minutes while the container is recreated.

### 2a. Back up everything

Back up the persistent volumes and the original run command:

```bash
# Volumes
sudo rsync -aP /app/onlyoffice/CommunityServer/data /root/onlyoffice-backup-$(date +%Y%m%d)-data
sudo rsync -aP /app/onlyoffice/CommunityServer/letsencrypt /root/onlyoffice-backup-$(date +%Y%m%d)-letsencrypt
sudo rsync -aP /app/onlyoffice/CommunityServer/logs /root/onlyoffice-backup-$(date +%Y%m%d)-logs
sudo rsync -aP /app/onlyoffice/DocumentServer/data /root/onlyoffice-backup-$(date +%Y%m%d)-docdata
sudo rsync -aP /var/lib/docker/volumes/64337d03d015472735e476b3877e9ded3a846bbd16d10631db9a4533bd3b6fff/_data /root/onlyoffice-backup-$(date +%Y%m%d)-mysql

# Original container spec (for rollback)
docker inspect onlyoffice-community-server > /root/onlyoffice-backup-$(date +%Y%m%d)-inspect.json
```

### 2b. Recreate the container with the new domain

Stop and remove the old container:

```bash
docker stop onlyoffice-community-server
docker rm onlyoffice-community-server
```

Run the new container:

```bash
docker run -d \
    --name onlyoffice-community-server \
    -e MYSQL_SERVER_ROOT_PASSWORD=my-secret-pw \
    -e MYSQL_SERVER_PASS=onlyoffice_pass \
    -e ELASTICSEARCH_SERVER_HTTPPORT=9200 \
    -e CONTROL_PANEL_PORT_80_TCP=80 \
    -e DOCUMENT_SERVER_PORT_80_TCP_ADDR=onlyoffice-document-server \
    -e ELASTICSEARCH_SERVER_HOST=onlyoffice-elasticsearch \
    -e CONTROL_PANEL_PORT_80_TCP_ADDR=onlyoffice-control-panel \
    -e DOCUMENT_SERVER_JWT_SECRET=hqU2PYdz9oCrV9gU5ydsR42gUKpOE9Q8 \
    -e ONLYOFFICE_CORE_MACHINEKEY=I9P1i9uDqCj8 \
    -e MYSQL_SERVER_USER=onlyoffice_user \
    -e DOCUMENT_SERVER_JWT_HEADER=AuthorizationJwt \
    -e MYSQL_SERVER_DB_NAME=onlyoffice \
    -e MYSQL_SERVER_HOST=onlyoffice-mysql-server \
    -e MAIL_IMAPSYNC_START_DATE=2025-11-27T03:28:01 \
    -e DOCUMENT_SERVER_JWT_ENABLED=true \
    -e PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    -e LANG=en_US.UTF-8 \
    -e LANGUAGE=en_US:en \
    -e LC_ALL=en_US.UTF-8 \
    -e ELASTICSEARCH_VERSION=7.16.3 \
    -e LETS_ENCRYPT_DOMAIN=office.publicadjustermidwest.com \
    -e LETS_ENCRYPT_MAIL=info@vanguardadj.com \
    -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
    -v /app/onlyoffice/CommunityServer/data:/var/www/onlyoffice/Data \
    -v /app/onlyoffice/CommunityServer/logs:/var/log/onlyoffice \
    -v /app/onlyoffice/DocumentServer/data:/var/www/onlyoffice/DocumentServerData \
    -v /app/onlyoffice/CommunityServer/letsencrypt:/etc/letsencrypt \
    -v 64337d03d015472735e476b3877e9ded3a846bbd16d10631db9a4533bd3b6fff:/var/lib/mysql \
    -p 80:80 \
    -p 443:443 \
    -p 5222:5222 \
    --network onlyoffice \
    --restart always \
    --privileged \
    onlyoffice/communityserver:12.7.1.1942
```

Watch logs for certbot success and OnlyOffice startup:

```bash
docker logs -f onlyoffice-community-server
```

Look for `certbot`, `Congratulations`, or nginx starting, then press `Ctrl+C`.

### 2c. Set portal domain in CRM UI

- Open `https://office.publicadjustermidwest.com`
- Log in as admin → **Settings → Customization → Domain**
- Set portal address to `https://office.publicadjustermidwest.com`

### 2d. Verify CRM

```bash
curl -sI https://office.publicadjustermidwest.com/
```

---

## 3. End-to-End Verification

```bash
# Dashboard config returns the new portal URL
curl -s https://dashboard.publicadjustermidwest.com/api/config | grep portalUrl

# Both endpoints respond over HTTPS
curl -sI https://office.publicadjustermidwest.com/
curl -sI https://dashboard.publicadjustermidwest.com/

# Dashboard can reach the CRM proxy
curl -s https://dashboard.publicadjustermidwest.com/api/proxy/2.0/crm/opportunity/filter.json | head -c 200
```

Open `https://dashboard.publicadjustermidwest.com` in a browser and test login. Users may need to hard-refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) or clear cookies for the old domain.

---

## 4. Post-Cutover Cleanup

After 24–48 hours of confirmed stability:

- [ ] Remove old DNS records:
  - `office.vanguardadj.com`
  - `dashboard.vanguardadj.com`
- [ ] Delete old data directories:

```bash
cd /opt/vanguard/onlyoffice-crm-kanban/data
rm -rf user-profiles/office.vanguardadj.com
rm -rf user-presence/office.vanguardadj.com
rm -rf dashboard-notes/office.vanguardadj.com
rm -rf presence-messages/office.vanguardadj.com
```

- [ ] Test auto-renewal on both droplets:

```bash
sudo certbot renew --dry-run
```

---

## Rollback (if cutover fails)

1. Restore old DNS records at Bluehost.
2. On dashboard droplet: restore the relevant nginx backup (host site file `/etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com.bak.*` in the 2026-07+ world, or `/opt/estimate-enhancer/nginx.conf.bak.*` in the old estimate-nginx world), reload nginx, revert `.env` to old domain, and `docker compose up -d --build`.
3. On CRM droplet: stop/remove the new container and recreate the original one using `/root/onlyoffice-backup-YYYYMMDD-inspect.json`.
4. Delete the new portal-key data directories if needed.

For full details and background, see `docs/MIGRATE_DOMAINS.md`.
