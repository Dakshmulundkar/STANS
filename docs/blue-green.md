# Blue-Green and Canary Deployment Patterns

> **Note:** This is a documentation-only guide. These patterns require a real server or VM
> with Docker installed. No infrastructure is provisioned as part of this repository.

## Table of Contents

- [Blue-Green Deployment](#blue-green-deployment)
- [Canary Releases](#canary-releases)
- [Automated Rollback](#automated-rollback)

---

## Blue-Green Deployment

Blue-green deployment runs two identical production environments (blue and green).
At any time, only one is live. Deploying means switching traffic to the other one.

### Why use it?

- Zero-downtime deployments
- Instant rollback (just switch back)
- New version is fully tested before receiving traffic

### Setup

You need:
- A host with Docker installed
- An Nginx instance acting as the load balancer/proxy
- Two container slots: `stans-blue` (port 8081) and `stans-green` (port 8082)
- A separate Nginx upstream config file that can be reloaded

### Directory layout on the server

```
/etc/nginx/
  conf.d/
    stans.conf        ← main server block
    upstream.conf     ← only defines the upstream block (swapped during deploy)
```

### `upstream.conf` — pointing at blue

```nginx
upstream stans_active {
    server 127.0.0.1:8081;  # blue is live
}
```

### `stans.conf` — server block

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://stans_active;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /health {
        proxy_pass http://stans_active/health;
    }
}
```

### Deployment script: `scripts/blue-green-deploy.sh`

```bash
#!/bin/bash
# Deploy a new STANS image using blue-green strategy.
# Usage: ./scripts/blue-green-deploy.sh ghcr.io/dakshmulundkar/stans-app:sha-<new-sha>

set -euo pipefail

NEW_IMAGE="${1:?Usage: $0 <image:tag>}"
UPSTREAM_CONF="/etc/nginx/conf.d/upstream.conf"

# Determine which slot is currently inactive
ACTIVE_PORT=$(grep -oP '(?<=server 127\.0\.0\.1:)\d+' "$UPSTREAM_CONF")

if [ "$ACTIVE_PORT" = "8081" ]; then
    INACTIVE_SLOT="green"
    INACTIVE_PORT="8082"
    ACTIVE_SLOT="blue"
else
    INACTIVE_SLOT="blue"
    INACTIVE_PORT="8081"
    ACTIVE_SLOT="green"
fi

echo "Active slot: ${ACTIVE_SLOT} (port ${ACTIVE_PORT})"
echo "Deploying to: ${INACTIVE_SLOT} (port ${INACTIVE_PORT})"

# Pull new image
docker pull "$NEW_IMAGE"

# Stop inactive slot if running, start new version
docker rm -f "stans-${INACTIVE_SLOT}" 2>/dev/null || true
docker run -d \
    --name "stans-${INACTIVE_SLOT}" \
    -p "${INACTIVE_PORT}:80" \
    --restart unless-stopped \
    "$NEW_IMAGE"

# Wait for it to be healthy
echo "Waiting for ${INACTIVE_SLOT} to become healthy..."
for i in $(seq 1 12); do
    if curl -sf "http://localhost:${INACTIVE_PORT}/health" > /dev/null; then
        echo "${INACTIVE_SLOT} is healthy after ${i} attempts"
        break
    fi
    if [ "$i" = "12" ]; then
        echo "ERROR: ${INACTIVE_SLOT} failed health checks. Aborting."
        docker rm -f "stans-${INACTIVE_SLOT}"
        exit 1
    fi
    sleep 5
done

# Switch Nginx upstream to the new slot
cat > "$UPSTREAM_CONF" <<EOF
upstream stans_active {
    server 127.0.0.1:${INACTIVE_PORT};  # ${INACTIVE_SLOT} is now live
}
EOF

nginx -t && nginx -s reload
echo "Traffic switched to ${INACTIVE_SLOT} (port ${INACTIVE_PORT})"
echo "Previous slot (${ACTIVE_SLOT}, port ${ACTIVE_PORT}) is now standby"
```

### Rollback with blue-green

Rollback is instant — just switch the upstream back to the previous slot:

```bash
# If green is live and you want to roll back to blue
cat > /etc/nginx/conf.d/upstream.conf <<'EOF'
upstream stans_active {
    server 127.0.0.1:8081;  # blue is live (rolled back)
}
EOF

nginx -t && nginx -s reload
echo "Rolled back to blue"
```

No image pull required — the old container is still running.

---

## Canary Releases

A canary release sends a small percentage of traffic to the new version while most
traffic continues to hit the stable version. You gradually increase the percentage
as confidence grows.

### Nginx weighted upstream

```nginx
upstream stans_canary {
    # 90% of traffic goes to stable (blue)
    server 127.0.0.1:8081 weight=9;

    # 10% of traffic goes to canary (green)
    server 127.0.0.1:8082 weight=1;
}
```

Use this upstream in `stans.conf` instead of `stans_active` for a canary rollout.

### Gradual rollout stages

```nginx
# Stage 1 — 10% canary
server 127.0.0.1:8081 weight=9;
server 127.0.0.1:8082 weight=1;

# Stage 2 — 50% canary (after monitoring confirms stability)
server 127.0.0.1:8081 weight=1;
server 127.0.0.1:8082 weight=1;

# Stage 3 — 100% new version (full cutover)
server 127.0.0.1:8082 weight=1;
# (remove old slot entry or set weight=0)
```

After each stage: monitor error rates, response times, and health check results
before proceeding to the next stage.

### Canary rollback

If the canary looks bad, set its weight back to 0 and reload:

```bash
# Abort canary — all traffic back to stable
cat > /etc/nginx/conf.d/upstream.conf <<'EOF'
upstream stans_active {
    server 127.0.0.1:8081 weight=1;  # 100% stable
}
EOF

nginx -t && nginx -s reload
echo "Canary aborted. All traffic restored to stable."
```

---

## Automated Rollback

The `deploy.yml` GitHub Actions workflow includes an automated rollback job.

How it works:
1. After the image is pushed to GHCR, the `health-check` job pulls it and runs it locally
2. If `/health` returns anything other than `HTTP 200 + "healthy"`, the job fails
3. The `rollback` job runs only on `health-check` failure
4. It finds the most recent previous SHA-tagged image in GHCR
5. It re-tags that image as `latest` and pushes it, restoring the last known good state

This provides a safety net for CI/CD deployment failures without requiring manual intervention.

For production servers, the blue-green script above includes a similar health-check-before-cutover
pattern to prevent bad deploys from ever receiving traffic.
