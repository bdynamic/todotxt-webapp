'use strict';

import { getActiveFile, getTodosFromStorage, saveTodosToStorage } from './todo-storage.js';
import { readGitFile, writeGitFile, isGitEnabled } from './git/api.js';
import { saveTodosFromText, loadTodos } from './todo-load.js';
import { updateSyncIndicator, SyncStatus } from './git/ui.js';
import { clearCommitPending, isCommitPending, setCommitPending } from './git/offline.js';
import { logVerbose } from './todo-logging.js';

let syncDebounceTimer = null;
const SYNC_DEBOUNCE_DELAY = 3000;

export async function coordinateSync() {
  clearTimeout(syncDebounceTimer);
  
  if (!isGitEnabled()) {
    logVerbose('Git sync is disabled, skipping sync.');
    return;
  }
  
  const activeFilePath = getActiveFile();
  if (!activeFilePath) {
    console.error('Sync failed: Could not determine active file path.');
    updateSyncIndicator(SyncStatus.ERROR, 'Sync failed: No active file', null);
    return;
  }
  
  const filename = activeFilePath.substring(1);
  logVerbose(`Starting coordinated sync for active file: ${activeFilePath}`);
  
  if (!navigator.onLine) {
    console.warn('Cannot sync, application is offline.');
    updateSyncIndicator(SyncStatus.OFFLINE, '', activeFilePath);
    return;
  }
  
  updateSyncIndicator(SyncStatus.SYNCING, '', activeFilePath);
  let finalStatus = SyncStatus.IDLE;
  let errorMessage = '';
  
  try {
    const hasPendingChanges = isCommitPending(activeFilePath);
    console.log(`[git-sync] Starting sync for ${filename}, pending: ${hasPendingChanges}`);
    
    logVerbose(`Step 1: Pull latest from Git for ${filename}`);
    const gitResult = await readGitFile(filename);
    
    if (!gitResult.success) {
      console.error(`Failed to read file from Git: ${filename}`);
      finalStatus = SyncStatus.ERROR;
      errorMessage = 'Failed to read from Git';
      return;
    }
    
    if (gitResult.content === null) {
      logVerbose(`File ${filename} not in Git repository. Creating initial commit.`);
      const localTodos = getTodosFromStorage();
      const localContent = localTodos.map(todo => todo.text).join('\n');
      console.log(`[git-sync] Creating initial commit with ${localTodos.length} todos`);
      console.log(`[git-sync] Content to commit: ${localContent.substring(0, 100)}...`);
      
      const uploadSuccess = await writeGitFile(filename, localContent, `Initial commit: ${filename}`);
      if (uploadSuccess) {
        clearCommitPending(activeFilePath);
        finalStatus = SyncStatus.IDLE;
        logVerbose(`Successfully created initial commit for ${filename}`);
      } else {
        finalStatus = SyncStatus.ERROR;
        errorMessage = 'Failed initial commit';
      }
      return;
    }
    
    const gitContent = gitResult.content;
    const gitCommitHash = gitResult.lastCommit?.hash;
    
    const localTodos = getTodosFromStorage();
    const localContent = localTodos.map(todo => todo.text).join('\n');
    
    console.log(`[git-sync] Git content (${gitContent.length} chars): ${gitContent.substring(0, 100)}...`);
    console.log(`[git-sync] Local content (${localContent.length} chars, ${localTodos.length} todos): ${localContent.substring(0, 100)}...`);
    logVerbose(`Comparing: Git (${gitCommitHash?.substring(0, 7) || 'unknown'}) vs Local`);
    
    if (hasPendingChanges) {
      console.log(`[git-sync] Step 2a: Pending changes detected. Checking for conflicts...`);
      
      if (gitContent !== localContent) {
        const gitContentTrimmed = gitContent.trim();
        const localContentTrimmed = localContent.trim();
        
        console.log(`[git-sync] Git vs Local differ. Git trimmed: ${gitContentTrimmed.length} chars, Local trimmed: ${localContentTrimmed.length} chars`);
        
        if (gitContentTrimmed !== localContentTrimmed) {
          console.log(`[git-sync] Step 2b: Content truly differs. NOT merging - committing local version...`);
          
          console.log(`[git-sync] Step 2c: Writing local version to Git...`);
          const uploadSuccess = await writeGitFile(filename, localContent, `Update ${filename}`);
          
          if (uploadSuccess) {
            clearCommitPending(activeFilePath);
            finalStatus = SyncStatus.IDLE;
            console.log(`[git-sync] Successfully committed local changes to ${filename}`);
          } else {
            finalStatus = SyncStatus.ERROR;
            errorMessage = 'Failed to commit changes';
          }
        } else {
          console.log(`[git-sync] Step 2b: Content matches (whitespace only). Committing local version...`);
          const uploadSuccess = await writeGitFile(filename, localContent, `Update ${filename}`);
          
          if (uploadSuccess) {
            clearCommitPending(activeFilePath);
            finalStatus = SyncStatus.IDLE;
            console.log(`[git-sync] Successfully committed ${filename}`);
          } else {
            finalStatus = SyncStatus.ERROR;
            errorMessage = 'Failed to commit changes';
          }
        }
      } else {
        console.log(`[git-sync] Step 2b: Git and local are identical. Clearing pending flag only.`);
        clearCommitPending(activeFilePath);
        finalStatus = SyncStatus.IDLE;
      }
    } else {
      logVerbose(`Step 2a: No pending local changes.`);
      
      if (gitContent !== localContent) {
        logVerbose(`Step 2b: Git version is newer. Pulling into local storage...`);
        saveTodosFromText(gitContent);
        loadTodos($('#todo-list'));
        clearCommitPending(activeFilePath);
        finalStatus = SyncStatus.IDLE;
        logVerbose(`Successfully pulled latest version of ${filename}`);
      } else {
        logVerbose(`Step 2b: Already in sync with Git.`);
        clearCommitPending(activeFilePath);
        finalStatus = SyncStatus.IDLE;
      }
    }
    
  } catch (error) {
    console.error(`Error during coordinateSync for ${activeFilePath}:`, error);
    finalStatus = SyncStatus.ERROR;
    errorMessage = error.message || 'Sync check failed';
  } finally {
    updateSyncIndicator(finalStatus, errorMessage, activeFilePath);
  }
}

function handleLocalDataChange(event) {
  const { filePath } = event.detail;
  const activeFilePath = getActiveFile();
  
  if (filePath === activeFilePath) {
    logVerbose(`Local data changed for active file (${filePath}). Setting pending flag and debouncing sync...`);
    
    setCommitPending(activeFilePath);
    
    if (!navigator.onLine) {
      console.warn(`Offline: Changes will be committed when back online.`);
      updateSyncIndicator(SyncStatus.PENDING, '', activeFilePath);
      return;
    }
    
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      logVerbose(`Debounce timer finished for ${activeFilePath}. Triggering coordinateSync.`);
      coordinateSync();
    }, SYNC_DEBOUNCE_DELAY);
  } else {
    logVerbose(`Local data changed event ignored for non-active file: ${filePath}`);
  }
}

export function initializeSyncCoordinator() {
  logVerbose('Initializing Git Sync Coordinator...');
  document.addEventListener('localDataChanged', handleLocalDataChange);
  logVerbose('Git Sync Coordinator initialized and listening for local data changes.');
}
