#!/bin/bash
#
# Docker Compose Update Script
# Pulls git + image updates, rebuilds, and restarts containers
#
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

# Determine COMPOSE_DIR: If script is a symlink, use the symlink's directory
SCRIPT_PATH="$(readlink -f "$0")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"

# If COMPOSE_DIR is not set, use the directory where the script (or symlink) resides
if [ -z "${COMPOSE_DIR:-}" ]; then
    # Get the directory of the actual invocation (follows symlink location)
    INVOCATION_DIR="$(cd "$(dirname "$0")" && pwd)"
    COMPOSE_DIR="$INVOCATION_DIR"
fi

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Check if docker is available
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH!"
    exit 1
fi

# Check if docker compose (v2) or docker-compose (v1) is available
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    log_error "Neither 'docker compose' nor 'docker-compose' is available!"
    exit 1
fi

log "Using: $DOCKER_COMPOSE"

# Change to compose directory
cd "$COMPOSE_DIR"
log "Working directory: $(pwd)"

# Check if compose file exists (or is a symlink)
if [ ! -e "$COMPOSE_FILE" ]; then
    log_error "Compose file not found: $COMPOSE_FILE"
    exit 1
fi

# If it's a symlink, show the target
if [ -L "$COMPOSE_FILE" ]; then
    REAL_FILE=$(readlink -f "$COMPOSE_FILE")
    log "Working with compose file (symlink): $COMPOSE_FILE -> $REAL_FILE"
else
    log "Working with compose file: $COMPOSE_FILE"
fi

# Check if running in a git repo and pull updates
if [ -d ".git" ] || git rev-parse --git-dir &>/dev/null; then
    log "Git repository detected"

    if ! command -v git &> /dev/null; then
        log_warning "Git is not installed - skipping git pull"
    else
        BEFORE_HASH=$(git rev-parse HEAD 2>/dev/null || echo "UNKNOWN")
        log "Current commit: ${BEFORE_HASH:0:12}"

        log "Pulling latest changes from git..."
        if git pull 2>&1; then
            AFTER_HASH=$(git rev-parse HEAD 2>/dev/null || echo "UNKNOWN")
            if [ "$BEFORE_HASH" != "$AFTER_HASH" ]; then
                log_success "Git updated: ${BEFORE_HASH:0:12} -> ${AFTER_HASH:0:12}"

                # This script may itself have changed. Bash buffers the
                # script by file offset as it runs, so continuing here
                # can execute a stale mix of old/new content. Re-exec a
                # fresh process on the updated file instead.
                if [ -z "${UPDATE_SH_REEXECUTED:-}" ]; then
                    log "update.sh changed - re-executing updated script..."
                    export UPDATE_SH_REEXECUTED=1
                    exec "$SCRIPT_PATH" "$@"
                fi
            else
                log "Git repo is already up-to-date"
            fi
        else
            log_warning "Git pull failed - continuing with current version"
        fi
    fi
else
    log "Not a git repository - skipping git pull"
fi

# Pull any pre-built remote images (no-op for build-context-only services)
log "Pulling images..."
$DOCKER_COMPOSE pull 2>&1 || log_warning "Pull skipped or failed for some services"

# Build + (re)start. Compose rebuilds via Docker's own layer cache (cheap
# no-op when nothing changed) and only recreates containers whose
# resulting image or config actually differs - no need to hand-roll that
# detection here.
log "Building and starting containers..."
if $DOCKER_COMPOSE up -d --build; then
    log_success "Containers up to date"
else
    log_error "Error starting containers"
    exit 1
fi

log "Container status:"
$DOCKER_COMPOSE ps

# Optional cleanup
if [ -t 0 ]; then  # Only ask if running interactively
    read -p "Remove unused images? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Removing unused images..."
        docker image prune -f | grep -i "^Total reclaimed space"
        log_success "Cleanup completed"
    fi
fi

# Report which git commit the current source (and thus the image, for
# build-context services) is based on
if git rev-parse HEAD &>/dev/null; then
    CURRENT_COMMIT=$(git rev-parse HEAD)
    CURRENT_COMMIT_SUBJECT=$(git log -1 --pretty=%s 2>/dev/null || echo "")
    log_success "Image based on commit: ${CURRENT_COMMIT:0:12} - ${CURRENT_COMMIT_SUBJECT}"
fi
