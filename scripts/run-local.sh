#!/bin/bash
# scripts/run-local.sh
# Build and run the STANS container locally for testing.
#
# Usage:
#   chmod +x scripts/run-local.sh
#   ./scripts/run-local.sh
#
# The script will:
#   1. Build a local Docker image tagged stans:local
#   2. Start the container in the background on port 8080
#   3. Print the application and health check URLs

set -euo pipefail

CONTAINER_NAME="stans-local"
IMAGE_TAG="stans:local"
HOST_PORT="8080"

# Remove any existing stans-local container (stopped or running)
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping and removing existing container: ${CONTAINER_NAME}"
    docker rm -f "${CONTAINER_NAME}" > /dev/null
fi

echo "Building Docker image: ${IMAGE_TAG}"
docker build -t "${IMAGE_TAG}" .

echo "Starting container: ${CONTAINER_NAME}"
docker run -d \
    -p "${HOST_PORT}:80" \
    --name "${CONTAINER_NAME}" \
    "${IMAGE_TAG}"

echo ""
echo "Container started successfully."
echo ""
echo "  Application:  http://localhost:${HOST_PORT}"
echo "  Health check: http://localhost:${HOST_PORT}/health"
echo ""
echo "To stop the container:"
echo "  docker stop ${CONTAINER_NAME} && docker rm ${CONTAINER_NAME}"
echo ""
echo "To view logs:"
echo "  docker logs ${CONTAINER_NAME} --tail 50 -f"
