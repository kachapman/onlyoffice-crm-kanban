#!/usr/bin/env bash
# Finish dashboard migration to publicadjustermidwest.com:
# pull code, migrate user data (handles both domain and full-portal-URL directory names),
# update .env, rebuild container, verify.
#
# Usage (run as root on the dashboard droplet):
#   curl -fsSL .../dashboard-migrate-v2.sh | bash
#
# Override defaults for testing:
#   PROJECT_DIR=/tmp/mock OLD_DOMAIN=vanguardadj NEW_DOMAIN=publicadjustermidwest SKIP_REBUILD=1 bash dashboard-migrate-v2.sh

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/vanguard/onlyoffice-crm-kanban}"
OLD_DOMAIN="${OLD_DOMAIN:-vanguardadj}"
NEW_DOMAIN="${NEW_DOMAIN:-publicadjustermidwest}"
DASHBOARD_DOMAIN="${DASHBOARD_DOMAIN:-dashboard.publicadjustermidwest.com}"
NEW_PORTAL_URL="https://office.publicadjustermidwest.com"

cd "$PROJECT_DIR"

echo "=== Project directory: $PROJECT_DIR ==="
echo "=== Pulling latest code ==="
git pull origin main



echo "=== Migrating user data ==="

# In production, dashboard data lives in the Docker volume mounted at /app/data.
if docker ps --format '{{.Names}}' | grep -q '^vanguard-crm-dashboard$'; then
  echo "Migrating data inside vanguard-crm-dashboard container..."
  docker exec vanguard-crm-dashboard bash -c '
    old="'"${OLD_DOMAIN}"'"
    new="'"${NEW_DOMAIN}"'"
    for DIR in user-profiles user-presence dashboard-notes presence-messages; do
      for SRC in "/app/data/$DIR"/*"${old}"*; do
        [ -d "$SRC" ] || continue
        DST=$(echo "$SRC" | sed "s/${old}/${new}/g")
        if [ ! -d "$DST" ]; then
          cp -a "$SRC" "$DST"
          echo "Migrated $SRC -> $DST"
        else
          echo "Already exists: $DST"
        fi
      done
    done
  '
else
  echo "Dashboard container not running; skipping container data migration."
fi

# Fallback: also migrate data in the project directory (dev / bind-mount setups).
DATA_DIR="$PROJECT_DIR/data"
for TOP in user-profiles user-presence dashboard-notes presence-messages; do
  TOP_DIR="$DATA_DIR/$TOP"
  if [ ! -d "$TOP_DIR" ]; then
    continue
  fi
  shopt -s nullglob
  for SRC in "$TOP_DIR"/*"${OLD_DOMAIN}"*; do
    [ -d "$SRC" ] || continue
    DST=$(echo "$SRC" | sed "s/${OLD_DOMAIN}/${NEW_DOMAIN}/g")
    if [ ! -d "$DST" ]; then
      cp -a "$SRC" "$DST"
      echo "Migrated $SRC -> $DST"
    else
      echo "Already exists: $DST"
    fi
  done
  shopt -u nullglob
done

echo "=== Updating .env ==="
ENV_FILE="$PROJECT_DIR/.env"
touch "$ENV_FILE"
grep -q '^ONLYOFFICE_PORTAL_URL=' "$ENV_FILE" \
  && sed -i "s|^ONLYOFFICE_PORTAL_URL=.*|ONLYOFFICE_PORTAL_URL=${NEW_PORTAL_URL}|" "$ENV_FILE" \
  || echo "ONLYOFFICE_PORTAL_URL=${NEW_PORTAL_URL}" >> "$ENV_FILE"
grep -q '^ONLYOFFICE_SSL_VERIFY=' "$ENV_FILE" || echo 'ONLYOFFICE_SSL_VERIFY=true' >> "$ENV_FILE"
grep -q '^COOKIE_SECURE=' "$ENV_FILE" || echo 'COOKIE_SECURE=true' >> "$ENV_FILE"
grep -q '^PORT=' "$ENV_FILE" || echo 'PORT=8765' >> "$ENV_FILE"
cat "$ENV_FILE"

if [ "${SKIP_REBUILD:-0}" = "1" ]; then
  echo "=== SKIP_REBUILD=1; skipping docker rebuild ==="
  exit 0
fi

echo "=== Rebuilding dashboard container ==="
docker compose up -d --build

echo "=== Verifying /api/config ==="
sleep 5
curl -s "https://${DASHBOARD_DOMAIN}/api/config" | grep portalUrl || true

echo "=== Done ==="
