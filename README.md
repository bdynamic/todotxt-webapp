# Todo.txt Webapp

A Progressive Web Application (PWA) for managing todo.txt tasks list.

This webapp allows to manage tasks using the [todo.txt format](https://github.com/todotxt/todo.txt). It provides a simple web interface to view, add, and manage todo items.

This project utilizes the [jsTodoTxt](https://github.com/jmhobbs/jsTodoTxt) library by jmhobbs for parsing and manipulating todo.txt format. We appreciate the work of jmhobbs and the contributors to jsTodoTxt.

## Help

For detailed instructions on how to use the application's features, please see the [Help](help.md).

![Todo.txt Webapp](screenshots/app_desktop_1_2.png)

## Usage

This project aims to be deployed via Docker. The recommended way to run the application is using Docker Compose.
- clone the project
- Adjust the docker-compose.yaml. (tododata dir and todoconfig)
- Start Docker

```bash
# Start with logs visible
docker-compose up

# Or start in background
docker-compose up -d

# View logs
docker-compose logs -f todo-webapp
```
Access the webapp at `http://localhost:5001`.

**Warning:** This Project has no user Managment and authentication. Use it only in your Intranet, via VPN, etc. Don't open ports to the Internet!

## Git Sync Backend

This application uses **Git** as the sync backend, replacing the previous Dropbox integration. All todo files are stored in a Git repository with automatic version control.

### Features:
- **Pull-before-write workflow** - always pulls latest before committing changes
- **Automatic Git commits** on every save (debounced 3 seconds)
- **Intelligent merging** - handles concurrent changes from multiple sources
- **SSH key generation** - automatically creates SSH keys on first run
- **Optional remote sync** - push/pull to GitHub, GitLab, or any Git remote
- **Local-first** - works perfectly without any remote repository
- **Version history** - view commit history for each file

### How It Works:
1. When you make a change, it's marked as "pending"
2. After 3 seconds (debounce), the sync process starts:
   - **Step 1:** Pull latest version from Git
   - **Step 2:** Merge with local changes if needed
   - **Step 3:** Commit to local Git
   - **Step 4:** **Auto-push to remote** (if configured)
3. When switching files, the latest version is pulled automatically

**Auto-Push:** Once you configure a remote repository, all commits automatically push to it. No need to manually click the cloud icon!

### Configuration:

1. **Enable Git Sync:**
   - Click the Git icon in the top-right corner of the webapp
   - This enables automatic commits to the local Git repository

2. **Configure Git Settings (Optional):**
   - Click the gear icon to open Git configuration
   - Set your name and email for commits
   - Configure a remote repository URL (SSH format: `git@github.com:user/repo.git`)
   - Copy the generated SSH public key and add it to your Git hosting service

3. **Data Storage:**
   - Todo files: `/tmp/tododata/` (configurable via `TODO_DATA_DIR` env var)
   - SSH keys: `~/.config/todotxt-git/` (configurable via `TODO_CONFIG_DIR` env var)
   - Git repository: `/tmp/tododata/.git`

4. **Docker Setup:**
   ```bash
   # Start with logs visible
   docker-compose up
   
   # Or start in background
   docker-compose up -d
   
   # View logs
   docker-compose logs -f todo-webapp
   
   # Interactive debugging
   ./debug-docker.sh
   ```
   
   The Docker setup automatically:
   - Mounts `/tmp/tododata` for todo files
   - Persists SSH keys in a Docker volume
   - Installs Git and SSH client
   - Enables verbose logging by default

### Remote Repository Setup (Optional):

To sync with a remote Git repository (GitHub, GitLab, etc.):

1. **Get SSH Key:**
   ```bash
   docker exec todowebapp cat /root/.config/todotxt-git/id_ed25519.pub
   ```
   Or view in UI: Click gear icon → Copy SSH Public Key

2. **Add SSH Key to GitHub/GitLab:**
   - GitHub: https://github.com/settings/keys → New SSH key
   - GitLab: https://gitlab.com/-/profile/keys → Add new key
   - Paste the public key and save

3. **Create Repository:**
   - Create a new private repository
   - Copy the SSH URL (e.g., `git@github.com:username/todo-files.git`)

4. **Configure in Webapp:**
   - Click gear icon (⚙️)
   - Enter User Name, Email, and Remote Repository URL
   - Click "Save Configuration"
   - Remote is automatically added to Git

5. **Automatic Sync:**
   - After setup, all commits **automatically push** to remote
   - No need to click cloud icon (it's for manual sync/pull)
   - Your todos are continuously backed up!

**Manual Sync:** Click cloud icon (☁️) to force push/pull

**Detailed Guide:** See [GIT_REMOTE_SETUP.md](GIT_REMOTE_SETUP.md) for complete setup instructions and troubleshooting.

To sync with a remote Git repository (GitHub, GitLab, etc.):

1. **Get SSH Key:**
   ```bash
   docker exec todowebapp cat /root/.config/todotxt-git/id_ed25519.pub
   ```
   Or view in UI: Click gear icon → Copy SSH Public Key

2. **Add SSH Key to GitHub/GitLab:**
   - GitHub: https://github.com/settings/keys → New SSH key
   - GitLab: https://gitlab.com/-/profile/keys → Add new key
   - Paste the public key and save

3. **Create Repository:**
   - Create a new private repository
   - Copy the SSH URL (e.g., `git@github.com:username/todo-files.git`)

4. **Configure in Webapp:**
   - Click gear icon (⚙️)
   - Enter User Name, Email, and Remote Repository URL
   - Click "Save Configuration"
   - Remote is automatically added to Git

5. **Automatic Sync:**
   - After setup, all commits **automatically push** to remote
   - No need to click cloud icon (it's for manual sync/pull)
   - Your todos are continuously backed up!

**Manual Sync:** Click cloud icon (☁️) to force push/pull

**Detailed Guide:** See [GIT_REMOTE_SETUP.md](GIT_REMOTE_SETUP.md) for complete setup instructions and troubleshooting.

## Troubleshooting

If you encounter issues, run the interactive debug helper:

```bash
./debug-docker.sh
```

For common issues:
- **Items disappearing?** See [DEBUG_GIT_SYNC.md](DEBUG_GIT_SYNC.md)
- **Git sync not working?** See [FIXES_SUMMARY.md](FIXES_SUMMARY.md)
- **Other issues?** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Contributing

Contributions to the Todo.txt Webapp project are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Thanks
* Huge thanks got to azimonti for the great basis he created for this adaptation: [https://github.com/azimonti/todotxt-webapp](https://github.com/azimonti/todotxt-webapp)
* Equal thanks go to [Crush](https://github.com/charmbracelet/crush) who made those chanes (in a reasonable time) possible (yes via Vibe Coding) 

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
   
