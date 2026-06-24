#!/usr/bin/env bash
# Finish dashboard migration to publicadjustermidwest.com:
# pull code, migrate user data, update .env, rebuild container, verify.
#
# Usage (run as root on the dashboard droplet):
#   curl -fsSL .../dashboard-migrate-and-rebuild.sh | bash

set -euo pipefail

PROJECT_DIR="/opt/vanguard/onlyoffice-crm-kanban"
OLD_DOMAIN="office.vanguardadj.com"
NEW_DOMAIN="office.publicadjustermidwest.com"

cd "$PROJECT_DIR"

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Migrating user data ==="
for DIR in user-profiles user-presence dashboard-notes presence-messages; do
  SRC="$PROJECT_DIR/data/$DIR/$OLD_DOMAIN"
  DST="$PROJECT_DIR/data/$DIR/$NEW_DOMAIN"
  if [ -d "$SRC" ]; then
    if [ ! -d "$DST" ]; then
      cp -a "$SRC" "$DST"
      echo "Migrated $DIR"
    else
      echo "Already migrated: $DIR"
    fi
  else
    echo "No old data to migrate: $DIR"
  fi
done

echo "=== Updating .env ==="
touch .env
grep -q '^ONLYOFFICE_PORTAL_URL=' .env \
  && sed -i "s|^ONLYOFFICE_PORTAL_URL=.*|ONLYOFFICE_PORTAL_URL=https://$NEW_DOMAIN|" .env \
  || echo "ONLYOFFICE_PORTAL_URL=https://$NEW_DOMAIN" >> .env
grep -q '^ONLYOFFICE_SSL_VERIFY=' .env || echo 'ONLYOFFICE_SSL_VERIFY=true' >> .env
grep -q '^COOKIE_SECURE=' .env || echo 'COOKIE_SECURE=true' >> .env
grep -q '^PORT=' .env || echo 'PORT=8765' >> .env
cat .env

echo "=== Rebuilding dashboard container ==="
docker compose up -d --build

echo "=== Verifying /api/config ==="
sleep 5
curl -s "https://dashboard.publicadjustermidwest.com/api/config" | grep portalUrl || true

echo "=== Done ==="
