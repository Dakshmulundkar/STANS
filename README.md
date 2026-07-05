# Smart Traffic-Aware Navigation System (STANS)

A React + TypeScript application that visualizes graph-based route planning with
traffic simulation, algorithm comparison, and interactive pathfinding.

**Roadmap project:** https://roadmap.sh/projects/stans-navigation-deployment  
**Repository:** https://github.com/Dakshmulundkar/STANS

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| UI Framework | React | 18.x |
| Language | TypeScript | 5.x |
| Build Tool | Vite | 8.x |
| Styling | Tailwind CSS | 3.x |
| 3D Rendering | Three.js / React Three Fiber | 0.18x / 8.x |
| Animation | Framer Motion | 12.x |
| Charts | Recharts | 2.x |
| Container | Docker multi-stage build | — |
| Web Server | Nginx | 1.30.3-alpine3.23 |
| CI/CD | GitHub Actions | — |
| Registry | GitHub Container Registry | — |

---

## Application Features

- Interactive 2D and 3D graph visualization
- Route calculation between nodes (Dijkstra, A*)
- Traffic simulation with sine-wave congestion model
- Graph builder for custom nodes and edges
- Graph templates: Grid, Tree, Complete, Bipartite, Star
- Algorithm comparison: Kruskal, Prim, Dijkstra
- Performance benchmarking
- Graph metrics analysis (centrality, diameter, density)
- JSON and CSV import/export
- Interactive tutorial and educational mode
- Dark/light theme

---

## Deployment Journey

The deployment work was carried out in two structured phases. Each phase built on the previous, with Phase 1 (DevOps) laying the foundation and Phase 2 (Security) hardening it further.

---

## Phase 0 — Application Baseline

> What existed before any deployment work began.

The STANS application was already a working React + TypeScript frontend with:

- Dijkstra and A\* dual pathfinding implementation
- Sine-wave traffic simulation engine
- A basic multi-stage Dockerfile (unpinned `node:alpine` → `nginx:alpine`)
- A minimal GitHub Actions workflow pushing to GHCR
- A bare-bones `nginx.conf` with only SPA routing

**What was missing:** pinned base images, security headers, health checks, non-root user, CI validation, rollback capability, and any operational tooling.

---

## Phase 1 — DevOps Hardening (Person A)

> Goal: harden the container, tighten CI/CD, add operational tooling, and create the infrastructure foundation for Phase 2.

### Step 1 — Dockerfile Hardening

**File:** `Dockerfile`

The original Dockerfile used floating tags (`node:alpine`, `nginx:alpine`) with no metadata, no health check, and no non-root user. It was upgraded to:

- **Pinned base images** — `node:20-alpine3.20` (build) and `nginx:1.25-alpine3.18` (runtime). Prevents silent upstream changes from breaking builds.
- **OCI image labels** — `org.opencontainers.image.*` labels injected at build time via `--build-arg REVISION` and `BUILD_DATE`. Makes every image traceable to the exact commit and timestamp.
- **Non-root runtime user** — `appuser:appgroup` created with `addgroup` / `adduser`. Limits blast radius if Nginx is ever compromised.
- **Layer caching optimization** — `package.json` + `package-lock.json` copied first so the `npm install` layer is only invalidated when dependencies change, not on every source edit.
- **HEALTHCHECK instruction** — polls `/health` every 30 seconds via `wget`. Docker marks the container unhealthy automatically if it fails 3 times, enabling rollback logic to trigger.

### Step 2 — `.dockerignore`

**File:** `.dockerignore`

Created to exclude `node_modules/`, `dist/`, `.git/`, `.github/`, logs, `.env`, `.DS_Store`, docs, and markdown files from the build context. Keeps the build fast and prevents secrets from entering the image by accident.

### Step 3 — Docker Compose

**File:** `compose.yaml`

Created for local development and testing of the production container configuration:

```bash
docker compose up --build    # build and start
docker compose up -d --build # background
docker compose down          # stop
```

