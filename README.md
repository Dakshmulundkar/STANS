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
| Web Server | Nginx | 1.25-alpine3.18 |
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

> Starts after Phase 1 is merged. Builds on the foundation laid in Phase 1.

| Work Item | Status |
|-----------|--------|
| Trivy filesystem + image scanning (CI) | ⬜ Upcoming |
| CodeQL static analysis (CI) | ⬜ Upcoming |
| Content-Security-Policy header | ⬜ Upcoming |
| Read-only container filesystem (compose) | ⬜ Upcoming |
| `SECURITY.md` | ⬜ Upcoming |
| `.gitignore` secrets hardening | ⬜ Upcoming |
| `docs/security-hardening.md` (UFW, SSH, Certbot) | ⬜ Upcoming |
| Action SHA pinning audit | ⬜ Upcoming |

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
│       └── deploy.yml         # Build → GHCR → health check → rollback (Phase 1)
├── compose.yaml               # Docker Compose for local testing (Phase 1)
├── Dockerfile                 # Multi-stage: node:20-alpine3.20 → nginx:1.25-alpine3.18 (Phase 1)
├── DEPLOYMENT.md              # Operational deployment guide (Phase 1)
├── docs/
│   └── blue-green.md          # Blue-green + canary patterns (Phase 1)
├── nginx.conf                 # SPA routing, security headers, caching, rate limit stub (Phase 1)
├── scripts/
│   ├── run-local.sh           # Build + run container locally (Phase 1)
│   └── healthcheck.sh         # Verify /health endpoint (Phase 1)
├── src/                       # React + TypeScript application source
├── public/                    # Static assets
├── package.json
└── vite.config.ts
```

---

## Roadmap Checklist

| Requirement | Phase | Status |
|-------------|-------|--------|
| Multi-stage Dockerfile | Phase 1 | ✅ node:20-alpine3.20 → nginx:1.25-alpine3.18 |
| Pinned base image versions | Phase 1 | ✅ |
| OCI image labels | Phase 1 | ✅ Injected by CI |
| Non-root runtime user | Phase 1 | ✅ appuser:appgroup |
| Docker HEALTHCHECK | Phase 1 | ✅ Polls /health |
| `.dockerignore` | Phase 1 | ✅ |
| Docker Compose | Phase 1 | ✅ compose.yaml |
| Nginx static serving + SPA routing | Phase 1 | ✅ |
| Nginx security headers | Phase 1 | ✅ server_tokens off, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| Nginx static asset caching | Phase 1 | ✅ 1y expires + immutable |
| Nginx dotfile blocking | Phase 1 | ✅ |
| Rate limiting stub | Phase 1 | ✅ limit_req_zone defined |
| GitHub Actions CI (all branches) | Phase 1 | ✅ ci.yml |
| GitHub Actions CD (main → GHCR) | Phase 1 | ✅ deploy.yml |
| SHA-pinned GitHub Actions | Phase 1 | ✅ |
| Multi-tag strategy (latest + sha) | Phase 1 | ✅ |
| Post-deploy health check job | Phase 1 | ✅ |
| Automated rollback on failure | Phase 1 | ✅ |
| Dependabot (npm + Actions) | Phase 1 | ✅ |
| Blue-green deployment | Phase 1 | 📄 docs/blue-green.md |
| Canary releases | Phase 1 | 📄 docs/blue-green.md |
| Security scanning (Trivy, CodeQL) | Phase 2 | ⬜ |
| Content-Security-Policy header | Phase 2 | ⬜ |
| Read-only container filesystem | Phase 2 | ⬜ |

✅ Implemented &nbsp;·&nbsp; 📄 Documented/guidance only &nbsp;·&nbsp; ⬜ Not yet implemented

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
| CSP without `unsafe-inline` | Vite builds need inline scripts — Phase 2 will audit and add |
| Security scanning | Phase 2 work (Trivy + CodeQL) |

---

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Docker, Compose, CI/CD, and rollback procedures
- [docs/blue-green.md](./docs/blue-green.md) — Blue-green and canary deployment patterns

---

## License

MIT — see [LICENSE](./LICENSE)
