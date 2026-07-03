# Domain Migration Guide — vanguardadj.com → publicadjustermidwest.com

Move the CRM from `office.vanguardadj.com` to `office.publicadjustermidwest.com` and the dashboard from `dashboard.vanguardadj.com` to `dashboard.publicadjustermidwest.com`.

Assumptions:
- Droplet IPs stay the same.
- User email addresses stay `@vanguardadj.com`.
- Cutover is complete (old domains stop resolving).

---

## 1. DNS (Bluehost)

For domain `publicadjustermidwest.com`, add A records:

| Host | Points to |
|------|-----------|
| `office` | `68.183.130.39` (CRM droplet) |
| `dashboard` | `159.89.229.126` (dashboard droplet) |

For domain `vanguardadj.com`, remove or disable A records:
- `office`
- `dashboard`

Verify propagation:

```bash
dig +short office.publicadjustermidwest.com A @8.8.8.8
dig +short dashboard.publicadjustermidwest.com A @8.8.8.8
```

---

## 2. CRM Droplet (`68.183.130.39`)

OnlyOffice runs in Docker. The `onlyoffice-community-server` container exposes ports 80 and 443 directly.

### 2a. Locate the OnlyOffice installation

DigitalOcean one-click installs do not always leave a `docker-compose.yml` in an obvious place. Run these commands on the CRM droplet to identify the real layout. For a consolidated copy-paste version, see **Appendix A**.

**1. Confirm Docker is running and list OnlyOffice containers:**

