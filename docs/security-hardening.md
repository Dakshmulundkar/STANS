# STANS — Security Hardening Guide

This document describes every security control implemented in Phase 2 and
explains how to verify, maintain, and extend them in production.

---

## 1. Container Hardening (P2-C)

### Read-only filesystem

The container runs with a read-only root filesystem. This means no process
inside the container — including a compromised Nginx or injected code — can
write anywhere on the filesystem except the explicitly whitelisted tmpfs mounts.

**How it works (`compose.yaml`):**
```yaml
read_only: true
tmpfs:
  - /var/cache/nginx:uid=101,gid=101
  - /var/run:uid=101,gid=101
  - /tmp:uid=101,gid=101
```

Nginx requires these three paths to be writable at runtime:
- `/var/cache/nginx` — proxy and fastcgi cache
- `/var/run` — PID file (`nginx.pid`)
- `/tmp` — temporary file operations

All three are mounted as in-memory tmpfs, so they are writable but:
- Never persisted to disk
- Wiped on container restart
- Limited to RAM (no disk-based exfiltration)

**Verifying it works:**
```bash
docker compose up --build -d
docker exec stans-stans-1 touch /test-write 2>&1
# Expected: touch: /test-write: Read-only file system
```

### Capability dropping

```yaml
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE
```

All Linux capabilities are dropped. Only `NET_BIND_SERVICE` is added back,
which is required to bind port 80 (privileged port < 1024).
This limits what an attacker can do even if they achieve code execution inside the container.

### No privilege escalation

```yaml
security_opt:
  - no-new-privileges:true
```

Prevents any process inside the container from gaining new privileges via
`setuid`/`setgid` binaries or Linux capabilities. Complements capability dropping.

---

## 2. HTTP Security Headers (P2-B)

All headers are set in `nginx.conf` using `add_header ... always;`.
The `always` directive ensures headers are sent even on error responses (4xx, 5xx).

### Content-Security-Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

**Why `unsafe-inline` for styles?**
Vite's React build injects CSS via `<style>` tags at runtime (CSS modules, Tailwind base styles).
Removing `unsafe-inline` for styles would break the UI without a nonce-based approach,
which requires server-side rendering. This is the minimum viable CSP for a pure SPA.

**Tightening this in the future:**
- Add a nonce to inline styles via a server-side proxy or edge function
- Move to a `style-src 'nonce-{random}'` approach
- Use `script-src-elem` and `style-src-elem` for finer-grained control

### Other headers

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-sniffing attacks |
| `X-Frame-Options` | `SAMEORIGIN` | Prevents clickjacking via iframes |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer data sent to third parties |
| `Permissions-Policy` | camera/mic/geo disabled | Prevents browser feature abuse |
| `server_tokens` | `off` | Hides Nginx version from attackers |

**Verifying headers in production:**
```bash
curl -I http://localhost:8080
# All headers above should appear in the response
```

Or use [securityheaders.com](https://securityheaders.com) against a public deployment.

---

## 3. Vulnerability Scanning (P2-A)

### Trivy

Two scan types run on every push, PR, and weekly schedule:

| Scan | What it checks | Failure threshold |
|------|---------------|-------------------|
| Filesystem (`trivy-fs`) | Source code + `node_modules` dependencies | CRITICAL CVEs |
| Image (`trivy-image`) | The built Docker image layers | CRITICAL CVEs |

Results are uploaded as SARIF to the GitHub Security tab (requires `security-events: write` permission).

**Running Trivy locally:**
```bash
# Install Trivy
# https://aquasecurity.github.io/trivy/latest/getting-started/installation/

# Filesystem scan
trivy fs --severity CRITICAL,HIGH .

# Image scan (build first)
docker build -t stans-local .
trivy image --severity CRITICAL,HIGH stans-local
```

**Handling false positives:**
Create a `.trivyignore` file in the repo root:
```
# CVE-YYYY-XXXXX  # reason: not applicable because...
```

### CodeQL

Static analysis runs on pushes/PRs to `main` and weekly.
It uses the `security-extended` query suite, which covers:
- SQL injection, XSS, path traversal
- Prototype pollution
- Insecure randomness
- Sensitive data exposure patterns

Results appear in the **Security → Code scanning** tab on GitHub.

---

## 4. CI/CD Supply Chain Security (P2-D)

### Pinned action SHAs

All GitHub Actions in every workflow file are pinned to a specific commit SHA,
not a mutable tag like `v4`. This prevents supply chain attacks where a
tag is silently moved to point to malicious code.

**Example:**
```yaml
# BAD — tag can be moved to any commit
uses: actions/checkout@v4

# GOOD — pinned to an exact, immutable commit
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
```

**Keeping SHAs up to date:**
Use [Dependabot](../.github/dependabot.yml) (already configured) to automatically
open PRs when new versions of pinned actions are released.

### Least-privilege workflow permissions

Each workflow declares only the permissions it needs:
```yaml
permissions:
  contents: read          # minimum for checkout
  security-events: write  # only where SARIF upload is needed
  packages: write         # only in deploy.yml
```

No workflow uses `permissions: write-all`.

---

## 5. Secrets Management

- No secrets are hardcoded anywhere in this repository
- `.gitignore` is hardened to block accidental commits of `.env.*`, keys, certs, and credential files
- The only secret used in CI is `GITHUB_TOKEN`, which is:
  - Auto-provisioned by GitHub per workflow run
  - Scoped to the permissions declared in the workflow
  - Never stored or logged

**If a secret is accidentally committed:**
1. Rotate the secret immediately — treat it as compromised
2. Use `git filter-repo` to rewrite history and remove the secret
3. Force-push the cleaned history (coordinate with all contributors)
4. Enable GitHub secret scanning alerts to catch future incidents

---

## 6. Production Deployment Checklist

Before deploying to a production environment:

- [ ] Run `trivy image --severity CRITICAL` against the final image — zero CRITICAL CVEs
- [ ] Verify all security headers are present with `curl -I <url>`
- [ ] Confirm the container starts successfully with `read_only: true`
- [ ] Confirm `/health` returns `200 healthy`
- [ ] Confirm CodeQL and Trivy scans pass in GitHub Actions
- [ ] Rotate any secrets that were exposed during development
- [ ] Review Dependabot PRs and merge any pending security updates

---

## References

- [Trivy documentation](https://aquasecurity.github.io/trivy/)
- [CodeQL documentation](https://codeql.github.com/docs/)
- [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Docker security best practices](https://docs.docker.com/build/building/best-practices/)
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