Includes a health check (`wget /health`, interval 30s, timeout 5s, 3 retries) that mirrors the Dockerfile HEALTHCHECK. Exposes the app on `http://localhost:8080`.

### Step 4 — Nginx Security Hardening

**File:** `nginx.conf`

The original config only had SPA routing and a `/health` stub. It was hardened with:

- **`server_tokens off`** — removes the Nginx version from error pages and `Server` response headers.
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restricting camera, microphone, and geolocation.
- **Static asset caching** — `Cache-Control: public, immutable` with a 1-year expiry for `.js`, `.css`, `.png`, `.jpg`, `.ico`, `.svg`, `.woff2`. Safe because Vite generates content-hashed filenames.
- **Dotfile blocking** — `location ~ /\.` returns 403, preventing accidental exposure of `.env`, `.git`, etc.
- **Rate limiting zone stub** — `limit_req_zone` defined at the `http` level, not yet applied to any location. Ready for Phase 2 or future backend use without requiring config changes.

> **Note:** Content-Security-Policy was intentionally deferred to Phase 2. Vite-built React apps use inline scripts and styles — adding a strict CSP now would break the application. Phase 2 audits the built output first.

### Step 5 — CI Workflow

**File:** `.github/workflows/ci.yml`

A new CI workflow that runs on every push and pull request to every branch:

1. Checkout → Node.js 20 (with npm cache) → `npm ci` → `npm run build`
2. Lint runs conditionally — only if `scripts.lint` exists in `package.json`, so the workflow doesn't hard-fail on projects without a linter configured.

This catches build and lint regressions on every commit, before anything reaches `main`.

### Step 6 — CD Pipeline Hardening + Automated Rollback

**File:** `.github/workflows/deploy.yml`

The original deploy workflow was a single job with no health checking and unpinned action tags. It was split into three jobs:

**Job 1 — `build-and-push`**
- Actions pinned to commit SHAs (e.g. `actions/checkout@11bd71901...`) to prevent supply chain attacks via tag mutation.
- Least-privilege permissions: `contents: read`, `packages: write` only.
- Multi-tag push: `:latest` + `:sha-<40-char-commit>` + semver (if a git tag exists).
- OCI labels injected via `--build-arg REVISION=${{ github.sha }}`.
- GitHub Actions build cache enabled for faster rebuilds.

**Job 2 — `health-check`**
- Pulls the freshly pushed SHA-tagged image and starts it locally.
- Curls `/health` — validates HTTP 200 and body `"healthy"`.
- Passes `healthy=true/false` as an output to the rollback job.

**Job 3 — `rollback`** *(only runs when `health-check` fails)*
- Queries the GHCR API for the most recent `sha-*` tag that is not the current failing build.
- Re-tags it as `:latest` and pushes.
- Annotates the workflow run with a warning showing which SHA was rolled back to.

```
Push to main
      │
      ▼
  build-and-push ──→ :latest + :sha-<commit> pushed to GHCR
      │
      ▼
  health-check ──→ curl /health → 200 "healthy"?
      │                   │
      │ PASS              │ FAIL
      ▼                   ▼
    done             rollback
                 (re-tags previous sha as :latest)
```

### Step 7 — Dependabot

**File:** `.github/dependabot.yml`

Automated weekly PRs for:
- `npm` dependencies (security patches, minor/major bumps)
- `github-actions` workflow dependencies (ensures SHA pins stay current)

### Step 8 — Operational Scripts

**Files:** `scripts/run-local.sh`, `scripts/healthcheck.sh`

Two helper scripts for day-to-day operations:

```bash
# Build and run the container locally
chmod +x scripts/run-local.sh
./scripts/run-local.sh
# → Running at http://localhost:8080
# → Health: http://localhost:8080/health

# Check the health endpoint
chmod +x scripts/healthcheck.sh
./scripts/healthcheck.sh
# → OK — response: healthy
```

### Step 9 — Documentation