```bash
sudo docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
sudo docker ps --filter name=onlyoffice --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

Look for containers named like `onlyoffice-community-server`, `onlyoffice-document-server`, `onlyoffice-mail-server`, or similar.

**2. Search for Docker Compose files:**

```bash
sudo find / -name "docker-compose*.yml" 2>/dev/null
sudo find / -name "docker-compose*.yaml" 2>/dev/null
sudo grep -Ril "communityserver" /root /opt /var /etc /usr/share 2>/dev/null | head -20
```

**3. Check common install directories and scripts:**

```bash
ls -la /root/onlyoffice /opt/onlyoffice /var/onlyoffice /usr/share/onlyoffice /etc/onlyoffice 2>/dev/null
ls -la /root/*.sh /opt/digitalocean /var/lib/cloud 2>/dev/null
sudo ls -la /etc/systemd/system/ | grep -i onlyoffice
sudo snap list 2>/dev/null | grep -i onlyoffice
sudo dpkg -l | grep -i onlyoffice
```

**4. Inspect the running container directly:**

If you found the community-server container name (e.g. `onlyoffice-community-server`), inspect its environment and mounts:

```bash
CONTAINER="onlyoffice-community-server"  # replace if your container name differs
sudo docker inspect "$CONTAINER" --format='{{range .Config.Env}}{{.}}\n{{end}}'
sudo docker inspect "$CONTAINER" --format='{{range .Mounts}}{{printf "%s -> %s\n" .Source .Destination}}{{end}}'
sudo docker logs --tail 50 "$CONTAINER"
```

Look especially for `LETS_ENCRYPT_DOMAIN`, `LETS_ENCRYPT_MAIL`, `MYSQL_SERVER_ROOT_PASSWORD`, and volume mounts that point to config/data directories.

**5. Determine how TLS is handled:**

```bash
sudo ss -tlnp | grep -E ':80|:443'
sudo nginx -T 2>/dev/null | head -50
sudo ls -la /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
sudo ls -la /etc/letsencrypt/live/ 2>/dev/null
```

If ports 80/443 are bound by a host nginx process, the container may not be doing its own TLS. If the container binds 80/443 directly, OnlyOffice is handling TLS itself.

**6. Save the current run command (if not using Compose):**

If the container was started with `docker run` instead of Compose, reconstruct the command before changing anything:

```bash
CONTAINER="onlyoffice-community-server"
sudo docker inspect "$CONTAINER" --format='{{.Name}}\n{{range .Config.Env}}-e {{.}} {{end}}\n{{range .HostConfig.Binds}}-v {{.}} {{end}}\n-p {{range $p, $conf := .NetworkSettings.Ports}}{{range $conf}}{{if .HostIp}}{{.HostIp}}:{{end}}{{.HostPort}}:{{$p}} {{end}}{{end}}\n{{.Config.Image}}'
```

Copy this output to a safe place. You will need it to recreate the container with the new domain.

Once you know the installation type, choose the matching section below:
- **Docker Compose found:** continue with 2b–2d.
- **Docker run only (no Compose):** skip 2b and use the run command from step 6; see the note in 2c and 2d.
- **Package / snap install:** the paths will differ; update the portal domain via the CRM web UI (section 2e) and the system’s reverse proxy / certificate tooling.

### 2b. Back up current config

```bash
cd /root/onlyoffice
cp docker-compose.yml docker-compose.yml.$(date +%Y%m%d).bak
```

If no Compose file exists, your effective backup is the volume backup in section 2d.

### 2c. Update environment variables

**Docker Compose path:**

Edit `docker-compose.yml` (or `.env` if it exists):

```bash
nano docker-compose.yml
```

For the `onlyoffice-community-server` service, update or add:

```yaml
environment:
  - LETS_ENCRYPT_DOMAIN=office.publicadjustermidwest.com
  - LETS_ENCRYPT_MAIL=admin@publicadjustermidwest.com
  # if these already exist, replace the old domain/email
```

Also look for any existing `office.vanguardadj.com` references in the file and replace them with `office.publicadjustermidwest.com`.

**Docker run path (no Compose file):**

If the container was started with `docker run`, you must stop and recreate it with the new `-e` values. Use the reconstructed command from step 6 in 2a, replacing:

```text
-e LETS_ENCRYPT_DOMAIN=office.vanguardadj.com
-e LETS_ENCRYPT_MAIL=admin@vanguardadj.com
```

with:

```text
-e LETS_ENCRYPT_DOMAIN=office.publicadjustermidwest.com
-e LETS_ENCRYPT_MAIL=admin@publicadjustermidwest.com
```

Do not run `docker run` yet — back up volumes first (section 2d).

### 2d. Back up and restart OnlyOffice

Before restarting, back up the persistent volumes. The exact paths come from the mount list in 2a step 4.

```bash
# Example: adjust source paths to match your `docker inspect` output
sudo rsync -aP /var/www/onlyoffice/Data /root/onlyoffice-backup-$(date +%Y%m%d)-Data
sudo rsync -aP /var/lib/onlyoffice /root/onlyoffice-backup-$(date +%Y%m%d)-lib
# add other mounted host directories as needed
```

**Docker Compose path:**

```bash
cd /root/onlyoffice  # or wherever docker-compose.yml lives
docker compose down
docker compose up -d
```

**Docker run path:**

```bash
CONTAINER="onlyoffice-community-server"
docker stop "$CONTAINER"
docker rm "$CONTAINER"
# paste the edited docker run command from 2c here
```

> **Important:** If the container uses Let's Encrypt, the new domain must already resolve to this droplet **before** the container starts, or certificate issuance will fail. Confirm DNS propagation first with `dig +short office.publicadjustermidwest.com A @8.8.8.8`.

After restart, verify the container is healthy and that the new env vars took effect:

```bash
docker ps --filter name=onlyoffice-community-server
docker exec onlyoffice-community-server env | grep -E 'LETS_ENCRYPT|DOMAIN'
```

### 2e. Update the portal domain in OnlyOffice settings

After DNS propagates and the container restarts, log into the CRM at:

```text
https://office.publicadjustermidwest.com
```

Go to **Settings → Customization → Domain** and set the portal address to `https://office.publicadjustermidwest.com`.

Alternatively, use the API:

```bash
curl -X PUT \
  https://office.publicadjustermidwest.com/api/2.0/settings/companywhitelabel.json \
  -H "Content-Type: application/json" \
  -H "Authorization: <ADMIN_TOKEN>" \
  -d '{"domain":"office.publicadjustermidwest.com"}'
```

### 2f. Verify CRM

```bash
curl -sI https://office.publicadjustermidwest.com/
curl -s https://office.publicadjustermidwest.com/api/2.0/authentication.json | head -c 200
```

---

## 3. Dashboard Droplet (`159.89.229.126`)

> **Production context (pre-2026-07):** On this droplet, ports 80/443 for the dashboard were handled by the `estimate-nginx` Docker container. As of 2026-07 the dashboard domain is served directly by the host's nginx (systemd site file `/etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com`). See `docs/DASHBOARD_INFRASTRUCTURE.md` (2026-07 section) and `docs/PRODUCTION_SERVER_NOTES.txt` for the current layout.
>
> - Current authoritative nginx file: `/etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com`
> - Historical (old world): `/opt/estimate-enhancer/nginx.conf` + `estimate-nginx`
> - Dashboard app container: `vanguard-crm-dashboard` (127.0.0.1:8765)
> - Dashboard app path: `/opt/vanguard/onlyoffice-crm-kanban`
> - Certificates on host: `/etc/letsencrypt/live/dashboard.publicadjustermidwest.com/` (used by host nginx)

### 3a. Back up the current nginx config for the domain

As of 2026-07 the authoritative file is the **host** site:

```bash
sudo cp /etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com \
  /etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com.$(date +%Y%m%d).bak
```

(If you are following the old cutover steps from before the sherwood-toolbox change, you would have backed up `/opt/estimate-enhancer/nginx.conf` instead.)

### 3b. Update the nginx config for the new domain (host nginx world)

Edit the **host** site file `/etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com`.

In the existing `dashboard.vanguardadj.com` (or placeholder) server blocks, change:

- `server_name ...` → `server_name dashboard.publicadjustermidwest.com`
- Certificate paths:
  - `ssl_certificate /etc/letsencrypt/live/dashboard.publicadjustermidwest.com/fullchain.pem;`
  - `ssl_certificate_key /etc/letsencrypt/live/dashboard.publicadjustermidwest.com/privkey.pem;`
- Keep `proxy_pass http://127.0.0.1:8765;` (or the equivalent for the container binding at the time).
- Ensure the three upload/timeout lines are present inside the https server block:

```nginx
client_max_body_size 100m;
proxy_request_buffering off;
proxy_read_timeout 120s;
```

- Ensure the HTTP server block still serves the ACME webroot:

```nginx
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

Then reload the host nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3c. Generate the new SSL certificate

Run certbot on the **host** (certbot --nginx must not be used because nginx runs inside Docker):

```bash
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d dashboard.publicadjustermidwest.com
```

Verify the new cert files exist:

```bash
sudo ls -la /etc/letsencrypt/live/dashboard.publicadjustermidwest.com/
```

### 3d. Reload nginx inside the container

```bash
docker exec estimate-nginx nginx -t
docker exec estimate-nginx nginx -s reload
```

### 3e. Verify the dashboard responds

```bash
curl -sI https://dashboard.publicadjustermidwest.com/
```

If the dashboard app container is not yet rebuilt with the new config, you may still see a 502/Bad Gateway at this point. That is fixed in section 4.

---

## 4. Dashboard Config & Container Changes

On the dashboard droplet, in the project directory (`/opt/vanguard/onlyoffice-crm-kanban`).

> **No git code changes are required.** The dashboard reads the CRM portal URL from `.env`. This section covers four server-side changes:
> 1. Update `nginx` config for the new domain (section 3).
> 2. Generate a new SSL certificate for `dashboard.publicadjustermidwest.com` (section 3).
> 3. Copy existing user data from the old portal key to the new portal key (4a).
> 4. Update `.env` with the new CRM URL and rebuild the container (4b–4c).

### 4a. Migrate user data

Profiles and caches are keyed by CRM portal URL. Copy from old portal to new. Some directories may not exist if the feature has never been used; skip any that are missing.

```bash
cd /opt/vanguard/onlyoffice-crm-kanban/data

for DIR in user-profiles dashboard-notes user-presence presence-messages notifications; do
  if [ -d "$DIR/office.vanguardadj.com" ]; then
    cp -a "$DIR/office.vanguardadj.com" "$DIR/office.publicadjustermidwest.com"
    echo "Migrated $DIR"
  else
    echo "Skipped $DIR (not present)"
  fi
done
```

If you prefer individual commands:

```bash
cp -a user-profiles/office.vanguardadj.com user-profiles/office.publicadjustermidwest.com
cp -a user-presence/office.vanguardadj.com user-presence/office.publicadjustermidwest.com
cp -a dashboard-notes/office.vanguardadj.com dashboard-notes/office.publicadjustermidwest.com 2>/dev/null || true
cp -a presence-messages/office.vanguardadj.com presence-messages/office.publicadjustermidwest.com
cp -a notifications/office.vanguardadj.com notifications/office.publicadjustermidwest.com 2>/dev/null || true
```

### 4b. Update config files

Edit `/opt/vanguard/onlyoffice-crm-kanban/.env`:

```bash
ONLYOFFICE_PORTAL_URL=https://office.publicadjustermidwest.com
PORT=8765
ONLYOFFICE_SSL_VERIFY=true
COOKIE_SECURE=true
```

> `COOKIE_SECURE=true` is required in production because the dashboard is served over HTTPS.

### 4c. Rebuild and restart

```bash
cd /opt/vanguard/onlyoffice-crm-kanban
git pull
docker compose up -d --build
```

Verify the container is running:

```bash
docker compose ps
docker logs --tail 50 vanguard-crm-dashboard
```

---

## 5. Final Verification

After both droplets are updated:

```bash
# Dashboard config returns the new portal URL
curl -s https://dashboard.publicadjustermidwest.com/api/config
# Expect JSON containing: "portalUrl": "https://office.publicadjustermidwest.com"

# Both endpoints respond over HTTPS
curl -sI https://office.publicadjustermidwest.com/
curl -sI https://dashboard.publicadjustermidwest.com/

# Dashboard can reach the CRM proxy
curl -s https://dashboard.publicadjustermidwest.com/api/proxy/2.0/crm/opportunity/filter.json | head -c 200
```

Then open `https://dashboard.publicadjustermidwest.com` in a browser and test login. Users may need to clear cookies for the old domain or do a hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`).

---

## 6. Post-Cutover Cleanup

Once everything is verified and you are ready to decommission the old domains:

1. **Remove old DNS records** at Bluehost for:
   - `office.vanguardadj.com`
   - `dashboard.vanguardadj.com`

2. **Delete old data** (after a few days of confirmed stability):

```bash
cd /opt/vanguard/onlyoffice-crm-kanban/data
rm -rf user-profiles/office.vanguardadj.com
rm -rf user-presence/office.vanguardadj.com
rm -rf dashboard-notes/office.vanguardadj.com
rm -rf presence-messages/office.vanguardadj.com
rm -rf notifications/office.vanguardadj.com
```

3. **Renewal check:** Certbot timers are already present on both droplets. Verify auto-renewal works with:

```bash
sudo certbot renew --dry-run
```

Run this on each droplet where you issued certificates.

---

## Appendix A: Copy-paste CRM server discovery commands

Run these as `root` on the CRM droplet (`68.183.130.39`). You can copy the entire block and paste it into one SSH session.

### A.1 Initial discovery

```bash
echo "=== Docker status ==="
sudo docker info 2>&1 | head -5
echo ""
echo "=== Running containers ==="
sudo docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "=== OnlyOffice containers ==="
sudo docker ps --filter name=onlyoffice --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "=== Compose files ==="
sudo find / -maxdepth 5 -name "docker-compose*.yml" 2>/dev/null
sudo find / -maxdepth 5 -name "docker-compose*.yaml" 2>/dev/null
echo ""
echo "=== Files mentioning communityserver ==="
sudo grep -Ril "communityserver" /root /opt /var /etc /usr/share 2>/dev/null | head -20
echo ""
echo "=== Common install dirs ==="
ls -la /root/onlyoffice /opt/onlyoffice /var/onlyoffice /usr/share/onlyoffice /etc/onlyoffice 2>/dev/null
echo ""
echo "=== DigitalOcean / cloud-init artifacts ==="
ls -la /root/*.sh /opt/digitalocean /var/lib/cloud 2>/dev/null
echo ""
echo "=== Systemd / packages ==="
sudo ls -la /etc/systemd/system/ | grep -i onlyoffice
sudo snap list 2>/dev/null | grep -i onlyoffice
sudo dpkg -l | grep -i onlyoffice
echo ""
echo "=== Ports and host nginx ==="
sudo ss -tlnp | grep -E ':80|:443'
sudo nginx -T 2>/dev/null | head -50
sudo ls -la /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
sudo ls -la /etc/letsencrypt/live/ 2>/dev/null
```

### A.2 Detailed container inspection

If the previous block shows `onlyoffice-community-server` running and no Compose file, run this to capture how it was created:

```bash
echo "=== Install scripts ==="
cat /root/install_workspace.sh
echo ""
echo "=== workspace-install.sh ==="
cat /root/workspace-install.sh
echo ""
echo "=== Community server env vars ==="
docker inspect onlyoffice-community-server --format='{{range .Config.Env}}{{.}}{{"\n"}}{{end}}'
echo ""
echo "=== Community server mounts ==="
docker inspect onlyoffice-community-server --format='{{range .Mounts}}{{printf "%s -> %s\n" .Source .Destination}}{{end}}'
echo ""
echo "=== Network and restart policy ==="
docker inspect onlyoffice-community-server --format='Networks: {{range $n, $v := .NetworkSettings.Networks}}{{$n}} {{end}}'
docker inspect onlyoffice-community-server --format='RestartPolicy: {{.HostConfig.RestartPolicy.Name}} (MaximumRetryCount: {{.HostConfig.RestartPolicy.MaximumRetryCount}})'
docker inspect onlyoffice-community-server --format='Privileged: {{.HostConfig.Privileged}}'
echo ""
echo "=== Reconstructed run command ==="
python3 - <<'PY'
import json, subprocess, shlex
out = subprocess.check_output(["docker", "inspect", "onlyoffice-community-server"])
data = json.loads(out)[0]
c = data["Config"]
hc = data["HostConfig"]
ns = data["NetworkSettings"]

parts = ["docker run -d"]
name = data["Name"].lstrip("/")
parts.append("--name " + name)

for e in c.get("Env", []):
    parts.append("-e " + shlex.quote(e))

# Bind mounts
for bind in hc.get("Binds") or []:
    parts.append("-v " + shlex.quote(bind))

# Named / tmpfs volumes (not in HostConfig.Binds)
for mount in data.get("Mounts") or []:
    if mount.get("Type") in ("volume", "tmpfs"):
        src = mount.get("Source", "")
        dst = mount.get("Destination", "")
        if src and dst:
            parts.append("-v " + shlex.quote(src + ":" + dst))

for container_port, host_binds in ns.get("Ports", {}).items():
    if host_binds:
        for bind in host_binds:
            host_ip = bind.get("HostIp", "")
            host_port = bind.get("HostPort", "")
            if host_ip and host_ip not in ("", "0.0.0.0"):
                mapping = f"{host_ip}:{host_port}:{container_port}"
            else:
                mapping = f"{host_port}:{container_port}"
            parts.append("-p " + mapping)

for net in ns.get("Networks", {}).keys():
    parts.append("--network " + net)

rp = hc.get("RestartPolicy", {})
if rp.get("Name"):
    parts.append("--restart " + rp["Name"])

if hc.get("Privileged"):
    parts.append("--privileged")

parts.append(c["Image"])
print(" \\\n    ".join(parts))
PY
echo ""
echo "=== Crontab / timers ==="
crontab -l 2>/dev/null
ls -la /etc/cron.d/ 2>/dev/null
systemctl list-timers --all 2>/dev/null | head -20
```

Save the output of A.2 to a text file. You will need the reconstructed `docker run` command to recreate the container with the new domain.

### A.3 Recreate the community-server container with the new domain

> **Prerequisites:**
> - The new DNS A record `office.publicadjustermidwest.com` → `68.183.130.39` is already added and propagated (`dig +short office.publicadjustermidwest.com A @8.8.8.8` returns `68.183.130.39`).
> - You have the reconstructed `docker run` command from A.2.
> - The original container had **no** `LETS_ENCRYPT_DOMAIN` env var; you will add it now so the entrypoint can request a certificate for the new domain.

1. Back up the persistent data and existing certificates:

```bash
# Data / certs on the host (paths come from A.2 "Community server mounts")
sudo rsync -aP /app/onlyoffice/CommunityServer/data /root/onlyoffice-backup-$(date +%Y%m%d)-data
sudo rsync -aP /app/onlyoffice/CommunityServer/letsencrypt /root/onlyoffice-backup-$(date +%Y%m%d)-letsencrypt
sudo rsync -aP /app/onlyoffice/CommunityServer/logs /root/onlyoffice-backup-$(date +%Y%m%d)-logs
sudo rsync -aP /app/onlyoffice/DocumentServer/data /root/onlyoffice-backup-$(date +%Y%m%d)-docdata
# The MySQL volume is a named Docker volume; back it up via rsync from its host path
sudo rsync -aP /var/lib/docker/volumes/64337d03d015472735e476b3877e9ded3a846bbd16d10631db9a4533bd3b6fff/_data /root/onlyoffice-backup-$(date +%Y%m%d)-mysql
```

2. Stop and remove the old container:

```bash
docker stop onlyoffice-community-server
docker rm onlyoffice-community-server
```

3. Recreate the container. Start from the reconstructed command in A.2 and make **two** changes:
   - Add `-e LETS_ENCRYPT_DOMAIN=office.publicadjustermidwest.com`
   - Add `-e LETS_ENCRYPT_MAIL=info@vanguardadj.com` (use any valid admin email — it does not need to match the new domain)

   Place these new `-e` flags near the other environment variables. Keep every existing `-e`, `-v`, `-p`, `--network`, `--restart`, and `--privileged` flag exactly as reconstructed.

   Exact command for this server (replace `info@vanguardadj.com` with any valid admin email — it does **not** have to match the new domain):

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

4. Watch the logs for certificate issuance and startup:

```bash
docker logs -f onlyoffice-community-server
```

Look for lines mentioning `certbot`, `Congratulations`, or nginx starting. Once it stabilizes, press `Ctrl+C`.

5. Verify the container is healthy and the new env vars are in place:

```bash
docker ps --filter name=onlyoffice-community-server
docker exec onlyoffice-community-server env | grep -E 'LETS_ENCRYPT|DOMAIN'
```

6. Open `https://office.publicadjustermidwest.com` in a browser. Accept/log in as an admin, then go to **Settings → Customization → Domain** and set the portal address to `https://office.publicadjustermidwest.com`.

7. Test the dashboard login at `https://dashboard.publicadjustermidwest.com` after the dashboard droplet has also been updated.
