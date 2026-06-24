#!/bin/bash
# Recreate the OnlyOffice community-server container from an inspect backup,
# patching the startup script so it does NOT shut down an external MySQL server.
#
# Usage (run as root on the CRM droplet):
#   bash /root/crm-recreate-from-inspect.sh [NEW_DOMAIN] [LETS_ENCRYPT_EMAIL]
#
# Defaults:
#   NEW_DOMAIN=office.publicadjustermidwest.com
#   LETS_ENCRYPT_EMAIL=info@vanguardadj.com

set -euo pipefail

DOMAIN="${1:-office.publicadjustermidwest.com}"
EMAIL="${2:-info@vanguardadj.com}"

INSPECT_FILE=$(ls -t /root/onlyoffice-backup-*-inspect.json 2>/dev/null | head -1)
if [ -z "${INSPECT_FILE}" ]; then
    echo "ERROR: No /root/onlyoffice-backup-*-inspect.json found." >&2
    exit 1
fi
echo "Using inspect backup: ${INSPECT_FILE}"

PATCH_SCRIPT="/root/run-community-server.sh"
echo "Extracting original /app/run-community-server.sh from image..."
docker run --rm --entrypoint cat onlyoffice/communityserver:12.7.1.1942 /app/run-community-server.sh > "${PATCH_SCRIPT}"

echo "Patching standalone 'mysqladmin shutdown' lines..."
sed -i 's/^[[:space:]]*mysqladmin shutdown[[:space:]]*$/# mysqladmin shutdown/' "${PATCH_SCRIPT}"
chmod +x "${PATCH_SCRIPT}"

if grep -qE '^[[:space:]]*mysqladmin shutdown[[:space:]]*$' "${PATCH_SCRIPT}"; then
    echo "ERROR: Patch failed; standalone mysqladmin shutdown lines remain." >&2
    exit 1
fi

echo "Generating docker run command..."
python3 - "${INSPECT_FILE}" "${PATCH_SCRIPT}" "${DOMAIN}" "${EMAIL}" <<'PY' > /tmp/recreate-onlyoffice-cmd.sh
import json, shlex, sys

inspect_file, patch_script, domain, email = sys.argv[1:5]

with open(inspect_file) as f:
    data = json.load(f)[0]

c = data["Config"]
hc = data["HostConfig"]
ns = data["NetworkSettings"]

parts = ["docker run -d"]
name = data["Name"].lstrip("/")
parts.append("--name " + name)

# Build env map from inspect, then force new domain/email env vars.
envs = {}
for e in c.get("Env", []):
    key = e.split("=", 1)[0]
    envs[key] = e

envs["LETS_ENCRYPT_DOMAIN"] = f"LETS_ENCRYPT_DOMAIN={domain}"
envs["LETS_ENCRYPT_MAIL"] = f"LETS_ENCRYPT_MAIL={email}"

for e in envs.values():
    parts.append("-e " + shlex.quote(e))

# Bind mounts from HostConfig.Binds
for bind in hc.get("Binds") or []:
    parts.append("-v " + shlex.quote(bind))

# Named / tmpfs volumes not captured in Binds
for mount in data.get("Mounts") or []:
    if mount.get("Type") in ("volume", "tmpfs"):
        src = mount.get("Source", "")
        dst = mount.get("Destination", "")
        if src and dst:
            parts.append("-v " + shlex.quote(src + ":" + dst))

# Mount the patched startup script read-only over the original
parts.append("-v " + shlex.quote(patch_script + ":/app/run-community-server.sh:ro"))

# Port mappings (force IPv4-only to avoid stale/broken IPv6 binds)
for container_port, host_binds in ns.get("Ports", {}).items():
    if host_binds:
        for bind in host_binds:
            host_port = bind.get("HostPort", "")
            mapping = f"0.0.0.0:{host_port}:{container_port}"
            parts.append("-p " + mapping)

# Networks
for net in ns.get("Networks", {}).keys():
    parts.append("--network " + net)

# Restart policy
rp = hc.get("RestartPolicy", {})
if rp.get("Name"):
    parts.append("--restart " + rp["Name"])

# Privileged
if hc.get("Privileged"):
    parts.append("--privileged")

parts.append(c["Image"])

print(" \\\n    ".join(parts))
PY

echo "Stopping/removing old community-server container..."
docker rm -f onlyoffice-community-server 2>/dev/null || true

echo "Recreating community-server container..."
bash /tmp/recreate-onlyoffice-cmd.sh

echo ""
echo "Container recreated. Waiting 60 seconds for startup..."
sleep 60

echo ""
echo "Container status:"
docker ps --filter name=onlyoffice-community-server --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "MySQL status:"
docker ps --filter name=onlyoffice-mysql-server --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "Last 10 lines of MySQL error log:"
tail -n 10 /app/onlyoffice/mysql/logs/error.log || true
