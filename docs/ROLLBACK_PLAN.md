# Emergency Rollback & Recovery Plan
## Application: `nkb-unified-assets` | Target: `https://asset.nkbmanufacturing.com`

---

## 1. Strict Rollback Boundaries & Principles

In a shared multi-application environment, an emergency rollback must never cause secondary collateral damage.

### 🛡️ Non-Negotiable Rollback Rules:
1. **Scoped Container Actions**: All container stop and removal operations must strictly target `-p nkb-unified-assets` or container `nkb-unified-assets-app`.
2. **Never Prune**: Never run `docker system prune` or `docker volume prune` during rollback.
3. **Preserve Database Volumes**: Do not delete `nkb-unified-assets-data` or `nkb-unified-assets-uploads` during software rollback. Data is retained for post-incident debugging.
4. **Isolated Nginx Rollback**: Only remove `asset.nkbmanufacturing.com`. Never restore an outdated global `/etc/nginx/` tarball over active virtual hosts.
5. **Zero Impact on Existing Services**: `my.nkbmanufacturing.com` must remain unaffected throughout the entire rollback sequence.

---

## 2. Failure Mode Playbooks

### Playbook A: Container Fails to Build or Become Healthy (Port 5050)
*Trigger: Docker build exits with error, or `curl http://127.0.0.1:5050/api/health` returns non-200.*

```bash
# 1. Stop only the failed new container
docker compose -p nkb-unified-assets stop app

# 2. Inspect failure diagnostics without removing data
docker logs --tail 100 nkb-unified-assets-app > /tmp/nkb-deploy-failure-$(date +%s).log

# 3. Confirm existing production services are untouched
docker ps --format "table {{.Names}}\t{{.Status}}"
curl -I -s https://my.nkbmanufacturing.com | head -n 3
```

---

### Playbook B: Nginx Syntax Test Fails (`nginx -t`)
*Trigger: `nginx -t` fails after adding `/etc/nginx/sites-available/asset.nkbmanufacturing.com`.*

```bash
# 1. Immediately remove the offending symlink from sites-enabled
rm -f /etc/nginx/sites-enabled/asset.nkbmanufacturing.com

# 2. Retest syntax to confirm Nginx is back in a valid state
nginx -t
# Must return: nginx: configuration file ... test is successful

# 3. Gracefully reload Nginx to restore pristine state
systemctl reload nginx

# 4. Verify existing production site
curl -I -s https://my.nkbmanufacturing.com | head -n 3
```

---

### Playbook C: Certbot SSL Certificate Generation Fails
*Trigger: Let's Encrypt cannot validate DNS or rate limit reached.*

```bash
# 1. Check if Certbot left a partial configuration in asset.nkbmanufacturing.com
# Restore clean HTTP-only template
rm -f /etc/nginx/sites-enabled/asset.nkbmanufacturing.com
rm -f /etc/nginx/sites-available/asset.nkbmanufacturing.com

# 2. Reload Nginx
nginx -t && systemctl reload nginx

# 3. Clean up any partial Certbot artifacts
certbot delete --cert-name asset.nkbmanufacturing.com 2>/dev/null || true

# 4. Investigate DNS propagation failure
dig +short asset.nkbmanufacturing.com
```

---

### Playbook D: Complete Reversion to Pre-Deployment State
*Trigger: Decision by System Administrator to abort deployment and restore pre-existing state.*

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "--> [1/4] Stopping nkb-unified-assets application..."
cd /opt/nkb-unified-assets
docker compose -p nkb-unified-assets down

echo "--> [2/4] Removing Nginx virtual host for asset.nkbmanufacturing.com..."
rm -f /etc/nginx/sites-enabled/asset.nkbmanufacturing.com
rm -f /etc/nginx/sites-available/asset.nkbmanufacturing.com

echo "--> [3/4] Validating and reloading Nginx..."
nginx -t
systemctl reload nginx

echo "--> [4/4] Verifying health of existing production services..."
curl -I -s https://my.nkbmanufacturing.com | head -n 5

echo "=== ROLLBACK TO CLEAN STATE COMPLETE ==="
```

---

## 3. Post-Rollback Verification Checklist

- [ ] `my.nkbmanufacturing.com` responds with HTTP/2 200 OK.
- [ ] Existing Docker containers are running with identical uptime.
- [ ] No ports other than 80, 443, and 22 remain open to external traffic.
- [ ] The `nkb-unified-assets-data` volume is preserved intact for data safety.
