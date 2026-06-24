#!/usr/bin/env bash
# Add ACME challenge location to OnlyOffice nginx and issue/renew the cert
# for the new CRM domain.
#
# Usage (run as root on the CRM droplet):
#   bash /root/crm-issue-cert.sh [DOMAIN] [LETS_ENCRYPT_EMAIL]
#
# Defaults:
#   DOMAIN=office.publicadjustermidwest.com
#   LETS_ENCRYPT_EMAIL=info@vanguardadj.com

set -euo pipefail

DOMAIN="${1:-office.publicadjustermidwest.com}"
EMAIL="${2:-info@vanguardadj.com}"
CONTAINER="onlyoffice-community-server"
NGINX_CONF="/etc/nginx/sites-enabled/onlyoffice"

echo "Domain: ${DOMAIN}"
echo "Container: ${CONTAINER}"

# Patch nginx to serve ACME challenges from the webroot on both HTTP and HTTPS.
if docker exec "${CONTAINER}" grep -q 'location /.well-known/acme-challenge/' "${NGINX_CONF}"; then
    echo "ACME challenge location already present in nginx config."
else
    echo "Patching nginx config for ACME challenges..."
    docker exec "${CONTAINER}" perl -i.bak -pe '
        if (/server\s*\{/) { $s++ }
        if ($s == 1 && /^\s*location\s+\/\s*\{/) {
            print "        location /.well-known/acme-challenge/ {\n";
            print "                root /var/www/onlyoffice/Data;\n";
            print "                allow all;\n";
            print "        }\n";
        }
        if ($s == 2 && /^\s*include\s+\/etc\/nginx\/includes\/onlyoffice-communityserver-/) {
            print "        location /.well-known/acme-challenge/ {\n";
            print "                root /var/www/onlyoffice/Data;\n";
            print "                allow all;\n";
            print "        }\n";
        }
    ' "${NGINX_CONF}"
    # Remove the backup so nginx does not load it as a duplicate site.
    docker exec "${CONTAINER}" rm -f "${NGINX_CONF}.bak"
fi

echo "Testing nginx configuration..."
docker exec "${CONTAINER}" nginx -t

echo "Reloading nginx..."
docker exec "${CONTAINER}" nginx -s reload

echo "Issuing/renewing certificate..."
docker exec "${CONTAINER}" certbot certonly \
    --cert-name communityserver \
    --webroot -w /var/www/onlyoffice/Data \
    -d "${DOMAIN}" \
    --force-renewal \
    --non-interactive \
    --agree-tos \
    -m "${EMAIL}"

echo "New certificate subject:"
docker exec "${CONTAINER}" openssl x509 -in /etc/letsencrypt/live/communityserver/fullchain.pem -noout -subject

echo "Done. Test with: curl -sI https://${DOMAIN}/"
