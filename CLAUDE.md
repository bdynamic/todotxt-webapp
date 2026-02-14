# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Todo.txt Webapp — a PWA for managing todo.txt task lists with Git-based sync. Built on Express.js + vanilla JS frontend (jQuery, Bootstrap 5). No auth system; intended for intranet/VPN use only.

## General

* Be brief, technically precise, direct, honest, no flattery.
* Keep this file to a rough length of 500 token
* For detailed description generate them in subdir devdocs and just link them here
* Don't be excessive with generating documentation.

## Development Approach

- This is a POC/MVP, NOT an enterprise project
- Start with the simplest solution that works
- Avoid frameworks unless absolutely necessary
- Prefer single-file implementations when feasible
- Hardcode reasonable defaults instead of complex config systems
- Don't add abstractions until genuinely needed
- Skip complex error handling for unlikely edge cases
- Don't optimize prematurely
- If in a git repo commit after each major step

## Running & Building

```bash
# Run via Docker (primary method)
docker-compose up          # foreground with logs
docker-compose up -d       # background
docker-compose logs -f todo-webapp  # view logs

# Run directly (no Docker)
npm install --production
node node-server.js              # HTTP on :5001
node node-server.js --verbose    # verbose request logging
node node-server.js --secure     # HTTPS on :8443 (needs mkcert certs)
```

Access at `http://localhost:5001`.

## Linting

```bash
npx eslint assets/js/*.js assets/js/git/*.js node-server.js lib/*.js
npx stylelint assets/css/todo.css
```

ESLint rules: 2-space indent, unix linebreaks, semicolons required, quotes off. Globals: `$`, `bootstrap`, `i18next`, `showNotification`.

## Architecture

### Backend (`node-server.js` + `lib/git-backend.js`)

Express server serving static files and a REST API under `/api/git/`. The git-backend module uses `simple-git` to manage a local Git repo at `TODO_DATA_DIR` (default `/tmp/tododata`). SSH keys and config stored at `TODO_CONFIG_DIR` (default `~/.config/todotxt-git/`).

Key API routes:
- `GET/POST /api/git/file/:filename` — read/write todo files (writes auto-commit)
- `GET /api/git/files` — list .txt files
- `POST /api/git/sync` — manual push/pull with remote
- `POST /api/git/reset` — hard reset local repo to remote branch
- `GET/POST /api/git/config` — get/update Git settings
- `GET /api/git/history/:filename` — commit history

### Frontend (`index.html` + `assets/js/`)

Single-page app. All JS loaded via `<script>` tags (not bundled). Key modules:

| File | Role |
|------|------|
| `todo.js` | Main init, wires everything together |
| `todo-storage.js` | Core CRUD: add, edit, delete, complete todos |
| `todo-files.js` | Multi-file management (create, rename, delete, switch) |
| `todo-load.js` | Loads/parses todo.txt content from backend |
| `todo-list-display.js` | Renders the todo list to DOM |
| `todo-event-handlers.js` | UI event bindings (clicks, keypresses) |
| `todo-ui.js` | UI helpers (badges, dropdowns, sidebar) |
| `todo-switch.js` | File switching logic |
| `git-sync.js` | Git sync orchestrator |
| `git-sync-coordinator.js` | Debounced sync (3s), conflict resolution |
| `assets/js/git/api.js` | Frontend API client for `/api/git/*` |
| `assets/js/git/ui.js` | Git UI components (status, config modal) |
| `assets/js/git/offline.js` | Offline detection and handling |
| `cache.js` | localStorage-based caching |

### Data Flow

1. User edits a todo → `todo-storage.js` updates in-memory state
2. Change triggers `git-sync-coordinator.js` debounce (3s)
3. After debounce: pull latest → merge → commit → auto-push (if remote configured)
4. File content sent via `POST /api/git/file/:filename`
5. `git-backend.js` writes file, commits, optionally pushes

### Storage

- **Backend**: todo .txt files in `TODO_DATA_DIR`, Git repo at same path
- **Frontend**: `localStorage` for file list, active file name, git sync state, UI preferences
- **Config**: JSON at `TODO_CONFIG_DIR/config.json`, SSH keys at same dir

### Service Worker (`service-worker.js`)

PWA caching for offline support. Cache key: `todotxt-cache-v1-0-2`.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TODO_DATA_DIR` | `/tmp/tododata` | Todo files directory |
| `TODO_CONFIG_DIR` | `~/.config/todotxt-git` | SSH keys and config |
| `DEBUG` | `false` | Enable verbose logging |

## Docker

- Base image: `node:20-alpine` with `git` and `openssh-client`
- Ports: 5001 (HTTP), 8443 (HTTPS optional)
- Source volumes mounted in dev for live reload of frontend assets
- Data at `/tmp/tododata`, config at `/tmp/todoconfig` on host

## Key Libraries

- **jsTodoTxt** (`assets/js/lib/jsTodoTxt.min.js`): Parses todo.txt format
- **simple-git**: Node.js Git operations
- **bootstrap-datepicker**: Date picker with European format support
- **clipboard.js**: Copy-to-clipboard functionality
