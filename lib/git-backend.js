'use strict';

const simpleGit = require('simple-git');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const TODO_DATA_DIR = process.env.TODO_DATA_DIR || '/tmp/tododata';
const CONFIG_DIR = process.env.TODO_CONFIG_DIR || path.join(process.env.HOME || '/root', '.config', 'todotxt-git');
const SSH_KEY_PATH = path.join(CONFIG_DIR, 'id_ed25519');
const SSH_PUB_KEY_PATH = path.join(CONFIG_DIR, 'id_ed25519.pub');
const GIT_CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

let git = null;
let gitConfig = null;

async function ensureDirectory(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create directory ${dir}:`, err);
    throw err;
  }
}

async function loadGitConfig() {
  try {
    const configData = await fs.readFile(GIT_CONFIG_PATH, 'utf8');
    gitConfig = JSON.parse(configData);
  } catch (err) {
    gitConfig = {
      userName: 'Todo.txt User',
      userEmail: 'todo@localhost',
      remoteUrl: null,
      remoteName: 'origin'
    };
    await saveGitConfig();
  }
  return gitConfig;
}

async function saveGitConfig() {
  await ensureDirectory(CONFIG_DIR);
  await fs.writeFile(GIT_CONFIG_PATH, JSON.stringify(gitConfig, null, 2));
}

async function ensureSSHKeys() {
  await ensureDirectory(CONFIG_DIR);
  
  const keyExists = fsSync.existsSync(SSH_KEY_PATH);
  const pubKeyExists = fsSync.existsSync(SSH_PUB_KEY_PATH);
  
  if (keyExists && pubKeyExists) {
    console.log('SSH keys already exist at:', SSH_KEY_PATH);
    return { keyPath: SSH_KEY_PATH, pubKeyPath: SSH_PUB_KEY_PATH, generated: false };
  }
  
  console.log('Generating new SSH key pair...');
  try {
    await execAsync(
      `ssh-keygen -t ed25519 -f "${SSH_KEY_PATH}" -N "" -C "todotxt-git-sync"`,
      { shell: '/bin/sh' }
    );
    console.log('SSH keys generated successfully at:', SSH_KEY_PATH);
    return { keyPath: SSH_KEY_PATH, pubKeyPath: SSH_PUB_KEY_PATH, generated: true };
  } catch (err) {
    console.error('Failed to generate SSH keys:', err);
    throw new Error('SSH key generation failed');
  }
}

async function initializeGitRepo() {
  await ensureDirectory(TODO_DATA_DIR);
  await loadGitConfig();
  
  const gitDir = path.join(TODO_DATA_DIR, '.git');
  const isGitRepo = fsSync.existsSync(gitDir);
  
  git = simpleGit(TODO_DATA_DIR);
  
  if (!isGitRepo) {
    console.log('Initializing Git repository at:', TODO_DATA_DIR);
    await git.init();
    await git.addConfig('user.name', gitConfig.userName);
    await git.addConfig('user.email', gitConfig.userEmail);
    
    const gitignorePath = path.join(TODO_DATA_DIR, '.gitignore');
    if (!fsSync.existsSync(gitignorePath)) {
      await fs.writeFile(gitignorePath, '*.swp\n*.tmp\n.DS_Store\n');
    }
    
    const readmePath = path.join(TODO_DATA_DIR, 'README.md');
    if (!fsSync.existsSync(readmePath)) {
      await fs.writeFile(readmePath, '# Todo.txt Files\n\nThis repository contains your todo.txt files synced via Git.\n');
      await git.add('README.md');
      await git.commit('Initial commit');
    }
  } else {
    console.log('Git repository already exists at:', TODO_DATA_DIR);
  }
  
  await ensureSSHKeys();
  
  return git;
}

async function getPublicKey() {
  try {
    const pubKey = await fs.readFile(SSH_PUB_KEY_PATH, 'utf8');
    return pubKey.trim();
  } catch (err) {
    return null;
  }
}

async function listTodoFiles() {
  const files = await fs.readdir(TODO_DATA_DIR);
  const txtFiles = files.filter(f => f.endsWith('.txt'));
  
  const fileList = [];
  for (const file of txtFiles) {
    const filePath = path.join(TODO_DATA_DIR, file);
    const stats = await fs.stat(filePath);
    
    let lastCommit = null;
    try {
      const log = await git.log({ file: file, maxCount: 1 });
      if (log.latest) {
        lastCommit = {
          hash: log.latest.hash,
          message: log.latest.message,
          date: log.latest.date,
          author: log.latest.author_name
        };
      }
    } catch (err) {
      console.error(`Error getting git log for ${file}:`, err);
    }
    
    fileList.push({
      name: file,
      path: '/' + file,
      size: stats.size,
      modified: stats.mtime,
      lastCommit: lastCommit
    });
  }
  
  return fileList;
}

async function readFile(filename) {
  const filePath = path.join(TODO_DATA_DIR, filename);
  
  if (!filePath.startsWith(TODO_DATA_DIR)) {
    throw new Error('Invalid file path');
  }
  
  const content = await fs.readFile(filePath, 'utf8');
  
  let lastCommit = null;
  try {
    const log = await git.log({ file: filename, maxCount: 1 });
    if (log.latest) {
      lastCommit = {
        hash: log.latest.hash,
        message: log.latest.message,
        date: log.latest.date,
        author: log.latest.author_name
      };
    }
  } catch (err) {
    console.error(`Error getting git log for ${filename}:`, err);
  }
  
  return { content, lastCommit };
}

async function writeFile(filename, content, commitMessage = null) {
  const filePath = path.join(TODO_DATA_DIR, filename);
  
  if (!filePath.startsWith(TODO_DATA_DIR)) {
    throw new Error('Invalid file path');
  }
  
  await fs.writeFile(filePath, content, 'utf8');
  
  await git.add(filename);
  
  const message = commitMessage || `Update ${filename} - ${new Date().toISOString()}`;
  const commitResult = await git.commit(message);
  
  return {
    success: true,
    commit: {
      hash: commitResult.commit,
      message: message
    }
  };
}

async function renameFile(oldFilename, newFilename) {
  const oldPath = path.join(TODO_DATA_DIR, oldFilename);
  const newPath = path.join(TODO_DATA_DIR, newFilename);
  
  if (!oldPath.startsWith(TODO_DATA_DIR) || !newPath.startsWith(TODO_DATA_DIR)) {
    throw new Error('Invalid file path');
  }
  
  await git.mv(oldFilename, newFilename);
  const commitResult = await git.commit(`Rename ${oldFilename} to ${newFilename}`);
  
  return {
    success: true,
    commit: {
      hash: commitResult.commit
    }
  };
}

async function deleteFile(filename) {
  const filePath = path.join(TODO_DATA_DIR, filename);
  
  if (!filePath.startsWith(TODO_DATA_DIR)) {
    throw new Error('Invalid file path');
  }
  
  await git.rm(filename);
  const commitResult = await git.commit(`Delete ${filename}`);
  
  return {
    success: true,
    commit: {
      hash: commitResult.commit
    }
  };
}

async function getFileHistory(filename, limit = 20) {
  const log = await git.log({ file: filename, maxCount: limit });
  
  return log.all.map(commit => ({
    hash: commit.hash,
    message: commit.message,
    date: commit.date,
    author: commit.author_name,
    email: commit.author_email
  }));
}

async function syncWithRemote() {
  if (!gitConfig.remoteUrl) {
    throw new Error('No remote URL configured');
  }
  
  const remotes = await git.getRemotes(true);
  const remoteExists = remotes.some(r => r.name === gitConfig.remoteName);
  
  if (!remoteExists) {
    await git.addRemote(gitConfig.remoteName, gitConfig.remoteUrl);
  }
  
  const sshCommand = `ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no`;
  await git.env('GIT_SSH_COMMAND', sshCommand);
  
  try {
    await git.fetch(gitConfig.remoteName);
    
    const status = await git.status();
    
    if (status.conflicted.length > 0) {
      return {
        success: false,
        conflicts: status.conflicted,
        message: 'Merge conflicts detected'
      };
    }
    
    await git.pull(gitConfig.remoteName, 'main', { '--rebase': 'true' });
    
    await git.push(gitConfig.remoteName, 'main');
    
    return {
      success: true,
      message: 'Sync completed successfully'
    };
  } catch (err) {
    console.error('Git sync error:', err);
    throw err;
  }
}

async function getConfig() {
  return gitConfig;
}

async function updateConfig(newConfig) {
  gitConfig = { ...gitConfig, ...newConfig };
  await saveGitConfig();
  
  if (newConfig.userName) {
    await git.addConfig('user.name', newConfig.userName);
  }
  if (newConfig.userEmail) {
    await git.addConfig('user.email', newConfig.userEmail);
  }
  
  return gitConfig;
}

async function getStatus() {
  const status = await git.status();
  return {
    current: status.current,
    tracking: status.tracking,
    ahead: status.ahead,
    behind: status.behind,
    modified: status.modified,
    created: status.created,
    deleted: status.deleted,
    conflicted: status.conflicted,
    staged: status.staged
  };
}

module.exports = {
  initializeGitRepo,
  getPublicKey,
  listTodoFiles,
  readFile,
  writeFile,
  renameFile,
  deleteFile,
  getFileHistory,
  syncWithRemote,
  getConfig,
  updateConfig,
  getStatus,
  TODO_DATA_DIR,
  CONFIG_DIR,
  SSH_KEY_PATH
};
