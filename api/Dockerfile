# syntax=docker/dockerfile:1.7

# ---- build stage ----
# Bumped 2026-06-25: simplify context + paths after Render's context-root fix.
FROM node:20-alpine AS build

# Copy API manifests + sources into the build image. The build context is the
# repo root (see render.yaml -> dockerContext: ../), so all paths are repo-root
# relative.
WORKDIR /build
COPY api/package.json api/tsconfig.json ./api/
COPY tsconfig.base.json ./tsconfig.base.json
COPY api/src ./api/src

WORKDIR /build/api
RUN npm install --no-audit --no-fund
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app/api
COPY api/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

# Copy compiled API from the build stage.
COPY --from=build /build/api/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
