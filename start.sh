#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]]; then
  # Load .env safely but do NOT overwrite vars already set in the environment.
  # This makes DB_HOST=127.0.0.1 PORT=8765 ./start.sh work for local (non-docker) runs.
  while IFS='=' read -r key value || [ -n "$key" ]; do
    key=$(echo "$key" | xargs)
    [[ -z "$key" || "$key" == \#* ]] && continue
    value=$(echo "$value" | sed -e 's/^[ \t]*//' -e 's/[ \t]*$//' -e 's/^["'"'"']//' -e 's/["'"'"']$//')
    # Only set if not already present in env (prefix overrides win)
    if [[ -z "${!key:-}" ]]; then
      export "$key=$value"
    fi
  done < .env
fi

PORT="${PORT:-8765}"
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
fi

if [[ "${DB_HOST:-}" == "db" ]]; then
  echo "Note: DB_HOST=db (from .env for docker). For local non-docker postgres: DB_HOST=127.0.0.1 $0"
fi

echo "Portal: ${ONLYOFFICE_PORTAL_URL:-<enter at login>}"
PY="python3"
if [[ -x .venv/bin/python3 ]]; then
  PY=".venv/bin/python3"
fi
exec "$PY" server.py