# Deployment & Production Operations Guide
## Unified ITMS + PPE Enterprise System

---

## 1. Prerequisites & Environment Requirements

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Operating System** | Ubuntu 22.04 LTS / Windows Server 2022 | Ubuntu 24.04 LTS / Debian 12 |
| **Runtime** | Node.js v18.0.0+ | Node.js v20.x or v22.x LTS |
| **Memory (RAM)** | 2 GB RAM | 4 GB RAM or higher |
| **Storage** | 10 GB SSD | 50 GB NVMe SSD |
| **Containerization** | Docker Engine 24.0+ & Docker Compose v2 | Docker Engine 26.0+ |

---

## 2. Option A: Bare-Metal / Virtual Machine Deployment (Direct Node)

### Step 1: Clone Repository & Configure Environment
```bash
cd /opt/nkb-enterprise
cp unified-itms-ppe/.env.example unified-itms-ppe/.env
```
Edit `.env` and set secure production secrets:
```ini
NODE_ENV=production
PORT=5000
DB_CLIENT=sqlite3
DB_FILE=./data/nkb_unified.sqlite
JWT_SECRET=generate_strong_64_character_hex_key_here
JWT_REFRESH_SECRET=generate_another_strong_64_character_hex_key_here
CORS_ALLOWED_ORIGINS=https://itms-ppe.yourcompany.com
```

### Step 2: Install Backend Dependencies & Run Migrations
```bash
cd /opt/nkb-enterprise/unified-itms-ppe/backend
npm ci --omit=dev
node ../scripts/run-migrations.js
```

### Step 3: Build Unified Frontend
```bash
cd /opt/nkb-enterprise/unified-itms-ppe/frontend
npm ci
npm run build
```
*(The compiled assets will be placed in `frontend/dist`, where Express serves them automatically).*

### Step 4: Configure PM2 Process Manager
Install and start the application under PM2 for automatic restarts:
```bash
npm install -g pm2
cd /opt/nkb-enterprise/unified-itms-ppe
pm2 start backend/src/server.js --name "unified-itms-ppe" -i 1 --max-memory-restart 1G
pm2 save
pm2 startup
```

---

## 3. Option B: Docker Containerized Deployment (Recommended)

The project includes an optimized multi-stage `Dockerfile` and `docker-compose.yml`:

```bash
cd /opt/nkb-enterprise/unified-itms-ppe

# 1. Review environment variables in docker-compose.yml or create .env
# 2. Build and launch container in detached mode
docker compose up -d --build

# 3. Verify container health status
docker ps
# Status should display "(healthy)"

# 4. View application startup logs
docker compose logs -f app
```

### Persistent Data Volumes
The Docker configuration defines three persistent named volumes:
- `app-data`: Stores the canonical SQLite database file (`/app/backend/data/nkb_unified.sqlite`).
- `app-uploads`: Stores uploaded asset images and document attachments.
- `app-logs`: Stores Winston rotational log files.

---

## 4. Nginx Reverse Proxy & SSL Configuration

To terminate SSL/TLS and forward traffic to the unified server on port 5000:

```nginx
server {
    listen 80;
    server_name itms-ppe.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name itms-ppe.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/itms-ppe.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/itms-ppe.yourcompany.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Health Probes & Monitoring

The unified backend provides standard health check probes:

```bash
curl -i http://localhost:5000/api/health
```

Expected HTTP 200 response:
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "service": "NKB Centralized API Platform",
    "version": "1.0.0",
    "uptimeSeconds": 1420,
    "timestamp": "2026-10-20T02:45:00.000Z"
  }
}
```
If the database connection is severed, the endpoint automatically returns HTTP 503 Service Unavailable.
