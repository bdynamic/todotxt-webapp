'use strict';

import { logVerbose } from '../todo-logging.js';
import { updateSyncIndicator, SyncStatus } from './ui.js';
import { isGitEnabled } from './api.js';
import { getActiveFile } from '../todo-storage.js';

function getDynamicPendingKey(filePath) {
  if (!filePath) {
    console.warn('Cannot generate dynamic pending key without a file path.');
    return null;
  }
  const safePath = filePath.replace(/\//g, '_');
  return `git_pending_commit${safePath}`;
}

export function isCommitPending(filePath) {
  const key = getDynamicPendingKey(filePath);
  if (!key) return false;
  const pending = localStorage.getItem(key) === 'true';
  return pending;
}

export function setCommitPending(filePath) {
  const key = getDynamicPendingKey(filePath);
  if (!key) return;
  logVerbose(`Setting pending commit flag for ${filePath}.`);
  localStorage.setItem(key, 'true');
  if (filePath === getActiveFile()) {
    updateSyncIndicator(SyncStatus.PENDING, '', filePath);
  }
}

export function clearCommitPending(filePath) {
  const key = getDynamicPendingKey(filePath);
  if (!key) return;
  logVerbose(`Clearing pending commit flag for ${filePath}.`);
  localStorage.removeItem(key);
}

async function handleOnlineStatus() {
  logVerbose('Application came online.');
  
  if (!isGitEnabled()) {
    updateSyncIndicator(SyncStatus.DISABLED, '', null);
    return;
  }
  
  const activeFilePath = getActiveFile();
  
  if (isCommitPending(activeFilePath)) {
    logVerbose(`Pending commit detected for active file (${activeFilePath}). Triggering sync...`);
    
    try {
      const { coordinateSync } = await import('../git-sync-coordinator.js');
      await coordinateSync();
    } catch (err) {
      console.error(`Error triggering coordinateSync for ${activeFilePath} after coming online:`, err);
      updateSyncIndicator(SyncStatus.ERROR, 'Sync after reconnect failed', activeFilePath);
    }
  } else {
    logVerbose(`Online and no pending commit for active file (${activeFilePath}). Setting status to IDLE.`);
    updateSyncIndicator(SyncStatus.IDLE, '', activeFilePath);
  }
}

function handleOfflineStatus() {
  logVerbose('Application went offline.');
  const activeFilePath = getActiveFile();
  updateSyncIndicator(SyncStatus.OFFLINE, '', activeFilePath);
}

export function initializeOfflineHandling() {
  logVerbose('Initializing offline event listeners.');
  window.addEventListener('online', handleOnlineStatus);
  window.addEventListener('offline', handleOfflineStatus);
  
  const activeFilePath = getActiveFile();
  
  if (!navigator.onLine) {
    handleOfflineStatus();
  } else if (!isGitEnabled()) {
    updateSyncIndicator(SyncStatus.DISABLED, '', null);
  } else if (isCommitPending(activeFilePath)) {
    updateSyncIndicator(SyncStatus.PENDING, '', activeFilePath);
  } else {
    updateSyncIndicator(SyncStatus.IDLE, '', activeFilePath);
  }
}
