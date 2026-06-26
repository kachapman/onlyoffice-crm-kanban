# Dashboard Infrastructure & NGINX Reference

**Last updated:** 2026-06-25  
**Applies to:** Production server `ubuntu-webapp1-estimateanalyzer` (`159.89.229.126`)

## Purpose

This document exists so future code agents (and humans) understand how the CRM Kanban Dashboard (`dashboard.publicadjustermidwest.com`) is wired into the shared production server. **Always consult this before modifying nginx, Docker Compose, or the other web apps on this host.** Failure to do so will break the dashboard routing again.

---

## High-level architecture

The server runs **multiple web apps** via Docker Compose. All public traffic enters through a single nginx container (`estimate-nginx`) that proxies to the correct backend container based on `server_name`.

```
Internet
   │
   ▼
ports 80/443 on host
   │
   ▼
┌─────────────────────────────────────┐
│  estimate-nginx (nginx:alpine)      │
│  /opt/estimate-enhancer/nginx.conf  │
│  ports: 80:80, 443:443              │
└─────────────────────────────────────┘
   │
   ├──► app:8000                  estimate-enhancer  → enhancer.sherwoodestimates.com
   ├──► iws-calculator:80         IWS Calculator     → iwscalc.sherwoodestimates.com
   └──► dashboard:8765            CRM Kanban Dashboard → dashboard.publicadjustermidwest.com
```

### Critical facts

1. **The host nginx service is STOPPED.** Public traffic is handled by the Docker nginx container, not by `/etc/nginx`.
2. **The nginx config lives on the host at** `/opt/estimate-enhancer/nginx.conf` and is mounted read-only into the container at `/etc/nginx/conf.d/default.conf`.
3. **The dashboard lives in a separate Compose project** (`/opt/vanguard/onlyoffice-crm-kanban/docker-compose.yml`) but is attached to the **same Docker network** as the estimate-enhancer project (`estimate-enhancer_estimate-network`).
4. **The dashboard container exposes port `8765`** and is reachable from nginx by the Docker Compose **service name** `dashboard` (or container name `vanguard-crm-dashboard`).

---

## Compose projects

### 1. Estimate Enhancer (reverse proxy + apps)

Path: `/opt/estimate-enhancer/docker-compose.yml`

```yaml
services:
  app:
    container_name: estimate-enhancer
    networks: [estimate-network]

  iws-calculator:
    container_name: iws-calculator
    networks: [estimate-network]

  nginx:
    container_name: estimate-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
      # static/upload mounts for estimate-enhancer
    networks: [estimate-network]

networks:
  estimate-network:
    driver: bridge
```

### 2. CRM Kanban Dashboard

Path: `/opt/vanguard/onlyoffice-crm-kanban/docker-compose.yml`

```yaml
services:
  dashboard:
    container_name: vanguard-crm-dashboard
    ports:
      - "127.0.0.1:8765:8765"   # bound to loopback only; external traffic uses nginx proxy
    networks:
      - estimate-network

networks:
  estimate-network:
    external: true
    name: estimate-enhancer_estimate-network
```

### Why this matters

Because the dashboard's Compose file declares `estimate-network` as an **external** network, it joins the same network namespace as the estimate-enhancer services. This is why nginx can proxy to `http://dashboard:8765` even though the projects are in different directories.

**Do NOT change the network name** in either file without updating the other.

---

## NGINX config location & reload

| File | Purpose |
|------|---------|
| `/opt/estimate-enhancer/nginx.conf` | Source-of-truth nginx config on the host |
| `/etc/nginx/conf.d/default.conf` (inside `estimate-nginx` container) | Read-only mount of the above |

### How to edit

Edit `/opt/estimate-enhancer/nginx.conf` on the host, then reload the container:

```bash
# Validate
sudo docker exec estimate-nginx nginx -t

# Reload
sudo docker exec estimate-nginx nginx -s reload
```

**Never edit the file inside the running container** — it is mounted read-only and the change would be lost on restart.

---

## Dashboard nginx server block

The following blocks must exist in `/opt/estimate-enhancer/nginx.conf` for the dashboard to work. They live alongside the existing `enhancer.sherwoodestimates.com` and `iwscalc.sherwoodestimates.com` blocks.

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

### Why these settings

- `client_max_body_size 50M` — required for file uploads (attachments on event notes).
- `proxy_request_buffering off` — prevents nginx from buffering large uploads before forwarding them to the dashboard proxy.
- `proxy_pass http://dashboard:8765` — uses the Docker Compose service name; resolves inside the shared `estimate-network`.

---

## Certificates

All certificates are managed by Certbot and mounted into the nginx container at `/etc/letsencrypt`.

| Domain | Certificate path | Managed by |
|--------|------------------|------------|
| `dashboard.publicadjustermidwest.com` | `/etc/letsencrypt/live/dashboard.publicadjustermidwest.com/` | Certbot |
| `dashboard.vanguardadj.com` | `/etc/letsencrypt/live/dashboard.vanguardadj.com/` | Certbot |
| `enhancer.sherwoodestimates.com` | `/etc/letsencrypt/live/enhancer.sherwoodestimates.com/` | Certbot |
| `iwscalc.sherwoodestimates.com` | same as above (SAN) | Certbot |

The host nginx config at `/etc/nginx/sites-enabled/dashboard.vanguardadj.com` is **not active** because the host nginx service is disabled. It is legacy and can be ignored unless the host nginx is intentionally re-enabled.

---

## Common failure mode (2026-06-25 incident)

**Symptom:** `dashboard.publicadjustermidwest.com` serves the wrong app or shows "not secure."

**Root cause:** The dashboard `server_name` block was missing from `/opt/estimate-enhancer/nginx.conf`. When nginx receives a request for a `server_name` it does not recognize, it falls back to the **first server block** in the config (in this case, `enhancer.sherwoodestimates.com`), so the dashboard domain displayed the estimate-enhancer app.

**Fix:** Add the dashboard server block shown above and reload nginx.

### Lessons

- Any update to the estimate-enhancer project that regenerates or replaces `nginx.conf` must preserve the dashboard `server_name` blocks.
- If you add another app/domain, add a new `server` block — do not overwrite `default.conf` blindly.
- Always back up `/opt/estimate-enhancer/nginx.conf` before editing.

---

## Verification commands

```bash
# 1. Check nginx is using the right config
sudo docker exec estimate-nginx nginx -T | grep -E 'server_name|proxy_pass|ssl_certificate'

# 2. Test HTTPS cert
openssl s_client -connect dashboard.publicadjustermidwest.com:443 -servername dashboard.publicadjustermidwest.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer

# 3. Test HTTP → HTTPS redirect
curl -I http://dashboard.publicadjustermidwest.com/

# 4. Test dashboard response
curl -I https://dashboard.publicadjustermidwest.com/

# 5. Check dashboard container is healthy
sudo docker ps --filter name=vanguard-crm-dashboard
```

---

## Update checklist for agents

Before making any nginx/compose change on this server:

1. [ ] Read this document.
2. [ ] Back up `/opt/estimate-enhancer/nginx.conf`.
3. [ ] Validate config with `docker exec estimate-nginx nginx -t`.
4. [ ] Reload with `docker exec estimate-nginx nginx -s reload`.
5. [ ] Verify `https://dashboard.publicadjustermidwest.com/` still loads correctly.
6. [ ] Verify `https://enhancer.sherwoodestimates.com/` still loads correctly.
7. [ ] Verify `https://iwscalc.sherwoodestimates.com/` still loads correctly.
