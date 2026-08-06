'use strict';

import { logVerbose } from '../todo-logging.js';
import { getActiveFile } from '../todo-storage.js';

export const SyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  PENDING: 'pending',
  OFFLINE: 'offline',
  ERROR: 'error',
  DISABLED: 'disabled'
};

let currentSyncStatus = SyncStatus.DISABLED;
let currentFilePath = null;

export function updateSyncIndicator(status, message = '', filePath = null) {
  const indicator = document.getElementById('syncStatusIndicator');
  if (!indicator) return;
  
  const relevantFilePath = filePath || getActiveFile();
  
  if (status === currentSyncStatus && relevantFilePath === currentFilePath && status !== SyncStatus.ERROR) {
    return;
  }
  
  logVerbose(`Updating sync indicator: ${status} for ${relevantFilePath}`, message || '');
  currentSyncStatus = status;
  currentFilePath = relevantFilePath;
  
  let iconClass = '';
  let text = '';
  let title = 'Git Sync Status';
  
  switch (status) {
  case SyncStatus.IDLE: {
    iconClass = 'fa-solid fa-check text-success';
    text = '';
    const fileName = relevantFilePath.substring(relevantFilePath.lastIndexOf('/') + 1);
    title = `File: ${fileName}\nSynced with Git`;
    break;
  }
  case SyncStatus.SYNCING:
    iconClass = 'fa-solid fa-rotate text-primary';
    text = 'Syncing...';
    title = 'Syncing with Git...';
    break;
  case SyncStatus.PENDING:
    iconClass = 'fa-solid fa-cloud-arrow-up text-warning';
    text = 'Pending';
    title = 'Commit pending';
    break;
  case SyncStatus.OFFLINE:
    iconClass = 'fa-solid fa-wifi text-muted';
    text = 'Offline';
    title = 'Application is offline';
    break;
  case SyncStatus.ERROR:
    iconClass = 'fa-solid fa-triangle-exclamation text-danger';
    text = 'Error';
    title = `Sync Error: ${message || 'Unknown error'}`;
    break;
  case SyncStatus.DISABLED:
  default:
    iconClass = 'fa-brands fa-git-alt text-muted';
    text = '';
    title = 'Git sync disabled';
    break;
  }
  
  indicator.innerHTML = `<i class="${iconClass}"></i> ${text}`;
  indicator.title = title;
}

export function updateGitButton(isEnabled, enableHandler, disableHandler) {
  const gitButton = document.getElementById('gitSyncButton');
  if (!gitButton) return;
  
  const iconElement = gitButton.querySelector('i');
  logVerbose(`Updating git button. Enabled: ${isEnabled}`);
  
  if (isEnabled) {
    if (iconElement) {
      iconElement.className = 'fa-brands fa-git-alt fs-5 align-middle';
      iconElement.style.color = '#f05032';
    } else {
      gitButton.innerHTML = '<i class="fa-brands fa-git-alt fs-5 align-middle" style="color: #f05032;"></i>';
    }
    gitButton.title = 'Disable Git Sync';
    gitButton.onclick = disableHandler;
  } else {
    if (iconElement) {
      iconElement.className = 'fa-brands fa-git-alt fs-5 align-middle';
      iconElement.style.color = '#999';
    } else {
      gitButton.innerHTML = '<i class="fa-brands fa-git-alt fs-5 align-middle" style="color: #999;"></i>';
    }
    gitButton.title = 'Enable Git Sync';
    gitButton.onclick = enableHandler;
  }
}

let configModalInstance = null;

export function showGitConfigModal(config, publicKey) {
  if (typeof bootstrap === 'undefined' || typeof bootstrap.Modal === 'undefined') {
    console.error('Bootstrap Modal component not found.');
    alert('UI Error: Cannot display Git config dialog.');
    return Promise.reject('Bootstrap Modal not available');
  }
  
  const modalElement = document.getElementById('gitConfigModal');
  if (!modalElement) {
    console.error('Git config modal element not found in HTML.');
    return Promise.reject('Modal element not found');
  }
  
  if (!configModalInstance) {
    configModalInstance = new bootstrap.Modal(modalElement);
    logVerbose('Git config modal instance created.');
  }
  
  document.getElementById('gitUserName').value = config.userName || '';
  document.getElementById('gitUserEmail').value = config.userEmail || '';
  document.getElementById('gitRemoteUrl').value = config.remoteUrl || '';
  document.getElementById('gitPublicKey').value = publicKey || 'No key generated';
  
  logVerbose('Showing Git config modal');
  configModalInstance.show();
  
  return new Promise((resolve) => {
    const saveButton = document.getElementById('saveGitConfigButton');
    const handler = () => {
      const newConfig = {
        userName: document.getElementById('gitUserName').value,
        userEmail: document.getElementById('gitUserEmail').value,
        remoteUrl: document.getElementById('gitRemoteUrl').value
      };
      saveButton.removeEventListener('click', handler);
      configModalInstance.hide();
      resolve(newConfig);
    };
    saveButton.addEventListener('click', handler);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updateSyncIndicator(SyncStatus.DISABLED);
});
