# AGENT BRIEF: Dashboard + Shared NGINX Infrastructure (historical)

**Server:** `ubuntu-webapp1-estimateanalyzer` (`159.89.229.126`)  
**Incident:** 2026-06-25 — `dashboard.publicadjustermidwest.com` served the wrong app after another web app deployment overwrote the shared nginx config.

> **Note (2026-07+):** This document describes the pre-sherwood-toolbox architecture (Docker `estimate-nginx` + `/opt/estimate-enhancer/nginx.conf`). As of 2026-07, `dashboard.publicadjustermidwest.com` is served directly by the host's nginx (systemd site file `/etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com`). See `docs/DASHBOARD_INFRASTRUCTURE.md` (2026-07 section) for the current layout and required upload settings.

---

## Architecture (read before touching nginx — historical)

- Three web apps shared one public-facing nginx container: `estimate-nginx`.
- `estimate-nginx` owned host ports `80` and `443`.
- The host's `/etc/nginx` nginx service was **disabled and stopped**.
- Nginx config source-of-truth (at the time): `/opt/estimate-enhancer/nginx.conf` (mounted into the container at `/etc/nginx/conf.d/default.conf:ro`).
- The dashboard app ran in a separate Compose project at `/opt/vanguard/onlyoffice-crm-kanban` but joined the same Docker network (`estimate-enhancer_estimate-network`).

### Container/service map

| Domain | Upstream inside Docker network | Container name |
|--------|-------------------------------|----------------|
| `enhancer.sherwoodestimates.com` | `http://app:8000` | `estimate-enhancer` |
| `iwscalc.sherwoodestimates.com` | `http://iws-calculator:80` | `iws-calculator` |
| `dashboard.publicadjustermidwest.com` | `http://dashboard:8765` | `vanguard-crm-dashboard` |

### Network details

- Network name: `estimate-enhancer_estimate-network`
- Created by `/opt/estimate-enhancer/docker-compose.yml`
- Reused as external network by `/opt/vanguard/onlyoffice-crm-kanban/docker-compose.yml`
- Do not rename this network in either Compose file without updating the other.

---

## Required nginx server block

The dashboard domain must have both an HTTP (port 80) and HTTPS (port 443) `server` block in `/opt/estimate-enhancer/nginx.conf`. Without it, nginx falls back to the first server block (`enhancer.sherwoodestimates.com`) and the dashboard domain serves the wrong app.

```nginx
server {
    listen 80;
    server_name dashboard.publicadjustermidwest.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name dashboard.publicadjustermidwest.com;

    ssl_certificate /etc/letsencrypt/live/dashboard.publicadjustermidwest.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.publicadjustermidwest.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/dashboard.publicadjustermidwest.com/chain.pem;

    client_max_body_size 50M;
    proxy_request_buffering off;

    location / {
        proxy_pass http://dashboard:8765;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

---

## Safe update workflow

1. Back up the config:
   ```bash
   cp /opt/estimate-enhancer/nginx.conf /opt/estimate-enhancer/nginx.conf.bak.$(date +%Y%m%d%H%M%S)
   ```

2. Edit `/opt/estimate-enhancer/nginx.conf` on the host. Preserve the dashboard server blocks.

3. Validate:
   ```bash
   sudo docker exec estimate-nginx nginx -t
   ```

4. Reload:
   ```bash
   sudo docker exec estimate-nginx nginx -s reload
   ```

5. Verify all three domains:
   ```bash
   curl -sI https://enhancer.sherwoodestimates.com/ | head -1
   curl -sI https://iwscalc.sherwoodestimates.com/ | head -1
   curl -sI https://dashboard.publicadjustermidwest.com/ | head -1
   ```

---

## Hard constraints

- Do not overwrite `/opt/estimate-enhancer/nginx.conf` blindly.
- Do not edit nginx config inside the running `estimate-nginx` container (mounted read-only; changes lost on restart).
- Do not change Docker network names without updating both Compose files.
- Do not enable or start the host `/etc/nginx` service.

---

## Full reference

`docs/DASHBOARD_INFRASTRUCTURE.md` in the CRM Kanban repository contains the complete production infrastructure guide.
