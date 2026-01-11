#!/bin/bash

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
