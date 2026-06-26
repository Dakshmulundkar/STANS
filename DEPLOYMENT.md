# STANS Deployment Guide

> **Scope:** This guide covers local Docker deployment and CI/CD pipeline usage.
> It does NOT describe a live production server — no real VPS is used.
> See the "Not Implemented" section in README.md for what is intentionally excluded.

## Table of Contents

- [Quick Start](#quick-start)
- [Local Development (npm)](#local-development-npm)
- [Docker — Build and Run Manually](#docker--build-and-run-manually)
- [Docker Compose](#docker-compose)
- [Helper Scripts](#helper-scripts)
- [Health Check](#health-check)
- [CI/CD Pipeline](#cicd-pipeline)
- [Rollback Procedure](#rollback-procedure)
- [Blue-Green Deployment](#blue-green-deployment)
- [Phase 2 Preview](#phase-2-preview)

---

## Quick Start

**Fastest way to run STANS locally with Docker:**

```bash
# Option A — Compose (recommended)
docker compose up --build

# Option B — Script
chmod +x scripts/run-local.sh
./scripts/run-local.sh
```

Then open: http://localhost:8080

---

## Local Development (npm)

Run the Vite dev server with hot reload:

```bash
npm install
npm run dev
```

Build the production bundle:

```bash
npm run build
```

---

## Docker — Build and Run Manually

Build the image with OCI labels:

```bash
docker build \
  --build-arg REVISION=$(git rev-parse HEAD) \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -t stans:local \
  .
```

Run the container:

```bash
docker run -d \
  -p 8080:80 \
  --name stans-local \
  stans:local
```

Inspect OCI labels:

```bash
docker inspect stans:local --format '{{ json .Config.Labels }}' | jq
```

Stop and remove:

```bash
docker stop stans-local && docker rm stans-local
```

---

## Docker Compose

Start with a fresh build:

```bash
docker compose up --build
```

Start in the background:

```bash
docker compose up -d --build
```

Watch logs:

```bash
docker compose logs -f
```

Check container health:

```bash
docker compose ps
```

Stop and remove:

```bash
docker compose down
```

---

## Helper Scripts

Two shell scripts are included for convenience:

### `scripts/run-local.sh`

Builds the image and starts the container on port 8080:

```bash
chmod +x scripts/run-local.sh
./scripts/run-local.sh
```

This script removes any existing `stans-local` container before starting fresh.

### `scripts/healthcheck.sh`

Checks the `/health` endpoint at `localhost:8080`:

```bash
chmod +x scripts/healthcheck.sh
./scripts/healthcheck.sh
# → OK — response: healthy
```

Override the URL:

```bash
HEALTH_URL=http://localhost:9090/health ./scripts/healthcheck.sh
```

---

## Health Check

The `/health` endpoint is served by Nginx and returns:

```
HTTP/1.1 200 OK
Content-Type: text/plain

healthy
```

This endpoint is used by:
- Docker HEALTHCHECK instruction (every 30s inside the container)
- Docker Compose health check configuration
- GitHub Actions post-deploy health check job
- `scripts/healthcheck.sh` for manual verification

---

## CI/CD Pipeline

Two GitHub Actions workflows are used:

### `ci.yml` — Build Validation

Triggers on every push and PR. Does NOT push any images.

```
Push/PR → checkout → setup-node → npm ci → npm run build → lint (if configured)
```

### `deploy.yml` — Build, Push, Health Check, Rollback

Triggers on push to `main` only.

```
Push to main
    │
    ▼
build-and-push job
  ├── checkout
  ├── npm install + build
  ├── docker/login-action (GHCR)
  ├── docker/build-push-action
  │   ├── tags: latest, sha-<commit>, semver (if tagged)
  │   └── build-args: REVISION, BUILD_DATE
  │
  ▼ (on success)
health-check job
  ├── pull image: ghcr.io/.../stans:sha-<commit>
  ├── docker run -p 8080:80
  ├── wait 8s
  └── curl http://localhost:8080/health
      ├── HTTP 200 + body "healthy" → PASS
      └── anything else → FAIL → triggers rollback job
      │
      ▼ (on health-check failure)
rollback job
  ├── find previous sha- tag from GHCR
  ├── docker pull previous-tag
  ├── docker tag previous-tag as latest
  └── docker push latest (restore)
```

**Container Registry:**

```
ghcr.io/dakshmulundkar/stans-app:latest
ghcr.io/dakshmulundkar/stans-app:sha-<40-char-commit-sha>
```

---

## Rollback Procedure

### Automated Rollback (CI)

If the health check job in `deploy.yml` fails, the rollback job automatically:
1. Finds the most recent stable SHA-tagged image in GHCR
2. Re-tags it as `latest`
3. Pushes the restored `latest` tag

### Manual Rollback

Find a previous SHA tag from the GHCR container page or `git log`:

```bash
# List recent commits with their SHA
git log --oneline -10

# Pull a specific SHA image
docker pull ghcr.io/dakshmulundkar/stans-app:sha-<previous-sha>

# Run the previous version
docker run -d -p 8080:80 \
  --name stans-rollback \
  ghcr.io/dakshmulundkar/stans-app:sha-<previous-sha>

# Verify it's healthy
curl http://localhost:8080/health
```

---

## Blue-Green Deployment

See [`docs/blue-green.md`](docs/blue-green.md) for a detailed guide on zero-downtime
blue-green deployments with two container instances and an Nginx upstream switch.

**Summary of the pattern:**
- Run two containers: `stans-blue` and `stans-green`
- Deploy new version to the inactive slot
- Health check the new slot
- Switch Nginx upstream to point to the new slot
- Old slot becomes the new standby

---

## Phase 2 Preview

Phase 2 (Security — Person B) will add on top of this foundation:

- **Trivy scanning**: Filesystem and image vulnerability scanning in CI (`security.yml`)
- **CodeQL**: Static analysis for JavaScript/TypeScript (`codeql.yml`)
- **Content-Security-Policy**: CSP header added to nginx.conf after inline script audit
- **Read-only container filesystem**: `read_only: true` in compose.yaml with tmpfs mounts
- **Security hardening guide**: UFW, SSH, Certbot guidance in `docs/security-hardening.md`

Phase 2 begins after Phase 1 is merged to `main`.
