# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /repo/api

# Copy API package.json first for better layer caching.
COPY package.json ./
COPY tsconfig.json ./
COPY tsconfig.base.json ../tsconfig.base.json
COPY src ./src
RUN npm install --no-audit --no-fund
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app/api

# Production deps only.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy compiled API from the build stage.
COPY --from=build /repo/api/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
