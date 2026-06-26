#!/bin/bash
# scripts/healthcheck.sh
# Verify the STANS application health endpoint is responding correctly.
#
# Usage:
#   chmod +x scripts/healthcheck.sh
#   ./scripts/healthcheck.sh
#
# Exits with code 0 and prints "OK" on success.
# Exits with code 1 and prints "FAIL" on any failure.
#
# Optional: override the URL with an environment variable
#   HEALTH_URL=http://localhost:9090/health ./scripts/healthcheck.sh

set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://localhost:8080/health}"

echo "Checking: ${HEALTH_URL}"

if curl -sf "${HEALTH_URL}" > /dev/null 2>&1; then
    BODY=$(curl -s "${HEALTH_URL}")
    echo "OK — response: ${BODY}"
    exit 0
else
    echo "FAIL — no response or non-2xx status from ${HEALTH_URL}"
    exit 1
fi
