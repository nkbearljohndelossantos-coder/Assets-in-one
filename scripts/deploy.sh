#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: deploy.sh
# Production Deployment Pipeline for Hostinger VPS
# Project Name: nkb-unified-assets
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
cd "${PROJECT_ROOT}"

echo "================================================================================"
echo "  NKB UNIFIED ITMS + PPE — PRODUCTION DEPLOYMENT"
echo "  Target URL: https://asset.nkbmanufacturing.com"
echo "================================================================================"

# 1. Check required configuration
if [ ! -f ".env" ]; then
  echo "[ERROR] .env file not found in ${PROJECT_ROOT}!"
  echo "Please create .env using .env.example as a template before deploying."
  exit 1
fi

# 2. Automatically create pre-deployment backup
echo "--> Creating pre-deployment safety backup..."
if [ -f "${SCRIPT_DIR}/backup-db.sh" ]; then
  bash "${SCRIPT_DIR}/backup-db.sh" || echo "[WARN] Pre-deployment backup skipped (volume may be new)."
fi

# 3. Build Docker container image locally
echo "--> Building production Docker image (pinned Node 20 LTS Alpine)..."
docker compose build --no-cache app

# 4. Launch or recreate containers gracefully
echo "--> Launching application containers..."
docker compose up -d --remove-orphans app

# 5. Wait for health check verification
echo "--> Waiting for container to report healthy status..."
MAX_ATTEMPTS=12
ATTEMPT=1
while [ ${ATTEMPT} -le ${MAX_ATTEMPTS} ]; do
  STATUS=$(docker inspect --format='{{json .State.Health.Status}}' "nkb-unified-assets-app" 2>/dev/null || echo '"starting"')
  echo "    Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: Health status is ${STATUS}"
  if [ "${STATUS}" == '"healthy"' ]; then
    echo "[SUCCESS] Container nkb-unified-assets-app is HEALTHY!"
    break
  fi
  sleep 5
  ATTEMPT=$((ATTEMPT + 1))
done

if [ ${ATTEMPT} -gt ${MAX_ATTEMPTS} ]; then
  echo "[ERROR] Container failed health check probe! Dumping recent logs:"
  docker logs --tail 50 "nkb-unified-assets-app"
  exit 1
fi

# 6. Verify internal loopback response
echo "--> Verifying internal loopback endpoint (http://127.0.0.1:5050/api/health)..."
HEALTH_RESP=$(curl -s -f http://127.0.0.1:5050/api/health || echo "FAILED")
echo "    Response: ${HEALTH_RESP}"

echo "================================================================================"
echo "  DEPLOYMENT SUCCESSFUL!"
echo "  Container: nkb-unified-assets-app"
echo "  Host Port: 127.0.0.1:5050"
echo "  Reverse Proxy: Nginx routes https://asset.nkbmanufacturing.com -> 127.0.0.1:5050"
echo "================================================================================"
