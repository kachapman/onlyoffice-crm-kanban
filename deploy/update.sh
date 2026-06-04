#!/usr/bin/env bash
# Run on the DigitalOcean droplet inside the repo directory after git pull.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Pulling latest…"
git pull --ff-only

echo "Rebuilding and restarting…"
docker compose build --pull
docker compose up -d

echo "Done. Dashboard: https://dashboard.vanguardadj.com"