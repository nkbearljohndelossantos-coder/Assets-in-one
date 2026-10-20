# Hostinger Docker Manager Operations Guide
## Project: `nkb-unified-assets`

---

## 1. Overview of Hostinger Docker Manager

Hostinger hPanel provides a visual interface for managing containerized applications on VPS instances:
**Path:** `hPanel → VPS → Manage → Docker Manager`

The Unified ITMS + PPE application is engineered specifically for compatibility with Hostinger Docker Manager under project name **`nkb-unified-assets`**.

---

## 2. Deployment via Hostinger Docker Manager UI

### Method 1: Compose File Pasting (Direct in hPanel)

1. Log into [Hostinger hPanel](https://hpanel.hostinger.com).
2. Go to **VPS** → Select your VPS (`187.77.143.211`).
3. In the left menu, click **Docker Manager** → **Projects**.
4. Click **Create Project** (or **+ New Compose**).
5. Enter Project Details:
   - **Project Name**: `nkb-unified-assets`
   - **Compose File**: Copy and paste the contents of `unified-itms-ppe/docker-compose.yml`.
6. Add Environment Variables (under the **Environment Variables** / **.env** tab in Docker Manager):
   - `JWT_SECRET`: *(Your 64-character generated hex string)*
   - `JWT_REFRESH_SECRET`: *(Your second 64-character generated hex string)*
   - `INITIAL_SUPER_ADMIN_PASSWORD`: *(Your secure initial admin password)*
   - `APP_URL`: `https://asset.nkbmanufacturing.com`
   - `CORS_ALLOWED_ORIGINS`: `https://asset.nkbmanufacturing.com`
7. Click **Deploy** / **Start**.

Hostinger Docker Manager will automatically pull or build the container, create the named volumes (`nkb-unified-assets-data`, `nkb-unified-assets-uploads`, `nkb-unified-assets-logs`), and launch the service bound to `127.0.0.1:5050`.

---

## 3. Monitoring & Management in Docker Manager

Once deployed, Docker Manager provides real-time controls:

### Status & Health Check
- The project status will display **Running**.
- Inside the container list, `nkb-unified-assets-app` will display **healthy** (verified by our internal HTTP probe).

### Viewing Live Logs
- Click the project name `nkb-unified-assets`.
- Click on the `nkb-unified-assets-app` container.
- Click **Logs** tab to view real-time Winston logs, database migration statuses, and API request traffic.

### Restarting & Stopping
- **Restart**: Safely restarts the container process without erasing volume data.
- **Stop**: Pauses the container.

---

## 4. Safe Update Procedure in Docker Manager

When a new software version is ready:

1. **Safety First**: Trigger a database backup via SSH or terminal:
   ```bash
   /opt/nkb-unified-assets/scripts/backup-db.sh
   ```
2. In Docker Manager:
   - Select `nkb-unified-assets`.
   - Click **Rebuild** (or **Redeploy**).
3. The container will recreate using the fresh code while reconnecting to the existing `nkb-unified-assets-data` and `nkb-unified-assets-uploads` persistent volumes.
4. Database migrations run automatically upon container boot.

---

## 5. Critical Docker Manager Safety Rules

> [!CAUTION]
> **Never Click "Delete Volume" or "Prune Volumes"**
> Hostinger Docker Manager provides options to clean up unused assets. **Never** check the option to prune volumes or delete volumes when removing old containers. Doing so would delete the SQLite database file and uploaded files.

> [!WARNING]
> **Never Change Port Binding to 80 or 443 in Compose**
> Ports 80 and 443 are reserved for the host Nginx reverse proxy. Always keep host port mapped as `127.0.0.1:5050:5000`.
