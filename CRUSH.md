# CRUSH.md - Todo.txt Webapp Development Guide

## Build/Run Commands
- Start dev server: `node node-server.js [--verbose]`
- Start HTTPS server: `node node-server.js --secure [--verbose]`
- Access: `http://localhost:5001` or `https://localhost:8443` (secure mode)
- Docker: `docker-compose up -d` (build and run in background)
- Docker logs: `docker-compose logs -f`
- Docker stop: `docker-compose down`

## Code Style

### JavaScript
- ES2021+ with modules (`import`/`export`)
- Strict mode: Always use `'use strict';` at top of files
- Indentation: 2 spaces
- Semicolons: Required
- Quotes: Flexible (no enforcement)
- Line endings: Unix (LF)
- No comments unless necessary for clarity

### Imports
- Group imports logically: external libs, then local modules
- Use named exports/imports for clarity
- Example: `import { functionName } from './module.js';`

### Naming Conventions
- camelCase for variables, functions
- UPPER_CASE for constants (e.g., `DEFAULT_FILE_PATH`)
- Descriptive names (e.g., `generateUniqueId()` not `genId()`)

### Code Organization
- Keep main files (e.g., `todo.js`) minimal - only imports and initialization
- Split complex logic into separate modules (`todo-*.js`)
- DOM elements accessed via jQuery `$()` global

### Error Handling
- Use `console.error()` for errors
- Use `console.warn()` for warnings
- Use `logVerbose()` from `todo-logging.js` for debug messages

## Key Files
- Entry point: `index.html` → `assets/js/todo.js`
- Storage: `todo-storage.js` (localStorage-based for browser, Git for persistence)
- Git Backend: `lib/git-backend.js` (server-side Git operations)
- Git Sync: `assets/js/git/` directory (client-side Git API)
- Config: `.eslintrc.json`, `.stylelintrc.json`

## Git Backend
- Todo data directory: `/tmp/tododata` (or `$TODO_DATA_DIR`)
- SSH keys location: `~/.config/todotxt-git/` (or `$TODO_CONFIG_DIR`)
- Auto-generates SSH keys if missing
- Local commits on every save, optional remote sync
