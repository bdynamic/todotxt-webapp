'use strict';

import { initializeSyncCoordinator } from './git-sync-coordinator.js';
import { initializeOfflineHandling } from './git/offline.js';
import { isGitEnabled, setGitEnabled, getGitConfig, updateGitConfig, listGitFiles, syncWithRemote } from './git/api.js';
import { updateGitButton, updateSyncIndicator, SyncStatus, showGitConfigModal } from './git/ui.js';
import { getKnownFiles, addKnownFile } from './todo-storage.js';
import { updateFileSelectionUI } from './todo-files.js';
import { logVerbose } from './todo-logging.js';

async function enableGitSync() {
  logVerbose('Enabling Git sync...');
  setGitEnabled(true);
  updateGitButton(true, enableGitSync, disableGitSync);
  updateSyncIndicator(SyncStatus.IDLE, '', null);
  
  await discoverGitFiles();
  
  const { coordinateSync } = await import('./git-sync-coordinator.js');
  await coordinateSync();
}

function disableGitSync() {
  logVerbose('Disabling Git sync...');
  setGitEnabled(false);
  updateGitButton(false, enableGitSync, disableGitSync);
  updateSyncIndicator(SyncStatus.DISABLED, '', null);
}

async function discoverGitFiles() {
  logVerbose('Starting Git file discovery...');
  
  try {
    const gitFiles = await listGitFiles();
    const knownFiles = getKnownFiles();
    let filesAdded = false;
    
    for (const gitFile of gitFiles) {
      if (!knownFiles.some(kf => kf.path === gitFile.path)) {
        logVerbose(`Found new file in Git: ${gitFile.name} (${gitFile.path}). Adding to known files.`);
        addKnownFile(gitFile.name, gitFile.path);
        filesAdded = true;
      }
    }
    
    if (filesAdded) {
      logVerbose('New files added from Git discovery. Updating UI.');
      updateFileSelectionUI();
    } else {
      logVerbose('No new files discovered in Git.');
    }
  } catch (error) {
    console.error('Error listing files from Git:', error);
  }
}

async function showConfigDialog() {
  try {
    const { config, publicKey } = await getGitConfig();
    const newConfig = await showGitConfigModal(config, publicKey);
    await updateGitConfig(newConfig);
    alert('Git configuration saved successfully.');
  } catch (error) {
    console.error('Error updating Git config:', error);
    alert('Failed to update Git configuration.');
  }
}

async function triggerRemoteSync() {
  logVerbose('Triggering manual remote sync...');
  updateSyncIndicator(SyncStatus.SYNCING, 'Syncing with remote...', null);
  
  try {
    const result = await syncWithRemote();
    if (result.success) {
      updateSyncIndicator(SyncStatus.IDLE, '', null);
      alert('Successfully synced with remote repository.');
      await discoverGitFiles();
    } else if (result.conflicts) {
      updateSyncIndicator(SyncStatus.ERROR, 'Merge conflicts', null);
      alert(`Sync failed: Merge conflicts detected in:\n${result.conflicts.join('\n')}`);
    } else {
      updateSyncIndicator(SyncStatus.ERROR, result.message, null);
      alert(`Sync failed: ${result.message}`);
    }
  } catch (error) {
    console.error('Remote sync error:', error);
    updateSyncIndicator(SyncStatus.ERROR, error.message, null);
    alert(`Sync failed: ${error.message}`);
  }
}

async function initializeGitSync() {
  logVerbose('Initializing Git Sync System...');
  
  initializeSyncCoordinator();
  initializeOfflineHandling();
  
  const gitButton = document.getElementById('gitSyncButton');
  if (gitButton) {
    if (isGitEnabled()) {
      updateGitButton(true, enableGitSync, disableGitSync);
      await discoverGitFiles();
      const { coordinateSync } = await import('./git-sync-coordinator.js');
      await coordinateSync();
    } else {
      updateGitButton(false, enableGitSync, disableGitSync);
    }
  }
  
  const gitConfigButton = document.getElementById('gitConfigButton');
  if (gitConfigButton) {
    gitConfigButton.addEventListener('click', showConfigDialog);
  }
  
  const gitRemoteSyncButton = document.getElementById('gitRemoteSyncButton');
  if (gitRemoteSyncButton) {
    gitRemoteSyncButton.addEventListener('click', triggerRemoteSync);
  }
  
  logVerbose('Git Sync System Initialized.');
}

export { initializeGitSync };

document.addEventListener('DOMContentLoaded', initializeGitSync);
