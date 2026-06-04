#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PORT="${PORT:-8765}"
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
fi

echo "Portal: ${ONLYOFFICE_PORTAL_URL:-<enter at login>}"
echo "Open:   http://127.0.0.1:${PORT}"
exec python3 server.py