# Troubleshooting Guide

## Logging and Debugging

### Enable Verbose Logging

**For local development:**
```bash
DEBUG=true node node-server.js --verbose
```

**For Docker:**
```bash
# Already enabled by default in docker-compose.yml
docker-compose up
```

### View Logs

**Docker logs (live):**
```bash
docker-compose logs -f todo-webapp
```

**Docker logs (last 100 lines):**
```bash
docker-compose logs --tail=100 todo-webapp
```

**Using the debug helper:**
```bash
./debug-docker.sh
```
Then select option 1 for live logs or option 2 for recent logs.

## Common Issues

### 1. Error: "fatal: --local can only be used inside a git repository"

**Status**: ✅ **FIXED** (See BUGFIX.md)

**Symptoms:**
- Server crashes on startup
- Error in logs about `--local` and git repository

**Solution:**
This bug has been fixed in the latest version. The issue was with the Git initialization order.

If you're still seeing this:
1. Pull the latest code
2. Rebuild: `docker-compose build --no-cache`
3. Restart: `docker-compose up`

### 2. Container Starts But No Logs

**Symptoms:**
- `docker-compose up` shows container started but no Git backend initialization logs
- Browser can't connect to http://localhost:5001

**Debug Steps:**
```bash
# Check if container is actually running
docker-compose ps

# Check container logs
docker-compose logs todo-webapp

# Try to access the container
docker exec todowebapp sh -c "echo Container is accessible"

# Check if the server is listening
docker exec todowebapp netstat -tlnp | grep 5001
```

**Common Causes:**
- Server crashed during startup (check logs for errors)
- Port 5001 already in use on host
- Node.js not starting due to missing dependencies

**Solutions:**
```bash
# Rebuild the container
docker-compose down
docker-compose build --no-cache
docker-compose up

# Check host port availability
lsof -i :5001  # On macOS/Linux
netstat -ano | findstr :5001  # On Windows
```

### 2. Git Repository Not Initializing

**Symptoms:**
- API calls fail with "Git not initialized"
- No logs about Git initialization

**Debug Steps:**
```bash
# Check data directory
docker exec todowebapp ls -la /tmp/tododata

# Check for Git
docker exec todowebapp which git

# Try manual Git init
docker exec todowebapp sh -c "cd /tmp/tododata && git init"

# Check permissions
docker exec todowebapp sh -c "ls -la /tmp"
```

**Common Causes:**
- `/tmp/tododata` not writable
- Git not installed in container
- simple-git npm package not installed

**Solutions:**
```bash
# Rebuild with clean cache
docker-compose down
docker-compose build --no-cache
docker-compose up

# Check Dockerfile includes git
grep "apk add.*git" Dockerfile
```

### 3. SSH Key Generation Fails

**Symptoms:**
- Logs show "Failed to generate SSH keys"
- Config modal shows "No key generated"

**Debug Steps:**
```bash
# Check if ssh-keygen is available
docker exec todowebapp which ssh-keygen

# Try manual key generation
docker exec todowebapp ssh-keygen -t ed25519 -f /tmp/test-key -N ""

# Check config directory
docker exec todowebapp ls -la /root/.config/todotxt-git
```

**Common Causes:**
- openssh-client not installed
- Config directory not writable
- Insufficient permissions

**Solutions:**
```bash
# Verify Dockerfile includes openssh-client
grep "apk add.*openssh" Dockerfile

# Check directory permissions
docker exec todowebapp sh -c "mkdir -p /root/.config/todotxt-git && ls -la /root/.config"
```

### 4. API Endpoints Return 500 Errors

**Symptoms:**
- Browser console shows 500 errors
- UI shows "Git sync error"

**Debug Steps:**
```bash
# Test API directly
curl http://localhost:5001/api/git/status

# Check server logs for the error
docker-compose logs todo-webapp | grep ERROR

# Test with verbose output
./debug-docker.sh  # Select option 8 to test API
```

**Common Causes:**
- Git backend not initialized
- File permission issues
- Invalid file paths

**Solutions:**
1. Check server logs for specific error messages
2. Verify Git repo is initialized: `docker exec todowebapp ls /tmp/tododata/.git`
3. Check file permissions: `docker exec todowebapp ls -la /tmp/tododata`

