'use strict';

import { API_BASE_URL } from './config.js';
import { logVerbose } from '../todo-logging.js';

let gitEnabled = localStorage.getItem('gitSyncEnabled') === 'true';

export function isGitEnabled() {
  return gitEnabled;
}

export function setGitEnabled(enabled) {
  gitEnabled = enabled;
  localStorage.setItem('gitSyncEnabled', enabled ? 'true' : 'false');
  logVerbose(`Git sync ${enabled ? 'enabled' : 'disabled'}`);
}

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  logVerbose(`Git API call: ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  } catch (err) {
    console.error(`Git API error (${endpoint}):`, err);
    throw err;
  }
}

export async function getGitStatus() {
  if (!gitEnabled) return null;
  const result = await apiCall('/status');
  return result.status;
}

export async function getGitConfig() {
  const result = await apiCall('/config');
  return {
    config: result.config,
    publicKey: result.publicKey
  };
}

export async function updateGitConfig(config) {
  const result = await apiCall('/config', {
    method: 'POST',
    body: JSON.stringify(config)
  });
  return result.config;
}

export async function listGitFiles() {
  if (!gitEnabled) return [];
  const result = await apiCall('/files');
  return result.files;
}

export async function readGitFile(filename) {
  if (!gitEnabled) {
    return { success: false, content: null };
  }
  
  try {
    const result = await apiCall(`/file/${encodeURIComponent(filename)}`);
    return {
      success: true,
      content: result.content,
      lastCommit: result.lastCommit
    };
  } catch (err) {
    if (err.message.includes('ENOENT')) {
      return { success: true, content: null, lastCommit: null };
    }
    return { success: false, content: null };
  }
}

export async function writeGitFile(filename, content, commitMessage = null) {
  if (!gitEnabled) {
    return false;
  }
  
  try {
    const result = await apiCall(`/file/${encodeURIComponent(filename)}`, {
      method: 'POST',
      body: JSON.stringify({ content, commitMessage })
    });
    logVerbose(`File written and committed: ${filename} (${result.commit.hash})`);
    return true;
  } catch (err) {
    console.error(`Failed to write file ${filename}:`, err);
    return false;
  }
}

export async function renameGitFile(oldFilename, newFilename) {
  if (!gitEnabled) {
    return false;
  }
  
  try {
    await apiCall('/rename', {
      method: 'POST',
      body: JSON.stringify({ oldFilename, newFilename })
    });
    logVerbose(`File renamed: ${oldFilename} -> ${newFilename}`);
    return true;
  } catch (err) {
    console.error(`Failed to rename file ${oldFilename}:`, err);
    return false;
  }
}

export async function deleteGitFile(filename) {
  if (!gitEnabled) {
    return false;
  }
  
  try {
    await apiCall(`/file/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    logVerbose(`File deleted: ${filename}`);
    return true;
  } catch (err) {
    console.error(`Failed to delete file ${filename}:`, err);
    return false;
  }
}

export async function getFileHistory(filename, limit = 20) {
  if (!gitEnabled) return [];
  
  try {
    const result = await apiCall(`/history/${encodeURIComponent(filename)}?limit=${limit}`);
    return result.history;
  } catch (err) {
    console.error(`Failed to get history for ${filename}:`, err);
    return [];
  }
}

export async function syncWithRemote() {
  if (!gitEnabled) {
    return { success: false, message: 'Git sync not enabled' };
  }
  
  try {
    const result = await apiCall('/sync', { method: 'POST' });
    return result;
  } catch (err) {
    console.error('Git sync failed:', err);
    return {
      success: false,
      message: err.message
    };
  }
}
