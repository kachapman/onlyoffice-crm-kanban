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

# Embedded Python helper handles block extraction and appending in two phases.
python3 - "${CONF}" "${OLD_DOMAIN}" "${NEW_DOMAIN}" "${NEW_CERT_DIR}" <<'PY'
import sys, os

conf_path = sys.argv[1]
old_domain = sys.argv[2]
new_domain = sys.argv[3]
cert_dir = sys.argv[4]

def extract_blocks(text):
    blocks = []
    depth = 0
    start = None
    i = 0
    n = len(text)
    while i < n:
        if text[i:i+8] == "server {":
            start = i
            depth = 1
            i += 8
        elif start is not None:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    blocks.append(text[start:i+1])
                    start = None
            i += 1
        else:
            i += 1
    return blocks

with open(conf_path) as f:
    content = f.read()

blocks = extract_blocks(content)

cert_exists = os.path.isdir(cert_dir)
new_http_exists = any(f"server_name {new_domain};" in b and "listen 80" in b for b in blocks)
new_https_exists = any(f"server_name {new_domain};" in b and "listen 443" in b for b in blocks)

# Recover from a broken state where HTTPS block was added before the cert existed.
if new_https_exists and not cert_exists:
    print("Removing broken HTTPS block (certificate missing)...")
    content = "".join(b for b in blocks if not (f"server_name {new_domain};" in b and "listen 443" in b))
    with open(conf_path, "w") as f:
        f.write(content)
    blocks = extract_blocks(content)
    new_https_exists = False

# Find the old dashboard blocks to use as templates.
http_template = None
https_template = None
for block in blocks:
    if f"server_name {old_domain};" in block:
        if "listen 443" in block:
            https_template = block
        elif "listen 80" in block:
            http_template = block

if not http_template or not https_template:
    print("ERROR: Could not find both HTTP and HTTPS blocks for " + old_domain, file=sys.stderr)
    sys.exit(1)

# Phase 1: append the HTTP block if missing.
if not new_http_exists:
    print("Appending HTTP block for new domain...")
    new_http = http_template.replace(old_domain, new_domain)
    with open(conf_path, "a") as f:
        f.write("\n")
        f.write(new_http)
        f.write("\n")
else:
    print("HTTP block for new domain already exists.")

# Phase 2: append HTTPS block only if cert already exists.
if not new_https_exists:
    if cert_exists:
        print("Appending HTTPS block for new domain...")
        new_https = https_template.replace(old_domain, new_domain).replace(
            "/etc/letsencrypt/live/dashboard.vanguardadj.com/",
            "/etc/letsencrypt/live/dashboard.publicadjustermidwest.com/"
        )
        with open(conf_path, "a") as f:
            f.write("\n")
            f.write(new_https)
            f.write("\n")
    else:
        print("Certificate not yet present; HTTPS block will be added after certbot runs.")
PY

echo "Reloading nginx with HTTP block (cert not required yet)..."
docker exec estimate-nginx nginx -t
docker exec estimate-nginx nginx -s reload

if [ ! -d "${NEW_CERT_DIR}" ]; then
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

    # Phase 2: now that cert exists, add the HTTPS block.
    python3 - "${CONF}" "${OLD_DOMAIN}" "${NEW_DOMAIN}" "${NEW_CERT_DIR}" <<'PY'
import sys, os

conf_path = sys.argv[1]
old_domain = sys.argv[2]
new_domain = sys.argv[3]
cert_dir = sys.argv[4]

def extract_blocks(text):
    blocks = []
    depth = 0
    start = None
    i = 0
    n = len(text)
    while i < n:
        if text[i:i+8] == "server {":
            start = i
            depth = 1
            i += 8
        elif start is not None:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    blocks.append(text[start:i+1])
                    start = None
            i += 1
        else:
            i += 1
    return blocks

with open(conf_path) as f:
    content = f.read()
blocks = extract_blocks(content)

cert_exists = os.path.isdir(cert_dir)
new_https_exists = any(f"server_name {new_domain};" in b and "listen 443" in b for b in blocks)

if not new_https_exists and cert_exists:
    https_template = None
    for block in blocks:
        if f"server_name {old_domain};" in block and "listen 443" in block:
            https_template = block
            break
    if not https_template:
        print("ERROR: Could not find HTTPS template block", file=sys.stderr)
        sys.exit(1)
    print("Appending HTTPS block for new domain...")
    new_https = https_template.replace(old_domain, new_domain).replace(
        "/etc/letsencrypt/live/dashboard.vanguardadj.com/",
        "/etc/letsencrypt/live/dashboard.publicadjustermidwest.com/"
    )
    with open(conf_path, "a") as f:
        f.write("\n")
        f.write(new_https)
        f.write("\n")
elif new_https_exists:
    print("HTTPS block for new domain already exists.")
PY
fi

echo "Final nginx test and reload..."
docker exec estimate-nginx nginx -t
docker exec estimate-nginx nginx -s reload

echo "Done. Test with: curl -sI https://${NEW_DOMAIN}/"
