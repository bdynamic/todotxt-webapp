# Debugging Git Sync Issues

## Problem: Items Disappearing After Adding

### Steps to Debug

1. **Open Browser Console** (F12 → Console tab)

2. **Add a todo item** and watch the console output. You should see:

```
[todo-storage] Adding todo: (A) Test item
[todo-storage] Todo added and saved. Total todos: 1
[todo-storage] Saving 1 todos to localStorage for /todo.txt
[todo-storage] Dispatching localDataChanged event for /todo.txt
[git-sync] Starting sync for todo.txt, pending: true
[git-sync] Step 1: Pull latest from Git for todo.txt
[git-sync] Git content (X chars): ...
[git-sync] Local content (Y chars, 1 todos): (A) Test item
[git-sync] Step 2a: Pending changes detected. Checking for conflicts...
[git-sync] Step 2c: Writing local version to Git...
[API] POST /api/git/file/todo.txt
[git-backend] Writing file: todo.txt (X bytes)
[git-backend] Committed todo.txt: abc1234 - Update todo.txt
[git-sync] Successfully committed local changes to todo.txt
```

3. **Check if item persists in localStorage:**

```javascript
// In browser console
JSON.parse(localStorage.getItem('todos_/todo.txt'))
```

Should show your todos with `{id: "...", text: "..."}` structure.

4. **Check if item was committed to Git:**

```bash
# In terminal
docker exec todowebapp sh -c "cd /tmp/tododata && cat todo.txt"
docker exec todowebapp sh -c "cd /tmp/tododata && git log --oneline -5"
```

Should show your todo in the file and a recent commit.

## Common Issues

### Issue 1: Event Not Firing

**Symptom:** No `[git-sync]` logs appear after adding todo

**Check:**
```javascript
// In browser console - check if Git sync is enabled
localStorage.getItem('gitSyncEnabled')
// Should return "true"
```

**Fix:** Click the Git icon in the UI to enable sync.

### Issue 2: localStorage Not Saving

**Symptom:** `[todo-storage]` logs show saving but item disappears

**Check:**
```javascript
// Check what's in storage
localStorage.getItem('todos_/todo.txt')
```

**Possible causes:**
- Browser in private/incognito mode
- localStorage quota exceeded
- Browser extension blocking storage

### Issue 3: Git Not Committing

**Symptom:** Logs show "Writing to Git" but no commit appears

**Check server logs:**
```bash
docker-compose logs -f todo-webapp
```

Look for:
```
[API] POST /api/git/file/todo.txt
[git-backend] Writing file: todo.txt (X bytes)
[git-backend] Committed todo.txt: abc1234
```

**If you see errors:**
- Git not initialized: Check `[git-backend] Git backend initialization complete`
- Permission error: Check `/tmp/tododata` permissions
- Commit failed: Check Git user config

### Issue 4: Content Mismatch

**Symptom:** Item added but different content appears

**Check:**
```bash
# Compare localStorage vs Git
docker exec todowebapp sh -c "cd /tmp/tododata && cat todo.txt"
```

Then in browser console:
```javascript
JSON.parse(localStorage.getItem('todos_/todo.txt')).map(t => t.text).join('\n')
```

Should match.

## Manual Testing

### Test 1: Add Item

1. Add todo: `(A) Test item +project @context`
2. Wait 3 seconds
3. Check console for commit logs
4. Refresh page
5. Item should still be there

### Test 2: Add Multiple Items

1. Add 3 items quickly
2. Wait 3 seconds
3. Should see one commit with all 3 items
4. Refresh page
5. All 3 should persist

### Test 3: External Change

1. Add item in Git:
```bash
docker exec todowebapp sh -c "echo '(B) External test' >> /tmp/tododata/todo.txt && cd /tmp/tododata && git add todo.txt && git commit -m 'External change'"
```

2. In browser, switch to another file and back
3. Should see the external item appear

### Test 4: Concurrent Changes

1. Add item in browser: `(A) Browser item`
2. While debounce is waiting (within 3 seconds), add in Git:
```bash
docker exec todowebapp sh -c "echo '(B) Git item' >> /tmp/tododata/todo.txt && cd /tmp/tododata && git add todo.txt && git commit -m 'Git change'"
```

3. After debounce, browser item should be committed
4. Both items should exist

## Enable Extra Logging

### Browser Console Filters

Set filter to show only sync logs:
```
git-sync
```

Or show all storage and sync:
```
todo-storage git-sync
```

### Server Verbose Logging

Already enabled by default with `DEBUG=true` in docker-compose.yml.

To see even more:
```bash
docker-compose logs -f todo-webapp | grep -E "git-backend|API"
```

## Force Sync

To manually trigger a sync without waiting for debounce:

```javascript
// In browser console
import('./assets/js/git-sync-coordinator.js').then(m => m.coordinateSync())
```

## Reset Everything

If things are completely broken:

```bash
# Stop container
docker-compose down

# Clear data
rm -rf /tmp/tododata

# Clear browser storage
# In browser console:
localStorage.clear()

# Restart
docker-compose up
```

## What Should Happen

**Normal Flow:**

1. User adds todo → `addTodoToStorage(text)`
2. Storage saves to localStorage → `saveTodosToStorage(todos)`
3. Event dispatched → `localDataChanged`
4. Sync coordinator receives event → `handleLocalDataChange()`
5. Pending flag set → `setCommitPending(filePath)`
6. Debounce timer starts (3 seconds)
7. Timer expires → `coordinateSync()`
8. Read from Git → `readGitFile(filename)`
9. Compare Git vs Local
10. Write to Git → `writeGitFile(filename, content)`
11. Commit created in Git
12. Pending flag cleared → `clearCommitPending(filePath)`

**Every step should show logs!**

If any step is missing logs, that's where the problem is.
