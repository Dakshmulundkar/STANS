# Security Policy

## Supported Versions

STANS follows a rolling-release model on the `main` branch.
Only the latest commit on `main` is actively maintained.

| Version / Branch | Supported          |
| ---------------- | ------------------ |
| `main` (latest)  | ✅ Yes             |
| Older tags       | ❌ No              |

---

## Reporting a Vulnerability

**Please do not open a public GitHub Issue for security vulnerabilities.**

If you discover a security vulnerability in this project, report it privately:

1. Go to the repository on GitHub.
2. Click the **Security** tab → **Advisories** → **Report a vulnerability**.
3. Fill in a description including: affected component, reproduction steps, and potential impact.

You can also email the maintainer directly via the contact listed on the GitHub profile.

### What to expect

| Timeline | Action |
|----------|--------|
| Within 48 hours | Acknowledgement of your report |
| Within 7 days | Initial triage and severity assessment |
| Within 30 days | Patch released (for confirmed vulnerabilities) |
| After patch | Public disclosure coordinated with reporter |

We follow **responsible disclosure** — please give us reasonable time to patch before
publishing details of any vulnerability.

---

## Security Measures in This Project

### Container Security (Phase 2)
- **Read-only filesystem** — the container runs with `read_only: true`; only `/var/cache/nginx`, `/var/run`, and `/tmp` are writable via tmpfs mounts
- **Capability dropping** — all Linux capabilities are dropped; only `NET_BIND_SERVICE` is re-added
- **No privilege escalation** — `no-new-privileges:true` is enforced via security_opt

### HTTP Security Headers
All responses include the following headers (configured in `nginx.conf`):
- `Content-Security-Policy` — restricts script/style/connect sources
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — camera, microphone, and geolocation disabled
- `server_tokens off` — Nginx version not disclosed in headers or error pages

### CI/CD Security (Phase 2)
- **Trivy scanning** — filesystem and image scanned for CRITICAL/HIGH CVEs on every push and weekly
- **CodeQL analysis** — JavaScript/TypeScript static analysis on every push/PR to `main`
- **Pinned action SHAs** — all GitHub Actions are pinned to exact commit SHAs, not mutable tags
- **Least-privilege permissions** — each workflow declares only the permissions it needs

### Secrets Management
- No secrets are committed to this repository
- `.gitignore` is hardened to block common secret file patterns
- GitHub Actions uses `GITHUB_TOKEN` (auto-provisioned, scoped per workflow)

---

## Scope

This security policy covers:
- The application source code in this repository
- The Docker image built from this repository
- The CI/CD workflows in `.github/workflows/`

It does **not** cover third-party dependencies — report those to their respective maintainers.
