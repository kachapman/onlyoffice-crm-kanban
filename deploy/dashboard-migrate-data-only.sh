#!/usr/bin/env bash
# Migrate dashboard user data from old to new portal directory names
# inside the Docker volume, then restart the container and verify.

set -euo pipefail

OLD_DOMAIN="vanguardadj"
NEW_DOMAIN="publicadjustermidwest"
DASHBOARD_DOMAIN="dashboard.publicadjustermidwest.com"
CONTAINER="vanguard-crm-dashboard"

echo "=== Migrating data inside $CONTAINER ==="
docker exec "$CONTAINER" bash -c '
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

echo "=== Restarting $CONTAINER ==="
docker restart "$CONTAINER"

echo "=== Waiting for app to come back ==="
sleep 5

echo "=== Verifying /api/config ==="
curl -s "https://${DASHBOARD_DOMAIN}/api/config" | grep portalUrl || true

echo "=== Done ==="
