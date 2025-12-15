# Git Remote Sync Setup Guide

## Overview

This guide explains how to set up remote Git synchronization to push your todo files to GitHub, GitLab, or any Git hosting service.

## Prerequisites

1. A GitHub, GitLab, or other Git hosting account
2. Todo.txt webapp running with Git sync enabled

## Step-by-Step Setup

### 1. Get Your SSH Public Key

The webapp automatically generates an SSH key pair on first run.

**Get the public key:**

```bash
# Via Docker
docker exec todowebapp cat /root/.config/todotxt-git/id_ed25519.pub

# Or via the UI
# Click the gear icon → Git Settings → Copy the SSH Public Key field
```

You should see something like:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJw... todotxt-git-sync
```

### 2. Add SSH Key to Your Git Hosting Service

#### GitHub

1. Go to https://github.com/settings/keys
2. Click "New SSH key"
3. Title: `Todo.txt Sync`
4. Key type: `Authentication Key`
5. Paste your public key
6. Click "Add SSH key"

#### GitLab

1. Go to https://gitlab.com/-/profile/keys
2. Click "Add new key"
3. Title: `Todo.txt Sync`
4. Paste your public key
5. Click "Add key"

#### Self-Hosted Git

Add the public key to `~/.ssh/authorized_keys` on your Git server.

### 3. Create a Repository

#### GitHub

1. Go to https://github.com/new
2. Repository name: `todo-files` (or any name you prefer)
3. Set to Private (recommended)
4. Do NOT initialize with README
5. Click "Create repository"
6. Copy the SSH URL: `git@github.com:yourusername/todo-files.git`

#### GitLab

1. Go to https://gitlab.com/projects/new
2. Project name: `todo-files`
3. Visibility: Private
4. Do NOT initialize with README
5. Click "Create project"
6. Copy the SSH URL: `git@gitlab.com:yourusername/todo-files.git`

### 4. Configure Remote in the Webapp

**Via UI:**

1. Open the webapp: http://localhost:5001
2. Click the gear icon (⚙️) in the top right
3. Fill in the form:
   - **User Name:** Your name
   - **User Email:** Your email
   - **Remote Repository URL:** `git@github.com:yourusername/todo-files.git`
4. The SSH Public Key is displayed (read-only)
5. Click "Save Configuration"

**Via API:**

```bash
curl -X POST http://localhost:5001/api/git/config \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "Your Name",
    "userEmail": "[email protected]",
    "remoteUrl": "git@github.com:yourusername/todo-files.git"
  }'
```

### 5. Verify Configuration

**Check Git remote:**

```bash
docker exec todowebapp sh -c "cd /tmp/tododata && git remote -v"
```

Should show:
```
origin  git@github.com:yourusername/todo-files.git (fetch)
origin  git@github.com:yourusername/todo-files.git (push)
```

**Check via API:**

```bash
curl -s http://localhost:5001/api/git/status | jq '.status.remotes'
```

### 6. Perform First Sync

**Via UI:**

Click the cloud icon (☁️) in the top right.

**Via API:**

```bash
curl -X POST http://localhost:5001/api/git/sync
```

**Expected output:**

```json
{
  "success": true,
  "message": "Sync completed successfully"
}
```

**On GitHub/GitLab:**

Refresh your repository page - you should see your todo files!

## Troubleshooting

### SSH Key Not Accepted

**Symptom:** Permission denied (publickey)

**Solutions:**

1. **Verify SSH key is added to Git hosting service**
   - Check GitHub: https://github.com/settings/keys
   - Key should show as "Never used" or recent date

2. **Test SSH connection manually:**
   ```bash
   # GitHub
   docker exec todowebapp ssh -T [email protected] -i /root/.config/todotxt-git/id_ed25519 -o StrictHostKeyChecking=no
   
   # GitLab
   docker exec todowebapp ssh -T [email protected] -i /root/.config/todotxt-git/id_ed25519 -o StrictHostKeyChecking=no
   ```
   
   Should say: "Hi username! You've successfully authenticated"

3. **Verify public key matches:**
   ```bash
   # Get fingerprint of your key
   docker exec todowebapp ssh-keygen -lf /root/.config/todotxt-git/id_ed25519.pub
   
   # Compare with GitHub/GitLab key fingerprint
   ```

### Repository Not Found

**Symptom:** Repository not found or access denied

**Solutions:**

1. Verify repository exists and you have access
2. Check repository is not empty (it can be empty for first push)
3. Verify URL format: `git@github.com:username/repo.git` (not HTTPS)

### Push Rejected

**Symptom:** Updates were rejected

**Possible causes:**

1. **Protected branch:**
   - Go to repository settings → Branches
   - Disable branch protection for 'main'

2. **Force push needed (first sync):**
   - This is handled automatically by the sync function
   - Check logs for force push message

### Remote Not Added

**Symptom:** No remote configured after saving config

**Check:**

```bash
# View config file
docker exec todowebapp cat /root/.config/todotxt-git/config.json

# View Git remotes
docker exec todowebapp sh -c "cd /tmp/tododata && git remote -v"
```

**Fix:**

```bash
# Manually add remote (if needed)
docker exec todowebapp sh -c "cd /tmp/tododata && git remote add origin git@github.com:user/repo.git"
```

Or use the test script:
```bash
./test-git-remote.sh
```

## Advanced Configuration

### Change Remote URL

If you need to change the remote repository:

1. **Via UI:** Open Git Settings → Change Remote Repository URL → Save
2. **Via API:**
   ```bash
   curl -X POST http://localhost:5001/api/git/config \
     -H "Content-Type: application/json" \
     -d '{"remoteUrl": "git@github.com:newuser/newrepo.git"}'
   ```

The remote will be updated automatically.

### Manual Git Commands

You can run Git commands manually in the container:

```bash
# Enter the container
docker exec -it todowebapp sh

# Navigate to Git repo
cd /tmp/tododata

# Run any Git command
git status
git log
git remote -v
git push origin main
```

### Multiple Remotes

To add additional remotes (e.g., backup to GitLab too):

```bash
docker exec todowebapp sh -c "cd /tmp/tododata && git remote add gitlab git@gitlab.com:user/repo.git"
docker exec todowebapp sh -c "cd /tmp/tododata && git push gitlab main"
```

## Automated Sync

Currently, remote sync is manual (click cloud icon).

To automate, you could:

1. **Set up a cron job:**
   ```bash
   # Add to container or host
   */15 * * * * curl -X POST http://localhost:5001/api/git/sync
   ```

2. **Or modify the code** to auto-sync after local commits

## Security Considerations

1. **Private Repository:** Use a private repository for your todos
2. **SSH Keys:** The generated SSH key is stored in the Docker volume
3. **Backup Keys:** 
   ```bash
   docker exec todowebapp cat /root/.config/todotxt-git/id_ed25519 > ~/backup-todo-ssh-key
   chmod 600 ~/backup-todo-ssh-key
   ```

4. **Sensitive Data:** Be careful not to commit sensitive info in your todos

## Testing

Run the test script:

```bash
./test-git-remote.sh
```

This will:
- ✓ Check current configuration
- ✓ Test config update via API
- ✓ Verify Git remote is added
- ✓ Show remote info in status

## Next Steps

After setup:

1. ✓ Make changes to your todos
2. ✓ They auto-commit to local Git (after 3 seconds)
3. ✓ Click cloud icon to sync to remote
4. ✓ Your todos are now backed up and accessible from other devices!

To sync FROM another device:
- Set up the webapp on another device/computer
- Configure the same remote repository
- Click cloud icon - it will pull your todos
- Now both devices stay in sync via Git!
