# STANS — Two-Phase Implementation Plan

**Project:** roadmap.sh — STANS Navigation System Deployment  
**Repo reference:** https://roadmap.sh/projects/stans-navigation-deployment  
**Team split:** Person A → Phase 1 (DevOps) | Person B → Phase 2 (Security)  
**Dependency:** Phase 2 begins after Phase 1 workflows are merged to `main`

---

## What Already Exists (Baseline)

| Item | Status |
|------|--------|
| Multi-stage Dockerfile (Node Alpine → Nginx Alpine) | ✅ Done |
| GitHub Actions CI/CD → GHCR | ✅ Done |
| Gzip + SPA routing in nginx.conf | ✅ Done |
| Dijkstra + A* dual pathfinding | ✅ Done |
| Sine-wave traffic simulation | ✅ Done |
| README with roadmap URL | ✅ Done |
| Prometheus + Grafana (Arnie6502 only) | ✅ Reference only |
| Kubernetes manifests (Arnie6502 only) | ✅ Reference only |
| Terraform IaC (Arnie6502 only) | ✅ Reference only |
| Dark/Light theme (Arnie6502 only) | ✅ Reference only |

---

---

# PHASE 1 — DevOps (Person A)

**Goal:** Harden the container, improve CI/CD pipeline, add local ops tooling, and lay the infrastructure groundwork that Phase 2 will build security scanning on top of.

---

## P1-A — Docker & Container Improvements

### Files to create/modify
- `Dockerfile` (modify existing)
- `.dockerignore` (create)
- `compose.yaml` (create)

### Tasks

**Dockerfile upgrades:**
- Add OCI image labels (`org.opencontainers.image.*`) using build args for `REVISION` and `BUILD_DATE`
- Add non-root runtime user (`addgroup appgroup && adduser appuser`)
- Add `HEALTHCHECK` instruction pointing at `/health`
- Improve layer caching — copy `package.json` + `package-lock.json` before full source copy
- Pin base image versions explicitly (e.g. `node:20-alpine3.19`, `nginx:1.25-alpine3.18`)

**`.dockerignore`** — exclude:
```
node_modules/
dist/
.git/
.github/
*.log
.env
.DS_Store
docs/
*.md
```
Keep: `package.json`, `package-lock.json`, `nginx.conf`, all `src/` files

