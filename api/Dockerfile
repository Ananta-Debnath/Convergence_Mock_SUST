# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /repo

# Install workspace deps from the root package.json.
COPY package.json package-lock.json* ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json

RUN npm install --no-audit --no-fund

# Copy source needed to build the API.
COPY tsconfig.base.json ./
COPY api ./api

# Build the API (TypeScript → JS).
WORKDIR /repo/api
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Reinstall only production deps for the API service.
COPY package.json package-lock.json* ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json

RUN npm install --omit=dev --no-audit --no-fund

# Copy compiled API + the small number of root-hoisted runtime deps it needs.
COPY --from=build /repo/api/dist ./api/dist
COPY --from=build /repo/api/package.json ./api/package.json

WORKDIR /app/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
COPY --from=build /app/client/dist ./api/public

WORKDIR /app/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
