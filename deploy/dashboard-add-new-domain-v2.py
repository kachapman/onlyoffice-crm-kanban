#!/usr/bin/env python3
"""
HISTORICAL — used for estimate-nginx / sherwood-toolbox era (pre-2026-07).
For dashboard.publicadjustermidwest.com the authoritative nginx config is now
the host site file: /etc/nginx/sites-enabled/dashboard.publicadjustermidwest.com
(client_max_body_size 100m, proxy_request_buffering off, proxy_read_timeout 120s required).

Add dashboard.publicadjustermidwest.com server blocks to estimate-nginx,
issue a Let's Encrypt certificate, and reload nginx.

Usage (run as root on the dashboard droplet):
    curl -fsSL .../dashboard-add-new-domain-v2.py | python3
"""
import os
import subprocess
import sys

CONF = "/opt/estimate-enhancer/nginx.conf"
OLD_DOMAIN = "dashboard.vanguardadj.com"
NEW_DOMAIN = "dashboard.publicadjustermidwest.com"
NEW_CERT_DIR = "/etc/letsencrypt/live/dashboard.publicadjustermidwest.com"
OLD_CERT_DIR = "/etc/letsencrypt/live/dashboard.vanguardadj.com"


def read_file(path):
    with open(path) as f:
        return f.read()


def write_file(path, content):
    with open(path, "w") as f:
        f.write(content)


def extract_blocks(text):
    """Extract top-level nginx server blocks by brace counting."""
    blocks = []
    depth = 0
    start = None
    i = 0
    n = len(text)
    while i < n:
        if text[i:i + 8] == "server {":
            start = i
            depth = 1
            i += 8
        elif start is not None:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    blocks.append(text[start:i + 1])
                    start = None
            i += 1
        else:
            i += 1
    return blocks


def find_templates(blocks):
    http_template = None
    https_template = None
    for block in blocks:
        if f"server_name {OLD_DOMAIN};" not in block:
            continue
        if "listen 443" in block or "listen 443 ssl" in block:
            https_template = block
        elif "listen 80" in block:
            http_template = block
    return http_template, https_template


def block_exists(blocks, domain, port):
    for block in blocks:
        if f"server_name {domain};" not in block:
            continue
        if port == 80 and ("listen 80" in block and "443" not in block):
            return True
        if port == 443 and ("listen 443" in block or "listen 443 ssl" in block):
            return True
    return False


def run(cmd, check=True):
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    if check and result.returncode != 0:
        sys.exit(result.returncode)
    return result


