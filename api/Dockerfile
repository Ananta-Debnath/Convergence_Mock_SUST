# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /repo

# Install workspace deps from the root package.json (workspaces hoist api deps).
COPY package.json package-lock.json* tsconfig.base.json ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json
RUN npm install --no-audit --no-fund

# Copy API source + config and build TypeScript -> JS.
COPY api ./api
WORKDIR /repo/api
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

# Reinstall only production deps for the API service.
COPY package.json package-lock.json* ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json
RUN npm install --omit=dev --no-audit --no-fund

# Copy compiled API + its package.json so Node can resolve hoisted deps.
COPY --from=build /repo/api/dist ./api/dist
COPY --from=build /repo/api/package.json ./api/package.json

WORKDIR /app/api
EXPOSE 3001
CMD ["node", "dist/index.js"]

WORKDIR /app/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
COPY --from=build /app/client/dist ./api/public

WORKDIR /app/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
