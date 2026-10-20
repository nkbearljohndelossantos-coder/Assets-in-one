# ==============================================================================
# MULTI-STAGE DOCKERFILE: UNIFIED ITMS + PPE ENTERPRISE WEB APPLICATION
# ==============================================================================

# STAGE 1: Frontend Build
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --silent

COPY frontend/ ./
RUN npm run build

# STAGE 2: Backend Dependencies & Preparation
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev --silent

# STAGE 3: Final Production Image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install runtime dependencies for native bindings if required
RUN apk add --no-cache tzdata sqlite

# Copy backend files
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY package*.json ./

# Copy compiled frontend dist into backend/public and frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure persistence directories exist
RUN mkdir -p /app/backend/data /app/backend/uploads /app/backend/logs

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

EXPOSE 5000

# Run migrations and start production server
CMD ["node", "backend/src/server.js"]