**Files:** `DEPLOYMENT.md`, `docs/blue-green.md`

- **`DEPLOYMENT.md`** — operational guide covering local Docker, Compose, CI/CD pipeline, health check usage, and rollback procedures.
- **`docs/blue-green.md`** — documented blue-green and canary deployment patterns using two named containers (`stans-blue`, `stans-green`) with an Nginx upstream block and a traffic cutover script. No real VPS required to understand the pattern.

---

## Phase 2 — Security Hardening (Person B)

> Goal: add vulnerability scanning, CSP, read-only container hardening, supply chain security, and production security documentation on top of Phase 1's foundation.

### Step 1 — Nginx base image upgrade + CVE patch

**File:** `Dockerfile`

Phase 1 used `nginx:1.25-alpine3.18`. Trivy image scanning flagged **CVE-2024-56171** (libxml2) in Alpine 3.18 which had reached EOL. The runtime stage was upgraded to:

- `nginx:1.30.3-alpine3.23` — current Nginx stable on a fully patched Alpine 3.23 base.
- `apk update && apk upgrade --no-cache` added before package installs to catch any CVEs not yet patched in the base image tag.
- Pre-created `/var/cache/nginx`, `/var/run`, `/tmp` directories owned by `nginx` so tmpfs mounts work correctly with the read-only filesystem.

### Step 2 — Read-only container filesystem

**File:** `compose.yaml`

The container now runs with a fully read-only filesystem. No process inside — including a compromised Nginx or injected code — can write anywhere except three explicitly whitelisted in-memory tmpfs mounts:

```yaml
read_only: true
tmpfs:
  - /var/cache/nginx:uid=101,gid=101   # Nginx proxy/fastcgi cache
  - /var/run:uid=101,gid=101           # Nginx PID file
  - /tmp:uid=101,gid=101               # Temporary file operations
```

Additional hardening added to `compose.yaml`:

- **`cap_drop: ALL`** — all Linux capabilities dropped.
- **`cap_add: NET_BIND_SERVICE`** — only capability added back, required to bind port 80.
- **`no-new-privileges:true`** — prevents any process from gaining new privileges via setuid/setgid binaries.

### Step 3 — Content-Security-Policy header

**File:** `nginx.conf`

Phase 1 deliberately deferred CSP. Person B audited the Vite build output locally with `docker compose up --build` and DevTools open, then added:

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';" always;
```

`unsafe-inline` is required for styles because Vite injects CSS via `<style>` tags at runtime (Tailwind base styles, CSS modules). Scripts are served as content-hashed files from the same origin — no `unsafe-inline` needed there. `frame-ancestors 'none'` replaces `X-Frame-Options` with the modern CSP equivalent.

### Step 4 — Trivy vulnerability scanning

**File:** `.github/workflows/security.yml`

Two scan jobs run on every push, PR, and on a weekly Monday schedule:

**Job 1 — `trivy-fs` (Filesystem scan)**
- Scans the source code and `node_modules` for CRITICAL/HIGH CVEs.
- Trivy binary downloaded directly from GitHub releases (pinned to v0.72.0) — avoids the supply chain risk of `curl | sh`.
- Results uploaded as SARIF to the GitHub Security tab.
- Fails the job on any CRITICAL CVE found.

**Job 2 — `trivy-image` (Image scan)**
- Builds the Docker image from the current commit then scans all image layers.
- Same SARIF upload and CRITICAL failure threshold.
- Catches CVEs introduced by the base image or Alpine packages.

```
Every push / PR / weekly
        │
        ▼
  trivy-fs ──→ scan source + node_modules → SARIF → GitHub Security tab
        │
        ▼
  trivy-image ──→ build image → scan layers → SARIF → GitHub Security tab
