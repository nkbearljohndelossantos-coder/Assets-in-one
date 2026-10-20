#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: rollback.sh
# Emergency Rollback Pipeline for nkb-unified-assets
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
cd "${PROJECT_ROOT}"

echo "================================================================================"
echo "  EMERGENCY ROLLBACK SCRIPT — nkb-unified-assets"
echo "================================================================================"

# List available database backups
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nkb-unified-assets}"
if [ -d "${BACKUP_DIR}/db" ]; then
  echo "Available database snapshots:"
  ls -lt "${BACKUP_DIR}/db" | head -n 5
fi

read -p "Enter full path to database backup snapshot to restore (or leave blank to skip DB restore): " SNAPSHOT_PATH

if [ -n "${SNAPSHOT_PATH}" ]; then
  if [ -f "${SNAPSHOT_PATH}" ]; then
    bash "${SCRIPT_DIR}/restore-db.sh" "${SNAPSHOT_PATH}"
  else
    echo "[ERROR] Backup snapshot file not found: ${SNAPSHOT_PATH}"
    exit 1
  fi
fi

# Rebuild / restart previous container
echo "--> Restarting application container..."
docker compose restart app

echo "--> Verifying health status..."
sleep 10
docker inspect --format='{{json .State.Health.Status}}' "nkb-unified-assets-app"

echo "=== ROLLBACK COMPLETED ==="
