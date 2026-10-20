# ==============================================================================
# PRODUCTION MULTI-STAGE DOCKERFILE: UNIFIED ITMS + PPE ENTERPRISE APPLICATION
# Pinned Base Image: Node.js 20 LTS Alpine (Security-hardened, non-root)
# ==============================================================================

# STAGE 1: Frontend Build
FROM node:20.18.0-alpine3.20 AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --silent

COPY frontend/ ./
RUN npm run build

# STAGE 2: Backend Dependencies Preparation
FROM node:20.18.0-alpine3.20 AS backend-builder
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev --silent

# STAGE 3: Final Production Runner
FROM node:20.18.0-alpine3.20 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install runtime utilities
RUN apk add --no-cache tzdata sqlite

# Copy backend dependencies and source code
COPY --from=backend-builder --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node scripts/ ./scripts/
COPY --chown=node:node package*.json ./

# Copy compiled frontend assets from Stage 1 into frontend/dist and backend/public
COPY --from=frontend-builder --chown=node:node /app/frontend/dist ./frontend/dist
COPY --from=frontend-builder --chown=node:node /app/frontend/dist ./backend/public

# Prepare persistent directories with non-root ownership
RUN mkdir -p /app/backend/data /app/backend/uploads /app/backend/logs \
    && chown -R node:node /app/backend/data /app/backend/uploads /app/backend/logs

# Switch to security-hardened non-root user
USER node

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/api/health || exit 1

EXPOSE 5000

# Start production server
CMD ["node", "backend/src/server.js"]
