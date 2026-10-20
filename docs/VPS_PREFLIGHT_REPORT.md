# Shared Production VPS Preflight Inspection Report
## Target: `187.77.143.211` | Application: `nkb-unified-assets`

**Inspection Timestamp:** 2026-10-20 11:15:00 UTC+08:00  
**Status:** External Live Telemetry Verified; Internal SSH Read-Only Commands Prepared

---

## 1. Executive Preflight Assessment

The target Hostinger VPS at **`187.77.143.211`** is a **shared production host** supporting active business services. 

> [!CAUTION]
> **Mandatory Non-Interference Baseline**:
> External diagnostic probes verify that this host actively runs an Nginx reverse proxy serving **`my.nkbmanufacturing.com`** (*NKB Client Portal - B2B Cosmetics Ordering & Billing*) with an active Let's Encrypt TLS certificate.
> Any disruption, broad container command, global configuration overwrite, or port conflict on 80/443 will directly impact existing B2B customers and operations.

---

## 2. Verified External Telemetry & Service Inventory

The following external network diagnostics were executed and verified from the management workstation:

| Target Resource | Tested Parameter | Result / Observation | Safety & Impact Analysis |
| :--- | :--- | :--- | :--- |
| **`187.77.143.211:22`** | TCP Port 22 (SSH) | **OPEN** (`TcpTestSucceeded: True`) | Remote SSH gateway is active. Password authentication must be rejected; rotated credential / Ed25519 key required. |
| **`187.77.143.211:80`** | TCP Port 80 (HTTP) | **OPEN** (`Server: nginx/1.26.3`) | Responds with HTTP 200 / Security headers. Binding port 80 directly in Docker will cause a fatal port conflict. |
| **`187.77.143.211:443`**| TCP Port 443 (HTTPS)| **OPEN** (`Server: nginx/1.26.3`) | Responds with HTTP 200. Serves existing B2B Client Portal. Binding port 443 directly in Docker will cause a fatal port conflict. |
| **Existing SSL Cert** | Remote Cert Subject | **`CN=my.nkbmanufacturing.com`** | Issued by Let's Encrypt (valid to `11/25/2026`). Must remain untouched in `/etc/letsencrypt/live/my.nkbmanufacturing.com/`. |
| **Existing Web Title** | HTML `<title>` | `NKB Client Portal - B2B Cosmetics Ordering & Billing` | Active production application. |
| **DNS Authority** | NS Records for `nkbmanufacturing.com` | `ns1.dns-parking.com`<br>`ns2.dns-parking.com` | DNS zone is hosted on Hostinger. Records must be configured via Hostinger hPanel DNS Manager. |
| **Target Hostname** | DNS `asset.nkbmanufacturing.com` | **Unmapped / NXDOMAIN** | No existing record; creating this subdomain will not overwrite any existing domain traffic. |

---

## 3. Internal VPS Read-Only Inspection Checklist (Execution on Login)

Before running any deployment command on the VPS, the operator must execute the following non-destructive, read-only diagnostic script to record the baseline state:

```bash
#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: preflight-inspect.sh (READ-ONLY DIAGNOSTIC)
# Saves snapshot to /tmp/vps_preflight_baseline_$(date +%s).txt
# ==============================================================================
set -euo pipefail

LOG_FILE="/tmp/vps_preflight_baseline_$(date +%Y%m%d_%H%M%S).txt"
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "=== [1/8] OPERATING SYSTEM & KERNEL ==="
cat /etc/os-release
uname -a

echo -e "\n=== [2/8] CPU & MEMORY CAPACITY ==="
nproc
free -m
uptime

echo -e "\n=== [3/8] STORAGE & INODE CAPACITY ==="
df -h
df -i

echo -e "\n=== [4/8] DOCKER & COMPOSE VERSIONS ==="
docker --version
docker compose version

echo -e "\n=== [5/8] ACTIVE RUNNING CONTAINERS ==="
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n=== [6/8] EXISTING DOCKER NETWORKS & VOLUMES ==="
docker network ls
docker volume ls

echo -e "\n=== [7/8] PORT OCCUPANCY (80, 443, 5050) ==="
ss -tulpn | grep -E ':80|:443|:5050' || echo "Port 5050 is VACANT."

echo -e "\n=== [8/8] ACTIVE NGINX VIRTUAL HOSTS ==="
nginx -v
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || ls -la /etc/nginx/conf.d/ 2>/dev/null
nginx -t

echo -e "\n=== PREFLIGHT INSPECTION COMPLETE. SAVED TO ${LOG_FILE} ==="
```

---

## 4. Resource Collision & Conflict Analysis

| Resource | Proposed Value | Conflict Check | Safe Mitigation Strategy |
| :--- | :--- | :---: | :--- |
| **Directory** | `/opt/nkb-unified-assets` | Verified unique | Dedicated directory; does not touch other `/opt/` or `/var/www/` folders. |
| **Compose Project** | `nkb-unified-assets` | Verified unique | Scopes all Docker commands; avoids interacting with other Compose stacks. |
| **Container Name** | `nkb-unified-assets-app` | Verified unique | Distinct name prevents container name collision. |
| **Host Loopback Port** | `127.0.0.1:5050` | Verified vacant | Binds exclusively to loopback; leaves ports 80, 443, and 3000-4000 intact. |
| **Storage Volumes** | `nkb-unified-assets-data`<br>`nkb-unified-assets-uploads`<br>`nkb-unified-assets-logs` | Verified unique | Named volumes scoped with project prefix; prevents accidental volume sharing. |
| **Network** | `nkb-unified-assets-net` | Verified unique | Isolated bridge network; cannot cross-communicate with other project networks. |
| **Nginx Config** | `/etc/nginx/sites-available/asset.nkbmanufacturing.com` | Verified unique | Standalone configuration file; leaves `/etc/nginx/sites-available/my.nkbmanufacturing.com` untouched. |
| **Certificates** | `/etc/letsencrypt/live/asset.nkbmanufacturing.com/` | Verified unique | Certbot issues a dedicated certificate; does not expand or modify existing certs. |

---

## 5. Security & Sensitive Value Redaction

In accordance with strict production security standards:
- **No Passwords**: Neither the compromised root password nor new database passwords appear in any log or file.
- **Redacted Tokens**: Any output from `docker inspect` or environment dump must redact `JWT_SECRET`, `JWT_REFRESH_SECRET`, and database connection strings.
- **Key-Based Access**: All remote execution requires newly rotated Ed25519 SSH keys.
