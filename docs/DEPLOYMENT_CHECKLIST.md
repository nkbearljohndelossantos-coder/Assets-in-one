# Production Deployment Checklist & Action Plan
## Unified ITMS + PPE Enterprise System (`nkb-unified-assets`)

---

## 1. Pre-Deployment Actions (Administrator Approval Required)

| Task | Owner | Action Item | Verification Method | Status |
| :---: | :---: | :--- | :--- | :---: |
| **1.1** | **DNS Admin** | Add `A` record in Hostinger hPanel DNS Manager:<br>`asset.nkbmanufacturing.com` -> `187.77.143.211` (TTL 300) | `Resolve-DnsName asset.nkbmanufacturing.com` | Pending Manual Action |
| **1.2** | **Security Admin** | Rotate root VPS password / Install Ed25519 SSH Public Key to `~/.ssh/authorized_keys` | `ssh -i ~/.ssh/id_ed25519_nkb_vps root@187.77.143.211` | Pending Manual Action |
| **1.3** | **Security Admin** | Generate two 64-character random hex keys for JWT tokens: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Confirm strings are 64 characters long | Ready to Generate |
| **1.4** | **DevOps Admin** | Verify host port 5050 is available and ports 80/443 belong to Nginx | `ss -tulpn \| grep -E ':80\|:443\|:5050'` | Verified Available |

---

## 2. Server Configuration Actions (On VPS: `187.77.143.211`)

| Task | Command / Action | Purpose | Status |
| :---: | :--- | :--- | :---: |
| **2.1** | Add Nginx site file: `/etc/nginx/sites-available/asset.nkbmanufacturing.com` | Configures virtual host reverse proxy to `http://127.0.0.1:5050` | Configuration Prepared in [`HTTPS_REVERSE_PROXY.md`](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/HTTPS_REVERSE_PROXY.md) |
| **2.2** | Run `nginx -t && systemctl reload nginx` | Tests and applies Nginx routing without disrupting `my.nkbmanufacturing.com` | Ready for Execution |
| **2.3** | Run `certbot --nginx -d asset.nkbmanufacturing.com` | Issues free Let's Encrypt SSL/TLS certificate and configures HTTPS | Awaiting DNS Propagation |
| **2.4** | Create deployment directory `/opt/nkb-unified-assets` | Establishes application workspace on VPS | Ready for Execution |
| **2.5** | Place `.env` with rotated production secrets | Initializes production runtime variables | Ready for Execution |

---

## 3. Container Deployment Actions

| Task | Execution Method | Expected Output | Status |
| :---: | :--- | :--- | :---: |
| **3.1** | Run `docker compose up -d --build` or deploy via Hostinger Docker Manager | Container `nkb-unified-assets-app` created and running | Configuration Tested |
| **3.2** | Check container health status | `docker inspect --format='{{json .State.Health.Status}}' nkb-unified-assets-app` returns `"healthy"` | Ready for Verification |
| **3.3** | Test local loopback port | `curl -i http://127.0.0.1:5050/api/health` returns HTTP 200 OK | Ready for Verification |

---

## 4. Post-Deployment Verification & Handover

| Verification Item | Target Endpoint | Expected Result | Checked |
| :--- | :--- | :--- | :---: |
| **HTTP to HTTPS Redirect** | `http://asset.nkbmanufacturing.com` | HTTP 301 Redirect to `https://asset.nkbmanufacturing.com/` | [ ] |
| **SSL Certificate Validity** | `https://asset.nkbmanufacturing.com` | Valid Let's Encrypt SSL Certificate, no browser warnings | [ ] |
| **Application Health Probe** | `https://asset.nkbmanufacturing.com/api/health` | `{"success":true,"data":{"status":"UP",...}}` | [ ] |
| **Super Admin Authentication** | `https://asset.nkbmanufacturing.com/login` | Successful sign-in, token stored, redirected to Dashboard | [ ] |
| **PPE Domain Operations** | `https://asset.nkbmanufacturing.com/ppe` | KPI cards load, asset list visible, depreciation calculations active | [ ] |
| **ITMS Domain Operations** | `https://asset.nkbmanufacturing.com/assets` | Hardware registry and tickets accessible | [ ] |
| **Existing Services Integrity** | `https://my.nkbmanufacturing.com` | NKB Client Portal continues operating without interruption | [ ] |
| **Automated Daily Backups** | Verify crontab `/etc/cron.d/nkb-unified-assets` | Daily snapshot scheduled at 02:00 AM | [ ] |
