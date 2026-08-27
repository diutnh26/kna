# Multi-target image for the KNĂ local snapshot.
#   docker compose builds `target: api` and `target: web`.
# Original d:\Travel\kna is never modified.

FROM node:24-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY app/package.json ./
COPY app/apps/api/package.json ./apps/api/
COPY app/apps/web/package.json ./apps/web/
COPY app/packages/chain-client/package.json ./packages/chain-client/

# Fresh Linux resolve — the Windows lockfile is not copied (see .dockerignore).
# Retries: the first web-only install hit ETIMEDOUT against the registry.
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm install --include=dev

COPY app/ .

ENV DATABASE_URL="postgresql://kna:kna@postgres:5432/kna_dev"
ENV DIRECT_DATABASE_URL="postgresql://kna:kna@postgres:5432/kna_dev"

# ── API ──────────────────────────────────────────────────────────────
FROM base AS api

RUN npm run build:chain-client && npm run db:generate && npm run build:api

COPY entrypoint-api.js /app/entrypoint-api.js

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "/app/entrypoint-api.js"]

# ── Web build ────────────────────────────────────────────────────────
# Production `vite build` refuses localhost (apps/web/vite.config.js).
# `--mode development` skips that guard so the bundle can call
# http://localhost:4000, which this compose file publishes on the host.
FROM base AS web-build

ENV VITE_API_URL=http://localhost:4000
WORKDIR /app/apps/web
RUN npx vite build --mode development

FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
