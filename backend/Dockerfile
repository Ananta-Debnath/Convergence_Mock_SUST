# Multi-stage Dockerfile for the SUST CRM Triage API.
# - deps stage: installs prod dependencies with cache-friendly layer
# - runtime stage: slim image, non-root user, healthcheck on /health

FROM node:20-alpine AS deps
WORKDIR /app

# Copy manifests first so the install layer caches on src-only changes.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Run as the unprivileged "node" user that the base image ships.
USER node

# Copy installed deps and source from the build stages.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

EXPOSE 3000

# Render / Docker healthcheck hits the Express liveness endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1

CMD ["node", "src/server.js"]