**`compose.yaml`:**
```yaml
services:
  stans:
    build: .
    ports:
      - "8080:80"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### Extra features from the 10-list applicable here
- **#3 — Automated Rollback:** Add `HEALTHCHECK` in Dockerfile now; Phase 1 CI will use it for rollback logic
- **#4 — Rate Limiting:** Add `limit_req_zone` stub in nginx.conf (safe, non-breaking)

---

## P1-B — Nginx Hardening

### Files to modify
- `nginx.conf`

### Tasks
- Keep SPA fallback routing (`try_files $uri $uri/ /index.html`)
- Add `/health` endpoint returning `200 OK` via `return 200 'healthy'`
- Add security headers (safe set, non-breaking):
  ```nginx
  server_tokens off;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  ```
- Add cache headers for static assets:
  ```nginx
  location ~* \.(js|css|png|jpg|ico|svg|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  ```
- Block dotfile access:
  ```nginx
  location ~ /\. { deny all; }
  ```
- Add `limit_req_zone` stub (rate limiting for future backend use)
- **CSP: skip for now** — inline scripts in Vite/React builds will break without a full audit; document as optional in Phase 2

---

## P1-C — GitHub Actions CI/CD

### Files to create
- `.github/workflows/ci.yml` (new — build validation)
- `.github/workflows/deploy.yml` (modify existing — improve + harden)
- `.github/dependabot.yml` (new)

### `ci.yml` — runs on every push/PR
```
Steps:
1. actions/checkout@v4
2. actions/setup-node@v4 (node 20, cache: npm)
3. npm ci
4. npm run build
5. (lint/test: conditional — only if scripts exist in package.json)
```

### `deploy.yml` improvements
- Add `permissions: contents: read, packages: write` (least privilege)
- Pin all action versions to SHA (e.g. `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`)
- Add multi-tag strategy: `latest` + git SHA + semver tag
- Build with `--label` args passing `REVISION=${{ github.sha }}`
- Add post-push health check job using `docker run` + `curl /health`
- **Automated rollback job:** if health check fails, re-tag previous image as `latest` and push

### `dependabot.yml`
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
```

---

## P1-D — Extra Features (DevOps ones from the 10-list)

| Feature | How to implement | Phase |
|---------|-----------------|-------|
| **#1 Blue-Green Deployment** | Document in `DEPLOYMENT.md` with two container instances + Nginx upstream switch. Script-only, no real VPS needed to merge. | P1 docs |
| **#2 Canary Releases** | `nginx.conf` upstream split with `weight` directive — documented as optional production pattern | P1 docs |
| **#3 Automated Rollback** | GitHub Actions job: on health check failure → `docker pull ghcr.io/.../stans:previous` → retag + push | P1 CI |
| **#4 Rate Limiting** | `limit_req_zone` in nginx.conf | P1 Nginx |

---

## P1-E — Documentation

### Files to create/modify
- `README.md` (major upgrade)
- `DEPLOYMENT.md` (new)
- `docs/blue-green.md` (new — blue-green + canary patterns)
- `scripts/run-local.sh` (new)
- `scripts/healthcheck.sh` (new)

### `README.md` must include
- Project title + description
- Roadmap URL
- Tech stack table
- Local dev (`npm run dev`)
- Docker build + run commands
- Compose usage
- CI/CD pipeline diagram (text-based)
- Health check usage
- Repository structure tree
- Roadmap checklist (honest ✅/⬜)
- "Not implemented" honest section

### `scripts/run-local.sh`
```bash
#!/bin/bash
docker build -t stans:local .
docker run -d -p 8080:80 --name stans-local stans:local
echo "Running at http://localhost:8080"
echo "Health: http://localhost:8080/health"
```

### `scripts/healthcheck.sh`
```bash
#!/bin/bash
curl -sf http://localhost:8080/health && echo "OK" || echo "FAIL"
```

---

## Phase 1 Deliverables Checklist

```
[x] Dockerfile — labels, non-root user, HEALTHCHECK, pinned base (node:20-alpine3.20)
[x] .dockerignore — created
[x] compose.yaml — created
[x] nginx.conf — headers, /health, cache, rate limit stub, dotfile block
[x] .github/workflows/ci.yml — created
[x] .github/workflows/deploy.yml — hardened + rollback
[x] .github/dependabot.yml — created
[x] README.md — upgraded (phased structure, compatibility note added)
[x] DEPLOYMENT.md — created
[x] docs/blue-green.md — created
[x] scripts/run-local.sh — created
[x] scripts/healthcheck.sh — created
```

---

---

# PHASE 2 — Security (Person B)

**Starts after:** Phase 1 merged to `main`  
**Goal:** Add scanning, supply chain hardening, security policies, and server-level hardening guidance on top of Phase 1's foundation.

**Branch convention:** `feature/security-hardening` → PR into `main`

---

## P2-A — GitHub Actions Security Scanning

### Files to create
- `.github/workflows/security.yml`
- `.github/workflows/codeql.yml`

### `security.yml` — Trivy scanning
```
Triggers: push to main, PR, weekly schedule

Jobs:
1. trivy-fs:
   - actions/checkout@v4
   - aquasecurity/trivy-action (filesystem scan)
   - severity: CRITICAL,HIGH
   - format: sarif → upload to GitHub Security tab
   - exit-code: 0 (warn, don't fail build — adjust after baseline)

2. trivy-image:
   - pull image from GHCR (built by Phase 1 deploy.yml)
   - aquasecurity/trivy-action (image scan)
   - severity: CRITICAL
   - format: sarif → upload
   - exit-code: 1 (fail on CRITICAL in image)
```

### `codeql.yml` — static analysis
```
Language: javascript-typescript
Triggers: push to main, PR, weekly schedule
Queries: security-extended
Permissions: actions: read, contents: read, security-events: write
```

### Extra feature from 10-list
- **#5 Docker Image Vulnerability Scanning** — this is exactly Trivy image scan above. Configured to fail CI on CRITICAL CVEs in the final image.

---

## P2-B — Nginx Security Headers (CSP)

### Prerequisite
Phase 1 added safe headers. Person B adds the risky one:

**`nginx.conf` — add CSP after auditing the app's inline scripts:**
```nginx
add_header Content-Security-Policy 
  "default-src 'self'; 
   script-src 'self' 'unsafe-inline'; 
   style-src 'self' 'unsafe-inline'; 
   img-src 'self' data:; 
   font-src 'self'; 
   connect-src 'self';" always;
```

**Process:**
1. Run app locally with `compose.yaml` (from Phase 1)
2. Open browser DevTools → Console → check for CSP violations
3. Tighten or relax directives accordingly
4. Test: `docker build && docker run` → load app → zero console errors → merge

---

## P2-C — Dockerfile Security

### Files to modify
- `Dockerfile` (additions on top of Phase 1)

### Tasks
- Add `--no-cache` to Alpine package installs
- Set `read_only: true` in compose.yaml for runtime container
- Add `tmpfs` mount for Nginx temp dirs (needed when read-only):
  ```yaml
  tmpfs:
    - /tmp
    - /var/cache/nginx
    - /var/run
  ```
- Verify non-root user added in Phase 1 is correct UID (not 0)

---

## P2-D — Supply Chain & Repository Hygiene

### Files to create/modify
- `SECURITY.md` (new)
- `.gitignore` (audit + improve)
- `.github/workflows/deploy.yml` (action SHA pinning audit)

### `SECURITY.md` content
```markdown
# Security Policy

## Supported Versions
| Version | Supported |
|---------|-----------|
| latest (main) | ✅ |

## Reporting a Vulnerability
Open a GitHub Issue with label `security`.
Expected response: within 7 days.
For sensitive issues: use GitHub private vulnerability reporting.

## Security Features Implemented
- Trivy filesystem + image scanning (CI)
- CodeQL static analysis (CI)
- Dependabot for npm + Actions (automated PRs)
- Non-root container runtime
- Nginx security headers
- Read-only container filesystem (compose)
- Action SHA pinning

## Known Limitations
- No HTTPS (local-only; see DEPLOYMENT.md for Certbot guidance)
- CSP in 'unsafe-inline' mode (acceptable for static SPA)
```

### `.gitignore` audit — ensure these are blocked
```
.env
.env.*
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
secrets/
```

### Action SHA pinning
- Audit all workflows from Phase 1
- Replace `@v4` tags with full commit SHAs
- Document pinning rationale in a comment above each action

---

## P2-E — Production Security Hardening Docs

### Files to create
- `docs/security-hardening.md`

### Content
- **UFW firewall setup:**
  ```bash
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw enable
  ```
- **SSH hardening:**
  ```
  PasswordAuthentication no
  PermitRootLogin no
  PubkeyAuthentication yes
  ```
- **Docker deployment from GHCR:**
  ```bash
  docker pull ghcr.io/<user>/stans:latest
  docker run -d --restart=unless-stopped -p 80:80 ghcr.io/<user>/stans:latest
  ```
- **SSL/TLS with Certbot** (future step guidance)
- **Rollback:**
  ```bash
  docker pull ghcr.io/<user>/stans:<previous-sha>
  docker stop stans && docker run -d ... stans:<previous-sha>
  ```
- **Log inspection:**
  ```bash
  docker logs stans --tail 100 -f
  docker exec stans nginx -t
  ```

> Clearly marked: "Guidance only — not a live deployment"

---

## Phase 2 Deliverables

### Step 1 — Trivy Vulnerability Scanning

**Files:** `.github/workflows/security.yml`

Two scan jobs added, triggered on every push, PR, and weekly Monday schedule:

- **`trivy-fs`** — scans source code and `node_modules` for CRITICAL/HIGH CVEs. Trivy binary downloaded directly from GitHub releases pinned to v0.72.0 (no `curl | sh` supply chain risk). Results uploaded as SARIF to GitHub Security tab. Fails on any CRITICAL CVE.
- **`trivy-image`** — builds the Docker image from the current commit, then scans all image layers with the same threshold. Catches CVEs introduced by Alpine packages or base image.

### Step 2 — CodeQL Static Analysis

**File:** `.github/workflows/codeql.yml`

GitHub CodeQL engine runs JavaScript/TypeScript static analysis on every push/PR to `main` and weekly:

- `security-extended` query suite — covers XSS, prototype pollution, path traversal, insecure randomness, and sensitive data exposure.
- Actions pinned to `github/codeql-action@ff0a06e83cb2...` (v3.28.19).
- Results appear in the **Security → Code scanning** tab on GitHub.

### Step 3 — Content-Security-Policy Header

**File:** `nginx.conf`

Audited the Vite build output locally (`docker compose up --build` + DevTools Console) then added:

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

`unsafe-inline` required for styles only — Vite injects CSS via `<style>` tags at runtime. Scripts are content-hashed files served from `'self'` with no eval. `frame-ancestors 'none'` is the CSP-native replacement for `X-Frame-Options`.

### Step 4 — Dockerfile Base Image CVE Patch

**File:** `Dockerfile`

Phase 1 used `nginx:1.25-alpine3.18`. Trivy image scan flagged **CVE-2024-56171** (libxml2) in EOL Alpine 3.18. Upgraded to:

- `nginx:1.30.3-alpine3.23` — current Nginx stable on a fully patched Alpine 3.23 base.
- `apk update && apk upgrade --no-cache` added before package installs to catch CVEs not yet patched in the base image tag.
- Pre-created `/var/cache/nginx`, `/var/run`, `/tmp` directories owned by `nginx` so tmpfs mounts work correctly with the read-only filesystem.

### Step 5 — Read-only Container + Capability Hardening

**File:** `compose.yaml`

Three security controls added on top of Phase 1's compose.yaml:

- **`read_only: true`** — container runs with a fully read-only root filesystem.
- **tmpfs mounts** — only three paths are writable (in-memory, never persisted):
  - `/var/cache/nginx` — Nginx proxy cache
  - `/var/run` — Nginx PID file
  - `/tmp` — temporary file operations
- **`cap_drop: ALL` + `cap_add: NET_BIND_SERVICE`** — all Linux capabilities dropped; only what's needed to bind port 80 is restored.
- **`no-new-privileges: true`** — prevents privilege escalation via setuid/setgid binaries.

### Step 6 — `.gitignore` Secrets Hardening

**File:** `.gitignore`

Extended to block accidental commits of credentials and secret files: `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.cert`, private key files (`id_rsa`, `id_ed25519`), cloud credential patterns (`.aws/`, `service-account*.json`, `google-services.json`), and secrets directories.

### Step 7 — Security Policy Document

**File:** `SECURITY.md`

Created complete security policy covering:
- Supported versions (rolling release on `main`)
- Private vulnerability reporting via GitHub Security Advisories
- Response timeline (48h acknowledgement → 7 days triage → 30 days patch)
- Summary of all security controls implemented across both phases

### Step 8 — Production Security Hardening Guide

**File:** `docs/security-hardening.md`

Comprehensive reference document covering:
- Read-only filesystem verification and tmpfs mount explanation
- HTTP security header reference with rationale for each directive
- Trivy and CodeQL: running locally, handling false positives, `.trivyignore`
- GitHub Actions SHA pinning rationale and Dependabot maintenance
- Secrets management and incident response (accidental commit procedure)
- Pre-production deployment checklist

---

---

# Coordination Points Between Phases

| Handoff | What Phase 2 needs from Phase 1 |
|---------|--------------------------------|
| Trivy image scan | GHCR image must exist and be tagged before security.yml can scan it |
| CSP testing | `compose.yaml` must work so Person B can test locally |
| SHA pinning | All workflow files from Phase 1 must be merged first |
| Read-only container | Non-root user from Phase 1 Dockerfile must be in place |

**Recommended branch strategy:**
```
main
├── feature/p1-docker        (Person A)
├── feature/p1-nginx         (Person A)
├── feature/p1-cicd          (Person A)
└── feature/p2-security      (Person B — starts after P1 merges)
```

---

# Roadmap Requirements Status After Both Phases

| Roadmap Requirement | After Phase 1 | After Phase 2 |
|--------------------|--------------|--------------|
| Multi-stage Dockerfile | ✅ Upgraded | ✅ Hardened |
| Nginx static serving | ✅ Hardened | ✅ CSP added |
| GitHub Actions CI/CD | ✅ Hardened | ✅ + Scanning |
| GHCR publishing | ✅ Multi-tag | ✅ Scanned |
| Health check | ✅ /health + HEALTHCHECK | ✅ |
| Security scanning | ⬜ | ✅ Trivy + CodeQL |
| Supply chain hygiene | ✅ Dependabot | ✅ SHA-pinned (codeql/security workflows) |
| Production guidance | ✅ DEPLOYMENT.md | ✅ docs/security-hardening.md |
| Blue-Green deployment | 📄 Documented | 📄 Documented |
| Canary releases | 📄 Documented | 📄 Documented |
| Automated rollback | ✅ CI job | ✅ |
| Rate limiting | ✅ Nginx stub | ✅ |
| Vulnerability scanning | ⬜ | ✅ Trivy |

✅ = implemented | 📄 = documentation/guidance only | ⬜ = not yet

---

# Honest "Not Implemented" List

These are intentionally excluded — no false claims:

- **Kubernetes** — not needed for static app; reference Arnie6502 if needed
- **Terraform** — no real VPS to provision
- **Prometheus / Grafana** — overkill for static Nginx; not added
- **SSL/TLS** — documented only; requires a real domain + server
- **EC2 / VPS deployment** — documented only; no real server
- **CSP without `unsafe-inline`** — not safe without a full script audit of the built app
- **App features** (#6–#10 from the extra features list) — these are frontend work, separate from DevOps/Security phases
