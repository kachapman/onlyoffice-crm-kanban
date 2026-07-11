# CRM Droplet Research Summary (2026-07-11)

## Key facts from live run (root@office)

### System
- Ubuntu 22.04.5 LTS, 4 vCPU, x86_64
- RAM: 7.8 GiB total
  - Used: 4.7 GiB (64%)
  - Free: ~225-382 MiB
  - Available: ~2.3 GiB
  - Buff/cache: ~2.7-2.9 GiB
- Swap: 6 GiB total, 1.3 GiB used (22%)
- Root disk: 233 GiB, 57% used (133 GiB used, 100 GiB free)

### Docker stack (OnlyOffice Workspace)
Only 5 containers, all from the official onlyoffice images:

1. **onlyoffice-community-server** (onlyoffice/communityserver:12.7.1.1942)
   - Main app + nginx inside
   - Ports published: 80→80, 443→443, 5222→5222 (plus several internal)
   - Memory: ~2.8 GiB (36%)

2. onlyoffice-document-server (9.3.1.2) — ~0.54 GiB
3. onlyoffice-control-panel (3.5.4.541) — ~65 MiB
4. onlyoffice-elasticsearch (7.16.3) — 1.66 GiB (21%)
5. onlyoffice-mysql-server (mysql:8.0.29) — ~0.43 GiB

**Total OnlyOffice memory footprint ≈ 5.5 GiB**

### Networking
- `onlyoffice` bridge network (172.18.0.0/16) — used by all 5 OnlyOffice containers
- `onlyoffice_default` (172.19.0.0/16)
- Standard docker bridge + host + null
- Community server is reachable inside the `onlyoffice` network by container name `onlyoffice-community-server`

### Nginx
- **No nginx on the host** (`nginx` command not found, no `/etc/nginx/sites-enabled`)
- Nginx runs **inside** the community-server container
- On container startup it does:
  - `mv /app/config/nginx/prepare-onlyoffice /etc/nginx/sites-enabled/onlyoffice`
  - `service nginx stop` then later the systemd entry starts it
- Host 80/443 traffic arrives via docker-proxy → community-server container

### Volumes & Data
- Community server data: `/var/www/onlyoffice/Data` (often sourced from `/app/onlyoffice/CommunityServer/data` or a named volume)
- Many other anonymous volumes (normal for OnlyOffice one-click)
- One named volume `crm-kanban_dashboard-data` appeared in the list (leftover or mounted from previous dashboard-related work)

### Current services
- No scanner, no extra mail-bot, no other user services running
- Only the 5 OnlyOffice containers

### Headroom for new scanner service
- ~2.3 GiB RAM available before swap pressure
- Safe target for scanner container + sentence-transformers/all-MiniLM-L6-v2 + small head: **< 600 MiB**
- Easily fits alongside the existing stack

### Next research needed (mail API signals)
The system/container research is complete.  
The remaining research is **inside the CRM API** (run as the bot user) to discover:
- Whether `/api/2.0/mail/conversations.json` and `/api/2.0/mail/messages/{id}.json` contain `to`, `cc`, `account`, `accountId`, `folder`, `folderId`, `mailbox`, or `recipients` fields that can be used for reliable "record vs action" inbox detection.
- How mail tags (including the "Bot Review" tag the scanner applies) appear on conversation objects.
- The numeric ID of the history category whose title is "Email" (or "Mail").

See the script `/tmp/crm_mail_api_research.sh` (or the one I gave earlier) for the exact curl + python commands to run as the bot.

This summary can be used directly when writing the scanner service Dockerfile and compose addition.