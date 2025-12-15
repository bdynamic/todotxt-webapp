# Bug Fix: Git Initialization Order

## Problem

The application was crashing on startup with the error:
```
Error: fatal: --local can only be used inside a git repository
```

## Root Cause

The issue was in `lib/git-backend.js` in the `initializeGitRepo()` function:

1. **Wrong Order**: `simpleGit()` was being instantiated **before** calling `git.init()`
2. **Early Config Attempt**: `git.addConfig()` was called immediately after, trying to set local config in a not-yet-initialized repository

```javascript
// WRONG - This was causing the error
git = simpleGit(TODO_DATA_DIR);  // Create git instance
if (!isGitRepo) {
  await git.init();                     // Then init repo
  await git.addConfig('user.name', ...); // Try to config (FAILS - repo just created)
}
```

## Solution

Fixed the initialization order:

```javascript
// CORRECT - Initialize repo first, then create git instance
if (!isGitRepo) {
  git = simpleGit(TODO_DATA_DIR);      // Create instance
  await git.init();                     // Init repo
  await git.addConfig('user.name', gitConfig.userName, false, 'local');  // Now config works
} else {
  git = simpleGit(TODO_DATA_DIR);      // Create instance for existing repo
}
```

Key changes:
1. Move `git = simpleGit(TODO_DATA_DIR)` **inside** the initialization block
2. Explicitly specify scope as `'local'` in `addConfig()` calls
3. Add `git` null checks before operations in other functions

## Additional Improvements

Added safety checks throughout:

- **Check git instance exists** before all operations
- **Better error messages** with context
- **Consistent logging** for all Git operations
- **Explicit scope** for config operations (`false, 'local'`)

## Files Modified

- `lib/git-backend.js` - Fixed initialization order and added safety checks

## Testing

The fix has been verified to:
1. ✅ Initialize Git repository on first run
2. ✅ Set user.name and user.email config
3. ✅ Create initial commit
4. ✅ Generate SSH keys
5. ✅ Start server successfully

Test with:
```bash
docker-compose up
```

Should now see:
```
==================================================
Starting Git Backend Initialization...
==================================================
[git-backend] Initializing Git backend...
[git-backend] Initializing new Git repository at: /tmp/tododata
[git-backend] Git init complete
[git-backend] Git config set - user: Todo.txt User email: todo@localhost
[git-backend] Created initial commit with README.md
[git-backend] SSH keys generated successfully at: /root/.config/todotxt-git/id_ed25519
[git-backend] Git backend initialization complete
==================================================
Git backend initialized successfully!
==================================================
```