def main():
    print(f"Config file: {CONF}")
    print(f"New domain:  {NEW_DOMAIN}")

    if not os.path.isfile(CONF):
        print(f"ERROR: {CONF} not found.", file=sys.stderr)
        sys.exit(1)

    # Prefer the runbook backup (nginx.conf.YYYYMMDD.bak) created before cutover.
    conf_dir = os.path.dirname(CONF)
    runbook_backups = sorted(
        [p for p in os.listdir(conf_dir) if p.startswith("nginx.conf.") and p.endswith(".bak") and len(p) == len("nginx.conf.YYYYMMDD.bak")],
        reverse=True,
    )
    runbook_backup = os.path.join(conf_dir, runbook_backups[0]) if runbook_backups else None

    content = read_file(CONF)
    blocks = extract_blocks(content)

    cert_exists = os.path.isdir(NEW_CERT_DIR)
    new_http_exists = block_exists(blocks, NEW_DOMAIN, 80)
    new_https_exists = block_exists(blocks, NEW_DOMAIN, 443)

    # Recover from broken state: HTTPS block present but cert missing.
    if new_https_exists and not cert_exists:
        if runbook_backup and os.path.isfile(runbook_backup):
            print(f"WARNING: HTTPS block exists but certificate is missing. Restoring from {runbook_backup}")
            write_file(CONF, read_file(runbook_backup))
            content = read_file(CONF)
            blocks = extract_blocks(content)
            new_http_exists = block_exists(blocks, NEW_DOMAIN, 80)
            new_https_exists = block_exists(blocks, NEW_DOMAIN, 443)
        else:
            print("ERROR: HTTPS block exists but certificate is missing, and no runbook backup found.", file=sys.stderr)
            sys.exit(1)

    # Ensure we have our own backup from the current (clean) config.
    try:
        script_name = os.path.basename(__file__)
    except NameError:
        script_name = "dashboard-add-new-domain-v2.py"
    backup_path = f"{CONF}.{script_name}.bak"
    if not os.path.isfile(backup_path):
        write_file(backup_path, read_file(CONF))
        print(f"Created backup: {backup_path}")

    http_template, https_template = find_templates(blocks)
    if not http_template or not https_template:
        print(f"ERROR: Could not find both HTTP and HTTPS blocks for {OLD_DOMAIN}.", file=sys.stderr)
        sys.exit(1)

    changed = False

    # Phase 1: append HTTP block if missing.
    if not new_http_exists:
        print("Appending HTTP block for new domain...")
        new_http = http_template.replace(OLD_DOMAIN, NEW_DOMAIN)
        with open(CONF, "a") as f:
            f.write("\n")
            f.write(new_http)
            f.write("\n")
        changed = True
    else:
        print("HTTP block for new domain already exists.")

    if changed:
        content = read_file(CONF)
        blocks = extract_blocks(content)

    # Phase 2: if cert already exists, append HTTPS block now.
    if cert_exists and not new_https_exists:
        print("Appending HTTPS block for new domain...")
        new_https = https_template.replace(OLD_DOMAIN, NEW_DOMAIN).replace(OLD_CERT_DIR, NEW_CERT_DIR)
        with open(CONF, "a") as f:
            f.write("\n")
            f.write(new_https)
            f.write("\n")
        changed = True
    elif cert_exists:
        print("HTTPS block for new domain already exists.")

    if changed:
        print("Testing nginx configuration...")
        run(["docker", "exec", "estimate-nginx", "nginx", "-t"])
        print("Reloading nginx...")
        run(["docker", "exec", "estimate-nginx", "nginx", "-s", "reload"])

    # Phase 3: issue certificate if missing.
    if not cert_exists:
        print("Issuing certificate...")
        os.makedirs("/var/www/certbot", exist_ok=True)
        run([
            "certbot", "certonly",
            "--webroot", "-w", "/var/www/certbot",
            "-d", NEW_DOMAIN,
            "--non-interactive",
            "--agree-tos",
            "-m", "info@vanguardadj.com",
        ])
        print("Certificate subject:")
        run([
            "openssl", "x509",
            "-in", f"{NEW_CERT_DIR}/fullchain.pem",
            "-noout", "-subject", "-dates",
        ])

        # Now append HTTPS block.
        content = read_file(CONF)
        blocks = extract_blocks(content)
        if not block_exists(blocks, NEW_DOMAIN, 443):
            print("Appending HTTPS block for new domain...")
            new_https = https_template.replace(OLD_DOMAIN, NEW_DOMAIN).replace(OLD_CERT_DIR, NEW_CERT_DIR)
            with open(CONF, "a") as f:
                f.write("\n")
                f.write(new_https)
                f.write("\n")
        else:
            print("HTTPS block for new domain already exists.")

        print("Testing nginx configuration...")
        run(["docker", "exec", "estimate-nginx", "nginx", "-t"])
        print("Reloading nginx...")
        run(["docker", "exec", "estimate-nginx", "nginx", "-s", "reload"])
    else:
        print(f"Certificate already exists at {NEW_CERT_DIR}.")

    print("Final verification...")
    result = run(["curl", "-sI", f"https://{NEW_DOMAIN}/"], check=False)
    if result.returncode != 0:
        print("WARNING: curl test failed.", file=sys.stderr)
        sys.exit(1)
    print("Done.")


if __name__ == "__main__":
    main()
