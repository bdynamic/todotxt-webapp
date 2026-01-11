#!/bin/bash

echo "Starting build process..."

# 1. Pull latest changes
echo "Pulling latest changes from Git..."
git pull
if [ $? -ne 0 ]; then
    echo "Error: Git pull failed."
    exit 1
fi

# 2. Generate Build Info
# Get git hash (short)
GIT_HASH=$(git rev-parse --short HEAD)

# Get current date (UTC)
BUILD_DATE=$(date -u +"%Y-%m-%d %H:%M UTC")

# Path to version.json
VERSION_FILE="data/json/version.json"
VERSION="1.2.0" # Default fallback

if [ -f "$VERSION_FILE" ]; then
  # Extract version using grep/sed/awk since we might not have jq
  # Assuming simple json: { "version" : "1.2.0" }
  EXISTING_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$VERSION_FILE" | cut -d'"' -f4)
  if [ ! -z "$EXISTING_VERSION" ]; then
    VERSION="$EXISTING_VERSION"
  fi
fi

# Write new json
cat <<EOF > "$VERSION_FILE"
{
  "version": "$VERSION",
  "gitHash": "$GIT_HASH",
  "buildDate": "$BUILD_DATE"
}
EOF

echo "Updated $VERSION_FILE with Hash: $GIT_HASH, Date: $BUILD_DATE"

# 3. Rebuild and Restart Docker Containers
echo "Rebuilding and restarting Docker containers..."

# Helper function to try docker compose v2
try_docker_compose_v2() {
    if docker compose version &> /dev/null; then
        echo "Using 'docker compose' (V2)..."
        docker compose up -d --build
        return $?
    fi
    return 1
}

# Helper function to try legacy docker-compose
try_legacy_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        echo "Using legacy 'docker-compose'..."
        # Workaround for KeyError: 'ContainerConfig' with newer Docker Engine
        echo "Shutting down existing containers to prevent compatibility issues..."
        docker-compose down --remove-orphans
        docker-compose up -d --build
        return $?
    fi
    return 1
}

# Try V2 first, then legacy
if try_docker_compose_v2; then
    EXIT_CODE=0
elif try_legacy_docker_compose; then
    EXIT_CODE=0
else
    echo "Error: Neither 'docker compose' nor 'docker-compose' found."
    EXIT_CODE=1
fi

if [ $EXIT_CODE -eq 0 ]; then
    echo "Build complete and containers restarted successfully."
else
    echo "Error: Docker build/restart failed."
    exit 1
fi

