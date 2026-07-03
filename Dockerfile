# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine3.20 AS builder

WORKDIR /app

# Copy package manifests first for better layer caching.
# This layer is only invalidated when dependencies change.
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the source and build
COPY . .
RUN npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
# nginx:1.30.3-alpine3.23 — stable nginx on Alpine 3.23 (current, patched libxml2).
# Replaces nginx:1.25-alpine3.18 which carried CVE-2024-56171 (libxml2) on EOL Alpine 3.18.
# Note: nginx stable Alpine tags ship on alpine3.23, not alpine3.20.
FROM nginx:1.30.3-alpine3.23

# OCI standard image labels — values injected by CI at build time
ARG REVISION=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="STANS Navigation System" \
      org.opencontainers.image.description="Smart Traffic-Aware Navigation System — React/Nginx static app" \
      org.opencontainers.image.url="https://github.com/Dakshmulundkar/STANS" \
      org.opencontainers.image.source="https://github.com/Dakshmulundkar/STANS" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MIT"

# Create a non-root user and group for the runtime process.
# Nginx master process runs as root to bind port 80, but worker processes
# will run as the nginx user (default in nginx:alpine). We add appuser for
# auditability and future use with rootless configurations.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Upgrade all packages first to catch any CVEs not yet patched in the base image tag,
# then install wget for the HEALTHCHECK.
RUN apk update && apk upgrade --no-cache && apk add --no-cache wget

# Remove default Nginx content and install our built app
RUN rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Ensure the app files are readable by the nginx user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Nginx needs to write to these paths at runtime.
# All other parts of the filesystem will be mounted read-only (see compose.yaml).
# We pre-create these directories so tmpfs mounts work correctly.
RUN mkdir -p /var/cache/nginx /var/run /tmp && \
    chown -R nginx:nginx /var/cache/nginx /var/run /tmp

EXPOSE 80

# Health check — polls the /health endpoint every 30s
# start-period gives Nginx time to start before checks begin
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
