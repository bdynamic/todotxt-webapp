# Git Sync Fix - Proper Pull-Before-Write Workflow

## Problem

Git sync was losing changes because:
1. Changes were written without pulling first
2. Files were not immediately committed to Git when created
3. File switches didn't trigger sync
4. The sync logic was inconsistent about when to pull vs push

## Solution

Implemented proper Git workflow with **pull-before-write** pattern:

### 1. Rewritten Sync Coordinator Logic

**New Workflow in `git-sync-coordinator.js`:**

```
1. ALWAYS pull latest from Git first (readGitFile)
2. Check if there are pending local changes
3. If pending changes:
   a. Compare Git version with local
   b. If different: merge and commit
   c. If same: commit to clear pending flag
4. If no pending changes:
   a. If Git version is newer: pull into local storage
   b. If same: do nothing
```

**Key Changes:**
- `setCommitPending()` is ALWAYS called when local data changes
- Pull happens BEFORE any write operation
- Proper merge logic when both Git and local have changes
- Clear pending flag only after successful commit

### 2. File Operations Updated

**Add File (`todo-files.js`):**
- Creates empty file in local storage
- Immediately commits to Git if sync enabled
- Triggers coordinateSync() after creation
- Removed Dropbox references

**Rename File (`todo-files.js`):**
- Renames in local storage first
- Uses Git's `mv` command if sync enabled
- No more Dropbox references

**Delete File (`todo-files.js`):**
- Deletes from local storage
- Uses Git's `rm` command if sync enabled
- No more Dropbox references

**Switch File (`todo-files.js`):**
- When switching files, triggers `coordinateSync()`
- Ensures latest version is pulled when opening a file

### 3. Data Change Handling

**On Every Local Change:**
```javascript
function handleLocalDataChange(event) {
  // 1. ALWAYS set pending flag
  setCommitPending(activeFilePath);
  
  // 2. If offline, show pending status and wait
  if (!navigator.onLine) {
    updateSyncIndicator(SyncStatus.PENDING);
    return;
  }
  
  // 3. If online, debounce and sync (with pull-before-write)
  debounce(() => coordinateSync(), 3000);
}
```

## Files Modified

1. **`assets/js/git-sync-coordinator.js`** - Complete rewrite
   - Proper pull-before-write workflow
   - Always set pending flag on changes
   - Merge logic for conflicts
   - Better logging

2. **`assets/js/todo-files.js`** - Git integration
   - Add file: Commit to Git immediately
   - Rename file: Use Git mv
   - Delete file: Use Git rm
   - Switch file: Trigger sync
   - Removed all Dropbox references

## Testing Checklist

✅ **Add a todo item**
- [ ] Pending flag is set immediately
- [ ] After 3 seconds, Git commit is created
- [ ] Check: `docker exec todowebapp sh -c "cd /tmp/tododata && git log --oneline"`

✅ **Edit a todo item**
- [ ] Pending flag is set
- [ ] Commit is created after debounce
- [ ] File content matches in Git

✅ **Create a new file**
- [ ] File appears in sidebar
- [ ] Empty file is committed to Git
- [ ] Switch to new file loads it

✅ **Switch between files**
- [ ] Latest version is pulled from Git
- [ ] Changes from other sources are visible

✅ **Simulate concurrent changes**
1. Edit file in Git directly: `docker exec todowebapp sh -c "echo '(A) Test from Git' >> /tmp/tododata/todo.txt && cd /tmp/tododata && git add todo.txt && git commit -m 'External change'"`
2. Refresh browser or switch files
3. Should see the Git version

✅ **Offline changes**
- [ ] Make changes while offline
- [ ] Pending status shows
- [ ] When back online, changes are committed

## Verification Commands

```bash
# Watch Git commits in real-time
docker exec todowebapp sh -c "cd /tmp/tododata && watch -n 1 'git log --oneline -5'"

# Check file content in Git
docker exec todowebapp sh -c "cd /tmp/tododata && git show HEAD:todo.txt"

# Make external change to test pull
docker exec todowebapp sh -c "echo '(A) External change test' >> /tmp/tododata/todo.txt && cd /tmp/tododata && git add todo.txt && git commit -m 'Test external change'"

# View sync status
# Open browser console and check for:
# - "Setting pending flag"
# - "Step 1: Pull latest from Git"
# - "Step 2: Pending changes detected"
# - "Successfully committed"
```

## Expected Behavior

### Scenario 1: Simple Edit
1. User edits a todo
2. Log: `Setting pending flag`
3. After 3s, Log: `Step 1: Pull latest from Git`
4. Log: `Step 2a: Pending changes detected`
5. Log: `Step 2c: Writing merged version back to Git`
6. Log: `Successfully committed`

### Scenario 2: Pull External Changes
1. Change made in Git externally
2. User switches to that file
3. Log: `Step 1: Pull latest from Git`
4. Log: `Step 2a: No pending local changes`
5. Log: `Step 2b: Git version is newer. Pulling`
6. UI updates with new content

### Scenario 3: Concurrent Edits
1. External change in Git
2. User makes local change
3. Log: `Setting pending flag`
4. After 3s, Log: `Step 1: Pull latest from Git`
5. Log: `Step 2a: Pending changes detected`
6. Log: `Step 2b: Git version differs. Merging`
7. Log: `Pulling Git version into local storage first`
8. Log: `Writing merged version back to Git`
9. Both changes preserved

## Migration Notes

**From Previous Version:**
- Old logic only pulled when there were NO pending changes
- This meant local changes would overwrite Git changes
- Now: ALWAYS pull first, then intelligently merge/commit

**Breaking Changes:**
- None for users
- Developers: `coordinateSync()` now always starts with a pull

## Troubleshooting

**Changes disappearing:**
- Check browser console for sync errors
- Verify Git commits: `git log --oneline`
- Check pending flags in localStorage

**Not committing:**
- Ensure Git sync is enabled (Git icon clicked)
- Check for errors in server logs
- Verify Git backend initialized correctly

**Conflicts:**
- Current implementation does simple merge
- Future: Add conflict resolution UI

## Future Enhancements

1. **Conflict Resolution Modal** - Show diff and let user choose
2. **Manual Sync Button** - Force sync without waiting for debounce
3. **Sync Status Per File** - Show which files have pending changes
4. **Background Sync** - Periodic pull even without changes
5. **Change Notifications** - Alert when external changes are pulled