```

### Step 5 — CodeQL static analysis

**File:** `.github/workflows/codeql.yml`

GitHub's CodeQL engine runs JavaScript/TypeScript static analysis on every push and PR to `main` and weekly:

- Uses the `security-extended` query suite — covers XSS, prototype pollution, insecure randomness, path traversal, and sensitive data exposure patterns.
- Actions pinned to `github/codeql-action@ff0a06e83cb2...` (v3.28.19).
- Results appear in the **Security → Code scanning** tab on GitHub.

### Step 6 — `.gitignore` secrets hardening

**File:** `.gitignore`

Extended to block accidental commits of credentials and secret files:

- `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.cert`, `*.crt`
- Private key files: `id_rsa`, `id_ed25519`, `id_ecdsa`
- Cloud credential patterns: `.aws/`, `service-account*.json`, `google-services.json`, `firebase*.json`
- `secrets/`, `credentials/` directories

### Step 7 — Security policy document

**File:** `SECURITY.md`

Created a complete security policy covering:
- Supported versions (rolling release on `main`)
- Private vulnerability reporting process via GitHub Security Advisories
- Response timeline (48h acknowledgement → 7 days triage → 30 days patch)
- Summary of all security controls implemented across both phases

### Step 8 — Production security hardening guide

**File:** `docs/security-hardening.md`

Comprehensive documentation covering:
- Read-only filesystem verification and tmpfs mount explanation
- HTTP security header reference with rationale for each
- Trivy and CodeQL usage — running locally, handling false positives, `.trivyignore`
- GitHub Actions SHA pinning explanation and Dependabot maintenance
- Secrets management and incident response (accidental commit procedure)
- Pre-production deployment checklist

---

## Quick Start

**Local development (no Docker):**

**Prerequisites:** Node.js ≥20.19 (required by Vite 8 / rolldown), npm

```bash
npm install
npm run dev
# → http://localhost:5173
```

**Docker (with build args):**

```bash
docker build \
  --build-arg REVISION=$(git rev-parse HEAD) \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -t stans:local .

