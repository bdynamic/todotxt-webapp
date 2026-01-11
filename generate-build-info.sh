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
# Check if docker-compose command exists, otherwise try docker compose
if command -v docker-compose &> /dev/null; then
    docker-compose up -d --build
else
    docker compose up -d --build
fi

if [ $? -eq 0 ]; then
    echo "Build complete and containers restarted successfully."
else
    echo "Error: Docker build/restart failed."
    exit 1
fi

