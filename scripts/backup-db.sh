#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: backup-db.sh
# Production Database & Uploads Backup for nkb-unified-assets
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/nkb-unified-assets}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CONTAINER_NAME="nkb-unified-assets-app"
VOLUME_NAME="nkb-unified-assets-data"
UPLOADS_VOLUME="nkb-unified-assets-uploads"

mkdir -p "${BACKUP_DIR}/db" "${BACKUP_DIR}/uploads"

echo "=== [1/3] Starting Database Backup: ${TIMESTAMP} ==="

# Check if container is running; if running, use sqlite3 online backup from within container
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Backing up database directly from running container ${CONTAINER_NAME}..."
  docker exec "${CONTAINER_NAME}" sqlite3 /app/backend/data/nkb_unified.sqlite ".backup '/tmp/backup.sqlite'"
  docker cp "${CONTAINER_NAME}:/tmp/backup.sqlite" "${BACKUP_DIR}/db/nkb_unified_${TIMESTAMP}.sqlite"
  docker exec "${CONTAINER_NAME}" rm -f /tmp/backup.sqlite
else
  echo "Container stopped. Backing up from Docker volume ${VOLUME_NAME}..."
  docker run --rm -v "${VOLUME_NAME}:/volume" -v "${BACKUP_DIR}/db:/backup" alpine \
    cp /volume/nkb_unified.sqlite "/backup/nkb_unified_${TIMESTAMP}.sqlite"
fi

# Verify SQLite database integrity
echo "Verifying backup file integrity..."
sqlite3 "${BACKUP_DIR}/db/nkb_unified_${TIMESTAMP}.sqlite" "PRAGMA integrity_check;" || {
  echo "[ERROR] Integrity check failed on backup snapshot!"
  exit 1
}

gzip -9 "${BACKUP_DIR}/db/nkb_unified_${TIMESTAMP}.sqlite"
echo "=== [2/3] Database Backup Compressed: ${BACKUP_DIR}/db/nkb_unified_${TIMESTAMP}.sqlite.gz ==="

# Backup uploaded media assets
echo "=== [3/3] Backing up Uploaded Attachments & Photos ==="
docker run --rm -v "${UPLOADS_VOLUME}:/uploads" -v "${BACKUP_DIR}/uploads:/backup" alpine \
  tar -czf "/backup/uploads_${TIMESTAMP}.tar.gz" -C /uploads .

echo "=== BACKUP COMPLETED SUCCESSFULLY ==="
echo "DB Archive: ${BACKUP_DIR}/db/nkb_unified_${TIMESTAMP}.sqlite.gz"
echo "Uploads:    ${BACKUP_DIR}/uploads/uploads_${TIMESTAMP}.tar.gz"

# Rotate backups older than 30 days
find "${BACKUP_DIR}/db" -type f -name "*.sqlite.gz" -mtime +30 -delete
find "${BACKUP_DIR}/uploads" -type f -name "*.tar.gz" -mtime +30 -delete