### 5. Files Not Persisting After Restart

**Symptoms:**
- Todo files disappear after container restart
- Git history is lost

**Debug Steps:**
```bash
# Check volume mounts
docker-compose ps
docker inspect todowebapp | grep -A 10 Mounts

# List volumes
docker volume ls
```

**Common Causes:**
- Volumes not properly configured in docker-compose.yml
- Using /tmp which is ephemeral in some systems

**Solutions:**
```bash
# Use named volumes for persistence
# Edit docker-compose.yml to use named volumes instead of /tmp
volumes:
  tododata:/tmp/tododata
  todoconfig:/root/.config/todotxt-git

volumes:
  tododata:
  todoconfig:
```

### 6. Remote Sync Fails

**Symptoms:**
- "Sync failed" message when clicking cloud icon
- SSH authentication errors

**Debug Steps:**
```bash
# Check SSH key
docker exec todowebapp cat /root/.config/todotxt-git/id_ed25519.pub

# Test SSH connection
docker exec todowebapp ssh -T [email protected]

# Check Git remote configuration
docker exec todowebapp sh -c "cd /tmp/tododata && git remote -v"
```

**Common Causes:**
- SSH key not added to Git hosting service
- Invalid remote URL
- Network issues

**Solutions:**
1. Copy public key from config modal
2. Add key to GitHub/GitLab (Settings → SSH Keys)
3. Verify remote URL format: `[email protected]:user/repo.git`
4. Test SSH connection manually

## Getting More Information

### Interactive Debug Shell

```bash
./debug-docker.sh
```

Menu options:
1. **View live logs** - Real-time log streaming
2. **View last 50 lines** - Recent log entries
3. **View all logs** - Complete log history
4. **Check status** - Container and service status
5. **Inspect data directory** - Git repo contents and status
6. **Inspect config directory** - SSH keys and config
7. **Execute shell** - Interactive shell in container
8. **Test API** - Run API endpoint tests
9. **Rebuild** - Clean rebuild and restart

### Manual Testing

**Test server startup:**
```bash
# Without Docker
DEBUG=true node node-server.js --verbose

# Watch the initialization logs
```

**Test Git backend:**
```bash
./test-git-backend.sh
```

**Test API endpoints:**
```bash
# Status
curl http://localhost:5001/api/git/status | jq

# Config
curl http://localhost:5001/api/git/config | jq

# List files
curl http://localhost:5001/api/git/files | jq

# Write file
curl -X POST http://localhost:5001/api/git/file/test.txt \
  -H "Content-Type: application/json" \
  -d '{"content":"Test todo","commitMessage":"Test"}'

# Read file
curl http://localhost:5001/api/git/file/test.txt | jq
```

## Environment Variables

Useful environment variables for debugging:

```bash
# Enable debug logging
DEBUG=true

# Custom data directory
TODO_DATA_DIR=/custom/path/data

# Custom config directory
TODO_CONFIG_DIR=/custom/path/config

# Node environment
NODE_ENV=development
```

## Log Levels

The Git backend logs at different levels:

- `[git-backend]` - Normal operations (always shown)
- `[git-backend:debug]` - Detailed debug info (shown when DEBUG=true)
- `[git-backend:ERROR]` - Error messages (always shown)
- `[API]` - API request logs (shown with --verbose)
- `[API ERROR]` - API error logs (always shown)

## Still Having Issues?

1. **Collect diagnostic information:**
   ```bash
   # Save logs to file
   docker-compose logs todo-webapp > docker-logs.txt
   
   # Get container info
   docker inspect todowebapp > container-info.txt
   
   # Get volume info
   docker volume inspect todo-webapp_todoconfig > volume-info.txt
   ```

2. **Try a clean rebuild:**
   ```bash
   docker-compose down -v  # Remove volumes too
   docker-compose build --no-cache
   docker-compose up
   ```

3. **Check the browser console:**
   - Open Developer Tools (F12)
   - Check Console tab for JavaScript errors
   - Check Network tab for failed API calls

4. **Verify network connectivity:**
   ```bash
   # Test from host
   curl http://localhost:5001
   
   # Test from inside container
   docker exec todowebapp curl http://localhost:5001
   ```
