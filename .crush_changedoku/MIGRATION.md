# Migration from Dropbox to Git Backend

This document explains the migration from Dropbox sync to Git-based sync.

## What Changed

### Removed:
- Dropbox OAuth integration
- `assets/js/dropbox/` directory (auth.js, api.js, ui.js, offline.js, config.js)
- `assets/js/dropbox-sync.js`
- Dropbox SDK dependency
- Dropbox conflict resolution modal

### Added:
- `lib/git-backend.js` - Server-side Git operations using simple-git
- `assets/js/git/` directory - Client-side Git API modules
  - `git/api.js` - REST API calls to backend
  - `git/ui.js` - UI status updates and modals
  - `git/offline.js` - Offline handling
  - `git/config.js` - Configuration constants
- `assets/js/git-sync.js` - Main Git sync initialization
- `assets/js/git-sync-coordinator.js` - Sync coordination logic
- Git configuration modal in HTML
- SSH key generation and management

## Architecture Changes

### Before (Dropbox):
```
Browser (localStorage) <---> Dropbox API (OAuth) <---> Dropbox Cloud
```

### After (Git):
```
Browser (localStorage) <---> Node.js Server <---> Local Git Repo <---> Remote Git (optional)
                              REST API            /tmp/tododata/.git
```

## API Endpoints

The server now exposes these Git-related endpoints:

- `GET /api/git/status` - Get Git repository status
- `GET /api/git/config` - Get Git configuration and SSH public key
- `POST /api/git/config` - Update Git configuration
- `GET /api/git/files` - List all .txt files in repository
- `GET /api/git/file/:filename` - Read file content and last commit
- `POST /api/git/file/:filename` - Write file and create commit
- `POST /api/git/rename` - Rename file with Git mv
- `DELETE /api/git/file/:filename` - Delete file with Git rm
- `GET /api/git/history/:filename` - Get commit history
- `POST /api/git/sync` - Sync with remote repository

## Data Migration

### If you were using Dropbox:

1. **Export your data from the webapp:**
   - Open the webapp while still using Dropbox
   - For each todo file, copy the content

2. **Upgrade to Git version:**
   - Pull the latest code
   - Run `npm install` to get simple-git dependency
   - Start the server: `node node-server.js`

3. **Import your data:**
   - In the webapp, enable Git sync (click Git icon)
   - Create files and paste your todo content
   - Data is automatically committed to Git

4. **Optional - Set up remote sync:**
   - Click the gear icon
   - Configure your remote repository
   - Add the SSH key to your Git hosting service
   - Click the cloud icon to push to remote

## Configuration Files

### Dropbox (old):
- `assets/js/dropbox/config.js` - Client ID and redirect URI
- `localStorage` - Access tokens

### Git (new):
- `~/.config/todotxt-git/config.json` - Git user info and remote URL
- `~/.config/todotxt-git/id_ed25519` - SSH private key (auto-generated)
- `~/.config/todotxt-git/id_ed25519.pub` - SSH public key
- `localStorage.gitSyncEnabled` - Whether Git sync is enabled

## Benefits of Git Backend

1. **Version Control** - Full commit history for every change
2. **Offline First** - Works completely offline, sync when ready
3. **Self-Hosted** - No dependency on external OAuth services
4. **Flexible Remotes** - Use any Git hosting (GitHub, GitLab, self-hosted)
5. **Standard Tools** - Can use git CLI to inspect/manage repository
6. **SSH Keys** - More secure than OAuth tokens in localStorage
7. **Merge Tools** - Can use standard Git merge tools for conflicts

## Troubleshooting

### SSH Key Issues
- Keys are auto-generated on first run
- Located at `~/.config/todotxt-git/id_ed25519`
- Public key shown in Git config modal
- Must add public key to Git hosting service before remote sync

### Permission Issues
- Ensure `/tmp/tododata` is writable
- Check `~/.config/todotxt-git/` permissions

### Git Not Found
- Install Git: `apt-get install git` or `apk add git`
- Docker image includes Git automatically

### Remote Sync Fails
- Verify SSH key is added to Git hosting service
- Check remote URL format: `[email protected]:user/repo.git`
- Ensure repository exists on remote
- Check network connectivity
