# Backup, Restore, and Disaster Recovery Guide
## Unified ITMS + PPE Enterprise System

---

## 1. Backup Strategy Overview

A robust backup strategy ensures continuous business operations, compliance with financial audit retention mandates, and instant recovery from hardware or catastrophic data loss.

The backup scope encompasses:
1. **Relational Database**: All transactional data, asset registries, general ledger accounts, journal entries, and audit logs.
2. **File Storage**: Uploaded hardware photos, equipment documentation, and receipts in `backend/uploads/`.
3. **Environment Configuration**: Active `.env` files (stored securely encrypted).

---

## 2. Automated Database Backup Procedures

### 2.1. Standalone / SQLite Engine Backups
SQLite allows online, lock-free backups while the server is running using the SQLite online backup API:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/nkb-unified"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="/opt/nkb-enterprise/unified-itms-ppe/backend/data/nkb_unified.sqlite"

mkdir -p "${BACKUP_DIR}/db"

# Perform consistent atomic snapshot without stopping application
sqlite3 "${DB_FILE}" ".backup '${BACKUP_DIR}/db/nkb_unified_${TIMESTAMP}.sqlite'"

# Compress backup
gzip -9 "${BACKUP_DIR}/db/nkb_unified_${TIMESTAMP}.sqlite"

echo "[SUCCESS] SQLite backup saved to ${BACKUP_DIR}/db/nkb_unified_${TIMESTAMP}.sqlite.gz"
```

### 2.2. Enterprise MySQL Engine Backups
When configured with MySQL / MariaDB:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/nkb-unified/mysql"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "${BACKUP_DIR}"

mysqldump \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  -h "${DB_HOST:-127.0.0.1}" \
  -u "${DB_USER:-nkb_user}" \
  -p"${DB_PASSWORD}" \
  "${DB_DATABASE:-nkb_unified_db}" | gzip -9 > "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

echo "[SUCCESS] MySQL dump saved to ${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"
```

---

## 3. Uploaded Assets & File Storage Backups

Uploaded images and document attachments in `backend/uploads/` are backed up using `rsync` or incremental `tar` archives:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/nkb-unified/uploads"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
UPLOADS_DIR="/opt/nkb-enterprise/unified-itms-ppe/backend/uploads"

mkdir -p "${BACKUP_DIR}"

tar -czf "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" -C "${UPLOADS_DIR}" .
echo "[SUCCESS] Uploads backup saved to ${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
```

---

## 4. Backup Retention & Rotation Schedule

Recommended crontab schedule (`/etc/cron.d/nkb-unified-backup`):

```cron
# Run daily database and file backup at 02:00 AM
0 2 * * * root /usr/local/bin/nkb-backup.sh >> /var/log/nkb-backup.log 2>&1

# Prune backups older than 30 days
0 3 * * * root find /var/backups/nkb-unified -type f -mtime +30 -name "*.gz" -delete
```

| Frequency | Retention Period | Target Storage |
| :--- | :--- | :--- |
| **Hourly Snapshots** | 24 Hours | Local NVMe staging drive |
| **Daily Backups** | 30 Days | Dedicated NAS / Enterprise Backup Volume |
| **Weekly Backups** | 12 Weeks | Offsite Cloud Object Storage (S3 / GCS) |
| **Monthly Financial Archive** | 7 Years | Cold Glacial Storage (Financial Compliance) |

---

## 5. Step-by-Step Restoration & Recovery

### 5.1. Restoring SQLite Database
1. Stop the application service:
   ```bash
   pm2 stop unified-itms-ppe
   # or for Docker:
   docker compose stop app
   ```
2. Uncompress and restore database snapshot:
   ```bash
   gunzip -c /var/backups/nkb-unified/db/nkb_unified_YYYYMMDD_HHMMSS.sqlite.gz > /opt/nkb-enterprise/unified-itms-ppe/backend/data/nkb_unified.sqlite
   ```
3. Verify file permissions and integrity:
   ```bash
   sqlite3 /opt/nkb-enterprise/unified-itms-ppe/backend/data/nkb_unified.sqlite "PRAGMA integrity_check;"
   # Expected result: ok
   ```
4. Restart the application service:
   ```bash
   pm2 restart unified-itms-ppe
   # or for Docker:
   docker compose start app
   ```

### 5.2. Restoring Uploaded Media Files
```bash
tar -xzf /var/backups/nkb-unified/uploads/uploads_YYYYMMDD_HHMMSS.tar.gz -C /opt/nkb-enterprise/unified-itms-ppe/backend/uploads/
```

### 5.3. Disaster Recovery Verification Checklist
- [ ] Database integrity check returns `ok`.
- [ ] Application health check `GET /api/health` returns HTTP 200.
- [ ] Sign in with administrative credentials succeeds.
- [ ] PPE dashboard shows correct historical Net Book Value.
- [ ] ITMS ticket and asset lists load without errors.
- [ ] Uploaded asset photos render correctly.
