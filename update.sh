#!/bin/bash
#
# Docker Compose Update Script
# Checks for updates in both Docker images and Git repository
# Rebuilds and restarts containers if changes are detected
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
COMPOSE_DIR="${COMPOSE_DIR:-$(pwd)}"

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

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "Compose file not found: $COMPOSE_FILE"
    exit 1
fi

log "Working with compose file: $COMPOSE_FILE"

# Initialize update flags
DOCKER_UPDATES=false
GIT_UPDATES=false

# Check for Git updates
log "Checking for Git repository updates..."
if [ -d ".git" ]; then
    # Fetch latest changes from remote
    if git fetch origin; then
        log_success "Git fetch completed"
        
        # Check if there are differences between local and remote
        LOCAL=$(git rev-parse @)
        REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
        
        if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
            log_success "Git updates found!"
            GIT_UPDATES=true
            
            # Pull the changes
            log "Pulling Git changes..."
            if git pull; then
                log_success "Git pull completed successfully"
            else
                log_error "Error during git pull"
                exit 1
            fi
        else
            log_warning "No Git updates available - repository is up to date"
        fi
    else
        log_warning "Could not fetch from Git remote - skipping Git check"
    fi
else
    log_warning "Not a Git repository - skipping Git check"
fi

# Pull new Docker images and check for updates
log "Checking for Docker image updates..."
PULL_OUTPUT=$(mktemp)
if $DOCKER_COMPOSE pull 2>&1 | tee "$PULL_OUTPUT"; then
    log_success "Pull completed successfully"
else
    log_error "Error pulling images"
    rm -f "$PULL_OUTPUT"
    exit 1
fi

# Check if updates were downloaded
# Look for "Pull complete" or "Downloaded newer image"
if grep -q "Pull complete\|Downloaded newer image\|Pulled" "$PULL_OUTPUT" && \
   ! grep -q "Image is up to date\|Already exists" "$PULL_OUTPUT" | grep -v "Already exists" > /dev/null; then
    
    # Verify that new layers were actually pulled (not just "Already exists")
    if grep -E "Pull complete|Downloaded newer image" "$PULL_OUTPUT" > /dev/null; then
        log_success "Docker updates found!"
        DOCKER_UPDATES=true
        
        # Show which services were updated
        log "Updated services:"
        grep "Pulled\|Pull complete" "$PULL_OUTPUT" | head -5 || true
    fi
fi

rm -f "$PULL_OUTPUT"

# Check if any updates were found
if [ "$DOCKER_UPDATES" = true ] || [ "$GIT_UPDATES" = true ]; then
    log_success "Changes detected - rebuilding and restarting containers..."
    
    if [ "$DOCKER_UPDATES" = true ]; then
        log "- Docker image updates found"
    fi
    if [ "$GIT_UPDATES" = true ]; then
        log "- Git repository updates found"
    fi
    
    # Stop containers
    log "Stopping containers..."
    if $DOCKER_COMPOSE down; then
        log_success "Containers stopped"
    else
        log_error "Error stopping containers"
        exit 1
    fi
    
    # Rebuild the project
    log "Rebuilding project..."
    if $DOCKER_COMPOSE build; then
        log_success "Project rebuilt successfully"
    else
        log_error "Error rebuilding project"
        exit 1
    fi
    
    # Start containers with updated images
    log "Starting containers with updated configuration..."
    if $DOCKER_COMPOSE up -d; then
        log_success "Containers started successfully"
    else
        log_error "Error starting containers"
        exit 1
    fi
    
    # Show status
    log "Container status:"
    $DOCKER_COMPOSE ps
    
    log_success "Update completed successfully!"
else
    log_warning "No updates available - all images and repository are up to date"
    exit 0
fi

# Optional: Remove old, unused images
read -p "Do you want to remove unused images? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Removing unused images..."
    docker image prune -f
    log_success "Cleanup completed"
fi

