# Hostinger VPS Production Deployment Guide
## Unified ITMS + PPE Enterprise System (`nkb-unified-assets`)

---

## 1. Executive Deployment Overview

- **Target Public IP**: `187.77.143.211`
- **Application Subdomain**: `asset.nkbmanufacturing.com`
- **Public URL**: `https://asset.nkbmanufacturing.com`
- **Orchestration**: Docker Compose
- **Hostinger Project Name**: `nkb-unified-assets`
- **Environment**: Production

### Critical Server Context & Port Safety
Port 80 and Port 443 on the Hostinger VPS are already actively utilized by Nginx serving **`my.nkbmanufacturing.com`** (NKB Client Portal). 
To prevent port binding collisions (`bind: address already in use`) and avoid interrupting `my.nkbmanufacturing.com`, `nkb-unified-assets` binds exclusively to the private loopback interface:
```
127.0.0.1:5050 -> 5000 (Internal Container Port)
```
The host Nginx acts as the reverse proxy, terminating SSL and routing incoming requests for `asset.nkbmanufacturing.com` directly to `http://127.0.0.1:5050`.

---

## 2. Security Prerequisites & Credential Hygiene

> [!CAUTION]
> **Compromised Credential Warning**: The initial root VPS password was shared in prior transcripts and is deemed compromised. **Never** reuse that password.
> You must generate an SSH key pair or rotate the root password before connecting.

### Step 1: Generate & Install SSH Public Key
On your local administrative machine:
```bash
# Generate high-security Ed25519 SSH key
ssh-keygen -t ed25519 -C "admin@nkbmanufacturing.com" -f ~/.ssh/id_ed25519_nkb_vps

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/id_ed25519_nkb_vps.pub root@187.77.143.211
```
Verify connectivity:
```bash
ssh -i ~/.ssh/id_ed25519_nkb_vps root@187.77.143.211
```

---

## 3. Server Inspection Checklist

Before executing any commands on the VPS, run this non-destructive diagnostic command:

```bash
# 1. Check OS and kernel
cat /etc/os-release

# 2. Check Docker and Docker Compose versions
docker --version
docker compose version

# 3. Check memory and disk space
free -h
df -h

# 4. Check existing listening ports (verify 5050 is free)
ss -tulpn | grep -E ':80|:443|:5050'

# 5. Check existing running Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## 4. Deployment Workflow

### Method A: Git Repository Deployment on VPS (Recommended)

1. **Connect to VPS & Create Application Directory**:
   ```bash
   ssh root@187.77.143.211
   mkdir -p /opt/nkb-unified-assets
   cd /opt/nkb-unified-assets
   ```

2. **Clone / Pull Project Repository**:
   ```bash
   git clone <YOUR_PRIVATE_REPO_URL> .
   # or rsync files securely from local workspace
   ```

3. **Configure Production Environment (`.env`)**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` using `nano .env`:
   ```ini
   NODE_ENV=production
   PORT=5000
   DB_CLIENT=sqlite3
   DB_FILE=/app/backend/data/nkb_unified.sqlite

   # Generate strong 64-char keys: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   JWT_SECRET=<GENERATE_STRONG_RANDOM_KEY_1>
   JWT_REFRESH_SECRET=<GENERATE_STRONG_RANDOM_KEY_2>
   JWT_ACCESS_EXPIRY=8h
   JWT_REFRESH_EXPIRY=7d

   INITIAL_SUPER_ADMIN_USERNAME=admin
   INITIAL_SUPER_ADMIN_EMAIL=admin@nkbmanufacturing.com
   INITIAL_SUPER_ADMIN_PASSWORD=<STRONG_RANDOM_ADMIN_PASSWORD>

   APP_URL=https://asset.nkbmanufacturing.com
   CORS_ALLOWED_ORIGINS=https://asset.nkbmanufacturing.com
   LOG_LEVEL=info
   ```

4. **Launch Application via Deployment Script**:
   ```bash
   chmod +x scripts/*.sh
   ./scripts/deploy.sh
   ```

5. **Verify Container Status**:
   ```bash
   docker ps --filter "name=nkb-unified-assets-app"
   curl -i http://127.0.0.1:5050/api/health
   ```

---

## 5. Persistent Data & Volume Integrity

Data is stored in Docker named volumes outside the container lifecycle:
- `nkb-unified-assets-data`: Database file (`/app/backend/data/nkb_unified.sqlite`).
- `nkb-unified-assets-uploads`: Photos, receipts, attachments (`/app/backend/uploads`).
- `nkb-unified-assets-logs`: Winston rotational logs (`/app/backend/logs`).

Running `docker compose down` or updating the container image **never** erases data in these volumes.

---

## 6. Updating the Production Application

When deploying a new software revision:

```bash
cd /opt/nkb-unified-assets
git pull origin main

# Execute automated zero-downtime deployment script:
# 1. Creates backup
# 2. Builds new image
# 3. Recreates container
# 4. Verifies health
./scripts/deploy.sh
```
