#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: restore-db.sh
# Safely restore SQLite database and uploads from backup archive
# Usage: ./restore-db.sh /path/to/backup.sqlite.gz [/path/to/uploads.tar.gz]
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path-to-db-backup.sqlite.gz> [path-to-uploads.tar.gz]"
  exit 1
fi

DB_BACKUP="$1"
UPLOADS_BACKUP="${2:-}"
VOLUME_NAME="nkb-unified-assets-data"
UPLOADS_VOLUME="nkb-unified-assets-uploads"
CONTAINER_NAME="nkb-unified-assets-app"

if [ ! -f "${DB_BACKUP}" ]; then
  echo "[ERROR] Database backup file not found: ${DB_BACKUP}"
  exit 1
fi

echo "=== [WARNING] You are about to restore database from: ${DB_BACKUP} ==="
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "Restoration cancelled."
  exit 0
fi

# 1. Stop container if running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Stopping container ${CONTAINER_NAME}..."
  docker stop "${CONTAINER_NAME}"
fi

# 2. Decompress database backup to staging
TEMP_RESTORE=$(mktemp -d)
gunzip -c "${DB_BACKUP}" > "${TEMP_RESTORE}/restored.sqlite"

echo "Verifying integrity of restored SQLite file..."
sqlite3 "${TEMP_RESTORE}/restored.sqlite" "PRAGMA integrity_check;"

# 3. Copy into persistent Docker volume
echo "Restoring database to volume ${VOLUME_NAME}..."
docker run --rm -v "${VOLUME_NAME}:/volume" -v "${TEMP_RESTORE}:/source" alpine \
  cp /source/restored.sqlite /volume/nkb_unified.sqlite

rm -rf "${TEMP_RESTORE}"

# 4. Optional uploads restoration
if [ -n "${UPLOADS_BACKUP}" ] && [ -f "${UPLOADS_BACKUP}" ]; then
  echo "Restoring uploads from ${UPLOADS_BACKUP}..."
  docker run --rm -v "${UPLOADS_VOLUME}:/uploads" -v "$(dirname "${UPLOADS_BACKUP}"):/backup" alpine \
    tar -xzf "/backup/$(basename "${UPLOADS_BACKUP}")" -C /uploads
fi

# 5. Restart container
echo "Starting container ${CONTAINER_NAME}..."
docker start "${CONTAINER_NAME}"

echo "Waiting for health check probe..."
sleep 10
docker inspect --format='{{json .State.Health.Status}}' "${CONTAINER_NAME}"

echo "=== RESTORATION COMPLETED SUCCESSFULLY ==="
