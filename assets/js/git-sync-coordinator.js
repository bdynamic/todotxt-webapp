'use strict';

import { getActiveFile, getTodosFromStorage } from './todo-storage.js';
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
    const localTodos = getTodosFromStorage();
    const localContent = localTodos.map(todo => todo.text).join('\n');
    
    const gitResult = await readGitFile(filename);
    
    if (!gitResult.success) {
      console.error(`Failed to read file from Git: ${filename}`);
      finalStatus = SyncStatus.ERROR;
      errorMessage = 'Failed to read from Git';
    } else if (gitResult.content === null) {
      logVerbose(`File ${filename} not in Git repository. Creating initial commit.`);
      const uploadSuccess = await writeGitFile(filename, localContent, `Initial commit: ${filename}`);
      if (uploadSuccess) {
        clearCommitPending(activeFilePath);
        finalStatus = SyncStatus.IDLE;
      } else {
        finalStatus = SyncStatus.ERROR;
        errorMessage = 'Failed initial commit';
      }
    } else {
      const gitContent = gitResult.content;
      
      if (gitContent === localContent) {
        logVerbose(`File ${filename} is in sync with Git.`);
        clearCommitPending(activeFilePath);
        finalStatus = SyncStatus.IDLE;
      } else {
        if (isCommitPending(activeFilePath)) {
          logVerbose(`Pending changes detected for ${filename}. Committing local version.`);
          const uploadSuccess = await writeGitFile(filename, localContent, `Update ${filename}`);
          if (uploadSuccess) {
            clearCommitPending(activeFilePath);
            finalStatus = SyncStatus.IDLE;
          } else {
            finalStatus = SyncStatus.ERROR;
            errorMessage = 'Failed to commit changes';
          }
        } else {
          logVerbose(`Git version differs from local for ${filename}. Pulling Git version.`);
          saveTodosFromText(gitContent);
          loadTodos($('#todo-list'));
          clearCommitPending(activeFilePath);
          finalStatus = SyncStatus.IDLE;
        }
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
    logVerbose(`Local data changed for active file (${filePath}). Debouncing sync (${SYNC_DEBOUNCE_DELAY}ms)...`);
    
    if (!navigator.onLine) {
      console.warn(`Offline: Setting commit pending flag for ${activeFilePath} due to local change.`);
      setCommitPending(activeFilePath);
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
