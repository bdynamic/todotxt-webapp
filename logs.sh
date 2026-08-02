#!/bin/bash
#
# Docker Compose Log Viewer
# Shows (and follows) logs of the todo-webapp container for debugging
#
set -euo pipefail

SERVICE="${1:-todo-webapp}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "Neither 'docker compose' nor 'docker-compose' is available!" >&2
    exit 1
fi

cd "$SCRIPT_DIR"
exec $DOCKER_COMPOSE logs -f --tail=200 "$SERVICE"
