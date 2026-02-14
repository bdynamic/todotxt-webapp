#!/bin/bash
#
# Docker Compose Update Script
# Checks for updates, pulls new images and restarts containers
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
GIT_UPDATED=false
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
                GIT_UPDATED=true
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

# Get project name using docker compose config
PROJECT_NAME=$($DOCKER_COMPOSE config --format json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || true)
if [ -z "$PROJECT_NAME" ]; then
    # Fallback: use directory name
    PROJECT_NAME=$(basename "$(pwd)")
fi
log "Project name: $PROJECT_NAME"

# Get list of services
mapfile -t SERVICES < <($DOCKER_COMPOSE config --services)
log "Found ${#SERVICES[@]} service(s): ${SERVICES[*]}"

# Temporary files for tracking
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Function to get the image digest a container is running
get_container_image_digest() {
    local service="$1"
    
    # Find container by compose labels (most reliable method)
    local container_id
    container_id=$(docker ps -q \
        --filter "label=com.docker.compose.service=${service}" \
        --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
        2>/dev/null | head -1)
    
    if [ -z "$container_id" ]; then
        echo "NOT_RUNNING"
        return
    fi
    
    # Get the image digest the container was started with
    docker inspect --format='{{.Image}}' "$container_id" 2>/dev/null || echo "UNKNOWN"
}

# Function to get the current image digest (what would be used if container starts now)
get_current_image_digest() {
    local service="$1"
    
    # Get the image name from compose config (handles both 'image:' and 'build:')
    local image_name
    image_name=$($DOCKER_COMPOSE config --format json 2>/dev/null | \
        python3 -c "import sys,json; services=json.load(sys.stdin).get('services',{}); print(services.get('$service',{}).get('image',''))" 2>/dev/null || true)
    
    if [ -z "$image_name" ]; then
        # Service might use 'build:' instead of 'image:'
        echo "BUILD_CONTEXT"
        return
    fi
    
    # Get the digest of this image
    local digest
    digest=$(docker inspect --format='{{.Id}}' "$image_name" 2>/dev/null || echo "NOT_PULLED")
    echo "$digest"
}

# Collect current state
log "Analyzing current state..."
declare -A RUNNING_DIGESTS
declare -A CURRENT_DIGESTS

for service in "${SERVICES[@]}"; do
    RUNNING_DIGESTS[$service]=$(get_container_image_digest "$service")
    CURRENT_DIGESTS[$service]=$(get_current_image_digest "$service")
    
    log "  $service:"
    log "    Running:   ${RUNNING_DIGESTS[$service]:0:20}..."
    log "    Available: ${CURRENT_DIGESTS[$service]:0:20}..."
done

# Check for pre-existing updates (pulled but not applied)
NEEDS_RESTART=false

# If git was updated, we need to rebuild
if [ "$GIT_UPDATED" = true ]; then
    log_success "Git changes detected - rebuild required"
    NEEDS_RESTART=true
fi
for service in "${SERVICES[@]}"; do
    running="${RUNNING_DIGESTS[$service]}"
    available="${CURRENT_DIGESTS[$service]}"
    
    if [ "$running" = "NOT_RUNNING" ]; then
        log_warning "Service $service is not running"
        NEEDS_RESTART=true
    elif [ "$available" = "BUILD_CONTEXT" ]; then
        log "Service $service uses build context (skipping image check)"
    elif [ "$available" = "NOT_PULLED" ]; then
        log_warning "Service $service: image not yet pulled"
        NEEDS_RESTART=true
    elif [ "$running" != "$available" ]; then
        log_warning "Service $service has pending update!"
        NEEDS_RESTART=true
    fi
done

# Pull new images
log "Pulling images..."
if $DOCKER_COMPOSE pull 2>&1; then
    log_success "Pull completed"
else
    log_error "Error during pull"
    exit 1
fi

# Check state after pull
log "Checking for updates after pull..."
for service in "${SERVICES[@]}"; do
    new_digest=$(get_current_image_digest "$service")
    running="${RUNNING_DIGESTS[$service]}"
    old_available="${CURRENT_DIGESTS[$service]}"
    
    if [ "$new_digest" != "$old_available" ] && [ "$new_digest" != "BUILD_CONTEXT" ]; then
        log_success "Service $service: new image pulled!"
        log "  Old: ${old_available:0:20}..."
        log "  New: ${new_digest:0:20}..."
        NEEDS_RESTART=true
    fi
    
    # Also check if running differs from new
    if [ "$running" != "NOT_RUNNING" ] && [ "$new_digest" != "BUILD_CONTEXT" ] && [ "$running" != "$new_digest" ]; then
        NEEDS_RESTART=true
    fi
done

# Restart if needed
if [ "$NEEDS_RESTART" = true ]; then
    log_success "Updates detected - restarting services..."
    
    log "Stopping containers..."
    if $DOCKER_COMPOSE down; then
        log_success "Containers stopped"
    else
        log_error "Error stopping containers"
        exit 1
    fi
    
    # Use --build if git was updated (Dockerfile/entrypoint/etc. may have changed)
    UP_FLAGS="-d"
    if [ "$GIT_UPDATED" = true ]; then
        UP_FLAGS="-d --build"
        log "Rebuilding images due to git changes..."
    fi

    log "Starting containers with updated images..."
    if $DOCKER_COMPOSE up $UP_FLAGS; then
        log_success "Containers started"
    else
        log_error "Error starting containers"
        exit 1
    fi
    
    log "Container status:"
    $DOCKER_COMPOSE ps
    
    log_success "Update completed!"
else
    log_success "All services are up-to-date"
fi

# Optional cleanup
if [ -t 0 ]; then  # Only ask if running interactively
    read -p "Remove unused images? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Removing unused images..."
        docker image prune -f
        log_success "Cleanup completed"
    fi
fi
