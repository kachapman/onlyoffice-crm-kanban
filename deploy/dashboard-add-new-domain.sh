#!/usr/bin/env bash
# Add dashboard.publicadjustermidwest.com server blocks to estimate-nginx,
# issue a Let's Encrypt certificate, and reload nginx.
#
# Usage (run as root on the dashboard droplet):
#   bash /root/dashboard-add-new-domain.sh

set -euo pipefail

CONF="/opt/estimate-enhancer/nginx.conf"
OLD_DOMAIN="dashboard.vanguardadj.com"
NEW_DOMAIN="dashboard.publicadjustermidwest.com"
NEW_CERT_DIR="/etc/letsencrypt/live/dashboard.publicadjustermidwest.com"

echo "Config file: ${CONF}"
echo "New domain:  ${NEW_DOMAIN}"

if [ ! -f "${CONF}" ]; then
    echo "ERROR: ${CONF} not found." >&2
    exit 1
fi

if grep -q "server_name ${NEW_DOMAIN};" "${CONF}"; then
    echo "New domain block already present. Skipping append."
else
    echo "Appending new server blocks for ${NEW_DOMAIN}..."

    python3 - "${CONF}" "${OLD_DOMAIN}" "${NEW_DOMAIN}" <<'PY'
import sys

conf_path = sys.argv[1]
old_domain = sys.argv[2]
new_domain = sys.argv[3]

with open(conf_path) as f:
    content = f.read()

# Extract top-level server blocks by brace counting
blocks = []
depth = 0
start = None
i = 0
n = len(content)
while i < n:
    if content[i:i+8] == "server {":
        start = i
        depth = 1
        i += 8
    elif start is not None:
        if content[i] == "{":
            depth += 1
        elif content[i] == "}":
            depth -= 1
            if depth == 0:
                blocks.append(content[start:i+1])
                start = None
        i += 1
    else:
        i += 1

http_block = None
https_block = None
for block in blocks:
    if f"server_name {old_domain};" in block:
        if "listen 443" in block:
            https_block = block
        elif "listen 80" in block:
            http_block = block

if not http_block or not https_block:
    print("ERROR: Could not find both HTTP and HTTPS blocks for " + old_domain, file=sys.stderr)
    sys.exit(1)

new_http = http_block.replace(old_domain, new_domain)
new_https = https_block.replace(old_domain, new_domain)
new_https = new_https.replace(
    "/etc/letsencrypt/live/dashboard.vanguardadj.com/",
    "/etc/letsencrypt/live/dashboard.publicadjustermidwest.com/"
)

with open(conf_path, "a") as f:
    f.write("\n")
    f.write(new_http)
    f.write("\n")
    f.write(new_https)
    f.write("\n")

print("Appended new server blocks.")
PY
fi

echo "Testing nginx configuration before certbot..."
docker exec estimate-nginx nginx -t

echo "Reloading nginx with new config..."
docker exec estimate-nginx nginx -s reload

echo "Issuing certificate for ${NEW_DOMAIN}..."
mkdir -p /var/www/certbot
certbot certonly \
    --webroot -w /var/www/certbot \
    -d "${NEW_DOMAIN}" \
    --non-interactive \
    --agree-tos \
    -m info@vanguardadj.com

echo "Certificate subject:"
openssl x509 -in "${NEW_CERT_DIR}/fullchain.pem" -noout -subject -dates

echo "Reloading nginx to pick up new certificate..."
docker exec estimate-nginx nginx -s reload

echo "Done. Test with: curl -sI https://${NEW_DOMAIN}/"
