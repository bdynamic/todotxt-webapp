# Todo.txt Webapp

A Progressive Web Application (PWA) for managing todo.txt tasks list.

This webapp allows to manage tasks using the [todo.txt format](https://github.com/todotxt/todo.txt). It provides a simple web interface to view, add, and manage todo items.

This project utilizes the [jsTodoTxt](https://github.com/jmhobbs/jsTodoTxt) library by jmhobbs for parsing and manipulating todo.txt format. We appreciate the work of jmhobbs and the contributors to jsTodoTxt.

## Help

For detailed instructions on how to use the application's features, please see the [Help](help.md).

![Todo.txt Webapp](screenshots/app_desktop_1_2.png)

## Usage

To use the webapp for development:

1. **Install Node.js dependencies:**

```bash
npm install
```
This command installs the necessary packages for the development server.

2. **Start the development server:**
```bash
node node-server.js [--verbose]
```
This command launches the Node.js server, which will serve the webapp.


3. **Optional: Generate local HTTPS certificates:**
To run the server with HTTPS (required for testing certain PWA features like installability more robustly or features requiring a secure context beyond `localhost`), and assuming `mkcert` is installed, generate the certificate files:
```bash
# Run this in the project's root directory
mkcert localhost 127.0.0.1 ::1
```
This generates `localhost+N.pem` and `localhost+N-key.pem` files in the current directory, which the secure server command will automatically use. Only needed to do this once unless the certificates expire the directory is cleared. It is necessary to run `mkcert -install` once beforehand if you haven't already configured the local CA.

4. **start secure server**
```bash
node node-server.js --secure [--verbose]
```

5. **Open `index.html` in your web browser:**
Once the server is running, you can access the webapp by navigating to the server address in your browser. Typically, this will be `http://localhost:5001` or `https://localhost:8443` if using secure mode.

## Git Sync Backend

This application uses **Git** as the sync backend, replacing the previous Dropbox integration. All todo files are stored in a Git repository with automatic version control.

### Features:
- **Automatic Git commits** on every save
- **SSH key generation** - automatically creates SSH keys on first run
- **Optional remote sync** - push/pull to GitHub, GitLab, or any Git remote
- **Local-first** - works perfectly without any remote repository
- **Version history** - view commit history for each file

### Configuration:

1. **Enable Git Sync:**
   - Click the Git icon in the top-right corner of the webapp
   - This enables automatic commits to the local Git repository

2. **Configure Git Settings (Optional):**
   - Click the gear icon to open Git configuration
   - Set your name and email for commits
   - Configure a remote repository URL (SSH format: `[email protected]:user/repo.git`)
   - Copy the generated SSH public key and add it to your Git hosting service

3. **Data Storage:**
   - Todo files: `/tmp/tododata/` (configurable via `TODO_DATA_DIR` env var)
   - SSH keys: `~/.config/todotxt-git/` (configurable via `TODO_CONFIG_DIR` env var)
   - Git repository: `/tmp/tododata/.git`

4. **Docker Setup:**
   ```bash
   docker-compose up -d
   ```
   The Docker setup automatically:
   - Mounts `/tmp/tododata` for todo files
   - Persists SSH keys in a Docker volume
   - Installs Git and SSH client

### Remote Repository Setup (Optional):

To sync with a remote Git repository (GitHub, GitLab, etc.):

1. Create a repository on your Git hosting service
2. In the webapp, click the gear icon and enter the SSH URL
3. Copy the SSH public key from the config dialog
4. Add the public key to your Git hosting service (Settings → SSH Keys)
5. Click the cloud icon to sync with the remote repository

## Contributing

Contributions to the Todo.txt Webapp project are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
