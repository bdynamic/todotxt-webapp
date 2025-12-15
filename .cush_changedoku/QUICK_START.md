# Quick Start Guide

## 🚀 Running the Application

### Option 1: Docker (Recommended)

```bash
# Start with visible logs (recommended for first run)
docker-compose up

# Or start in background
docker-compose up -d

# View logs
docker-compose logs -f todo-webapp

# Stop
docker-compose down
```

**Access:** http://localhost:5001

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Start server with verbose logging
./start-server.sh

# Or manually
DEBUG=true node node-server.js --verbose
```

**Access:** http://localhost:5001

## 🔍 Debugging

### Quick Debug Menu
```bash
./debug-docker.sh
```
Interactive menu with options to:
- View logs
- Inspect Git repository
- Test API endpoints
- Execute shell in container

### View Logs
```bash
# Docker (live)
docker-compose logs -f todo-webapp

# Docker (last 50 lines)
docker-compose logs --tail=50 todo-webapp

# Local
# Logs print to console when running with --verbose
```

### Test Git Backend
```bash
./test-git-backend.sh
```

## ⚙️ Configuration

### Enable Git Sync

1. Open http://localhost:5001
2. Click the **Git icon** (top right) to enable sync
3. Click the **Gear icon** to configure (optional)

### Set Up Remote Sync (Optional)

1. Click **Gear icon** → Git Settings
2. Fill in:
   - User Name: `Your Name`
   - User Email: `[email protected]`
   - Remote URL: `[email protected]:username/repo.git`
3. Copy the **SSH Public Key**
4. Add key to GitHub/GitLab:
   - GitHub: Settings → SSH and GPG keys → New SSH key
   - GitLab: Preferences → SSH Keys → Add new key
5. Click **Cloud icon** to sync

## 📁 Data Locations

### Docker
- **Todo files:** `/tmp/tododata/*.txt`
- **Git repo:** `/tmp/tododata/.git`
- **SSH keys:** Docker volume `todoconfig`
- **Config:** Docker volume `todoconfig`

### Local
- **Todo files:** `/tmp/tododata/*.txt`
- **Git repo:** `/tmp/tododata/.git`
- **SSH keys:** `~/.config/todotxt-git/id_ed25519`
- **Config:** `~/.config/todotxt-git/config.json`

## 🛠️ Common Commands

### Docker

```bash
# Start
docker-compose up

# Start in background
docker-compose up -d

# Stop
docker-compose down

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up

# View logs
docker-compose logs -f todo-webapp

# Shell access
docker exec -it todowebapp sh

# Check Git repo
docker exec todowebapp sh -c "cd /tmp/tododata && git log --oneline"
```

### Local Development

```bash
# Start with logging
./start-server.sh

# Start with debug
DEBUG=true node node-server.js --verbose

# Test backend
./test-git-backend.sh

# Debug helper
./debug-docker.sh
```

## 🔧 API Endpoints

Test the Git backend API:

```bash
# Get status
curl http://localhost:5001/api/git/status

# Get config and SSH key
curl http://localhost:5001/api/git/config

# List files
curl http://localhost:5001/api/git/files

# Read a file
curl http://localhost:5001/api/git/file/todo.txt

# Write a file
curl -X POST http://localhost:5001/api/git/file/test.txt \
  -H "Content-Type: application/json" \
  -d '{"content":"(A) Test item","commitMessage":"Test commit"}'

# Get file history
curl http://localhost:5001/api/git/history/todo.txt
```

## ✅ Verify Installation

1. **Start the server:**
   ```bash
   docker-compose up
   ```

2. **Look for these log messages:**
   ```
   ==================================================
   Starting Git Backend Initialization...
   ==================================================
   [git-backend] Initializing Git backend...
   [git-backend] TODO_DATA_DIR: /tmp/tododata
   [git-backend] CONFIG_DIR: /root/.config/todotxt-git
   [git-backend] Initializing new Git repository at: /tmp/tododata
   [git-backend] SSH keys already exist at: /root/.config/todotxt-git/id_ed25519
   [git-backend] Git backend initialization complete
   ==================================================
   Git backend initialized successfully!
   ==================================================
   Server running at http://localhost:5001
   ```

3. **Test the UI:**
   - Open http://localhost:5001
   - Click Git icon (should toggle enabled/disabled)
   - Click Gear icon (should show config modal with SSH key)
   - Add a todo item (should auto-commit to Git)

4. **Verify Git commits:**
   ```bash
   docker exec todowebapp sh -c "cd /tmp/tododata && git log --oneline"
   ```

## 🆘 Troubleshooting

### No logs showing?
```bash
# Ensure DEBUG is enabled
docker-compose down
# Edit docker-compose.yml: ensure DEBUG=true is set
docker-compose up
```

### Container won't start?
```bash
# Check status
docker-compose ps

# View logs
docker-compose logs todo-webapp

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Git not working?
```bash
# Check if Git is initialized
docker exec todowebapp ls -la /tmp/tododata/.git

# Check SSH keys
docker exec todowebapp ls -la /root/.config/todotxt-git

# Use debug menu
./debug-docker.sh
# Select option 5 (Inspect Git data) and 6 (Inspect config)
```

### Still stuck?
See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

## 📚 More Documentation

- [README.md](README.md) - Full documentation
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Detailed troubleshooting
- [MIGRATION.md](MIGRATION.md) - Migration from Dropbox
- [GIT_BACKEND_SUMMARY.md](GIT_BACKEND_SUMMARY.md) - Technical details
- [CRUSH.md](CRUSH.md) - Development guide