docker run -d -p 8080:80 --name stans-local stans:local
# → http://localhost:8080
```

**Docker Compose:**

```bash
docker compose up --build
# → http://localhost:8080
```

**Health check:**

```bash
curl http://localhost:8080/health
# → healthy
```

---

## Repository Structure

```
.
├── .dockerignore              # Build context exclusions (Phase 1)
├── .github/
│   ├── dependabot.yml         # Automated dependency updates (Phase 1)
│   └── workflows/
│       ├── ci.yml             # Build validation — all branches/PRs (Phase 1)
│       ├── deploy.yml         # Build → GHCR → health check → rollback (Phase 1)
│       ├── security.yml       # Trivy filesystem + image scanning (Phase 2)
│       └── codeql.yml         # CodeQL JS/TS static analysis (Phase 2)
├── compose.yaml               # Docker Compose — read-only + capability hardening (Phase 2)
├── Dockerfile                 # Multi-stage: node:20-alpine3.20 → nginx:1.30.3-alpine3.23 (Phase 2)
├── DEPLOYMENT.md              # Operational deployment guide (Phase 1)
├── SECURITY.md                # Vulnerability reporting policy (Phase 2)
├── docs/
│   ├── blue-green.md          # Blue-green + canary patterns (Phase 1)
│   └── security-hardening.md  # Security controls reference guide (Phase 2)
├── nginx.conf                 # SPA routing, security headers, CSP, caching (Phase 2)
├── scripts/
│   ├── run-local.sh           # Build + run container locally (Phase 1)
│   └── healthcheck.sh         # Verify /health endpoint (Phase 1)
├── src/                       # React + TypeScript application source
├── public/                    # Static assets
├── package.json
└── vite.config.ts
```

---

## What Was Built — Phase by Phase

### Phase 1 — DevOps (Person A)

**Step 1 — Dockerfile:** Pinned base images (`node:20-alpine3.20` builder, `nginx:1.30.3-alpine3.23` runtime), added OCI labels injected by CI, non-root `appuser:appgroup`, layer caching optimization, and `HEALTHCHECK` polling `/health`.

**Step 2 — .dockerignore:** Excluded `node_modules/`, `dist/`, `.git/`, `.github/`, logs, `.env`, and docs from the build context.

**Step 3 — Docker Compose:** `compose.yaml` created with port 8080:80, health check mirroring the Dockerfile HEALTHCHECK, and `restart: unless-stopped`.

**Step 4 — Nginx hardening:** `server_tokens off`, security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), 1-year immutable cache for static assets, dotfile blocking, and `limit_req_zone` rate limiting stub.

**Step 5 — CI workflow:** `ci.yml` runs on every push and PR — checkout, Node 20, `npm ci`, build, conditional lint and test.

**Step 6 — CD pipeline + rollback:** `deploy.yml` split into three jobs — build/push to GHCR with SHA-pinned actions and multi-tag strategy, post-deploy health check, and automated rollback that re-tags the previous image as `:latest` if the health check fails.

**Step 7 — Dependabot:** Weekly automated PRs for both npm dependencies and GitHub Actions.

**Step 8 — Operational scripts:** `scripts/run-local.sh` and `scripts/healthcheck.sh` for local container build/run and endpoint verification.

**Step 9 — Documentation:** `DEPLOYMENT.md` (operational guide), `docs/blue-green.md` (blue-green and canary patterns), upgraded `README.md`.

---

### Phase 2 — Security (Person B)

**Step 1 — Base image CVE patch:** Upgraded runtime to `nginx:1.30.3-alpine3.23`, fixing CVE-2024-56171 (libxml2) in EOL Alpine 3.18. Added `apk upgrade` to catch unpatched CVEs in future builds.

**Step 2 — Read-only container:** `compose.yaml` hardened with `read_only: true`, tmpfs mounts for `/var/cache/nginx`, `/var/run`, `/tmp`, `cap_drop: ALL` + `cap_add: NET_BIND_SERVICE`, and `no-new-privileges: true`.

**Step 3 — Content-Security-Policy:** CSP header added to `nginx.conf` after auditing the Vite build output locally. `unsafe-inline` for styles only (Vite CSS injection). `frame-ancestors 'none'` replaces `X-Frame-Options`.

**Step 4 — Trivy scanning:** `security.yml` runs filesystem and image scans on every push, PR, and weekly. Trivy pinned to v0.72.0, SARIF results uploaded to GitHub Security tab, fails on CRITICAL CVEs.

**Step 5 — CodeQL analysis:** `codeql.yml` runs JavaScript/TypeScript static analysis with the `security-extended` query suite on every push/PR to `main` and weekly.

**Step 6 — .gitignore hardening:** Extended to block `.env.*`, private keys, certificates, cloud credential files, and secrets directories.

**Step 7 — Security policy:** `SECURITY.md` created with vulnerability reporting process, response timeline, and controls summary.

**Step 8 — Security hardening guide:** `docs/security-hardening.md` covering container hardening, CSP rationale, Trivy/CodeQL usage, SHA pinning, secrets management, and a pre-production checklist.

---

## Not Implemented

Intentionally excluded — no false claims:

| Item | Reason |
|------|--------|
| Kubernetes | Overkill for a static app without a real cluster |
| Terraform | No real VPS to provision |
| Prometheus / Grafana | Overkill for a static Nginx site |
| SSL/TLS | Requires a real domain and server — documented in DEPLOYMENT.md |
| EC2 / VPS deployment | No server provisioned — steps documented in DEPLOYMENT.md |
| CSP without `unsafe-inline` for styles | Vite injects CSS at runtime — a nonce-based approach requires SSR |

---

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Docker, Compose, CI/CD, and rollback procedures
- [SECURITY.md](./SECURITY.md) — Vulnerability reporting policy and security controls
- [docs/blue-green.md](./docs/blue-green.md) — Blue-green and canary deployment patterns
- [docs/security-hardening.md](./docs/security-hardening.md) — Security controls reference and production checklist

---

## License

MIT — see [LICENSE](./LICENSE)
