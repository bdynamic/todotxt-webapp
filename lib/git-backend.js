'use strict';

const simpleGit = require('simple-git');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const DEBUG = process.env.DEBUG === 'true' || process.argv.includes('--verbose');

function log(...args) {
  console.log('[git-backend]', ...args);
}

function debug(...args) {
  if (DEBUG) {
    console.log('[git-backend:debug]', ...args);
  }
}

function error(...args) {
  console.error('[git-backend:ERROR]', ...args);
}

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
    debug(`Created directory: ${dir}`);
  } catch (err) {
    error(`Failed to create directory ${dir}:`, err);
    throw err;
  }
}

async function loadGitConfig() {
  try {
    const configData = await fs.readFile(GIT_CONFIG_PATH, 'utf8');
    gitConfig = JSON.parse(configData);
    debug('Loaded Git config from:', GIT_CONFIG_PATH);
  } catch (err) {
    log('No existing Git config found, creating default config');
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
  debug('Saved Git config to:', GIT_CONFIG_PATH);
}

async function ensureSSHKeys() {
  await ensureDirectory(CONFIG_DIR);
  
  const keyExists = fsSync.existsSync(SSH_KEY_PATH);
  const pubKeyExists = fsSync.existsSync(SSH_PUB_KEY_PATH);
  
  if (keyExists && pubKeyExists) {
    log('SSH keys already exist at:', SSH_KEY_PATH);
    return { keyPath: SSH_KEY_PATH, pubKeyPath: SSH_PUB_KEY_PATH, generated: false };
  }
  
  log('Generating new SSH key pair...');
  try {
    const cmd = `ssh-keygen -t ed25519 -f "${SSH_KEY_PATH}" -N "" -C "todotxt-git-sync"`;
    debug('Running:', cmd);
    const result = await execAsync(cmd, { shell: '/bin/sh' });
    debug('ssh-keygen output:', result.stdout, result.stderr);
    log('SSH keys generated successfully at:', SSH_KEY_PATH);
    return { keyPath: SSH_KEY_PATH, pubKeyPath: SSH_PUB_KEY_PATH, generated: true };
  } catch (err) {
    error('Failed to generate SSH keys:', err.message);
    error('stderr:', err.stderr);
    error('stdout:', err.stdout);
    throw new Error('SSH key generation failed: ' + err.message);
  }
}

async function initializeGitRepo() {
  log('Initializing Git backend...');
  log('TODO_DATA_DIR:', TODO_DATA_DIR);
  log('CONFIG_DIR:', CONFIG_DIR);
  
  try {
    await ensureDirectory(TODO_DATA_DIR);
    await loadGitConfig();
    
    const gitDir = path.join(TODO_DATA_DIR, '.git');
    const isGitRepo = fsSync.existsSync(gitDir);
    
    if (!isGitRepo) {
      log('Initializing new Git repository at:', TODO_DATA_DIR);
      
      git = simpleGit(TODO_DATA_DIR);
      await git.init();
      debug('Git init complete');
      
      await git.addConfig('user.name', gitConfig.userName, false, 'local');
      await git.addConfig('user.email', gitConfig.userEmail, false, 'local');
      log('Git config set - user:', gitConfig.userName, 'email:', gitConfig.userEmail);
      
      const gitignorePath = path.join(TODO_DATA_DIR, '.gitignore');
      if (!fsSync.existsSync(gitignorePath)) {
        await fs.writeFile(gitignorePath, '*.swp\n*.tmp\n.DS_Store\n');
        debug('Created .gitignore');
      }
      
      const readmePath = path.join(TODO_DATA_DIR, 'README.md');
      if (!fsSync.existsSync(readmePath)) {
        await fs.writeFile(readmePath, '# Todo.txt Files\n\nThis repository contains your todo.txt files synced via Git.\n');
        await git.add('README.md');
        await git.commit('Initial commit');
        log('Created initial commit with README.md');
      }
    } else {
      log('Git repository already exists at:', TODO_DATA_DIR);
      git = simpleGit(TODO_DATA_DIR);
    }
    
    await ensureSSHKeys();
    
    log('Git backend initialization complete');
    return git;
  } catch (err) {
    error('Failed to initialize Git backend:', err);
    throw err;
  }
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
  debug('Listing todo files in:', TODO_DATA_DIR);
  const files = await fs.readdir(TODO_DATA_DIR);
  const txtFiles = files.filter(f => f.endsWith('.txt'));
  debug(`Found ${txtFiles.length} .txt files`);
  
  const fileList = [];
  for (const file of txtFiles) {
    const filePath = path.join(TODO_DATA_DIR, file);
    const stats = await fs.stat(filePath);
    
    let lastCommit = null;
    if (git) {
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
        error(`Error getting git log for ${file}:`, err);
      }
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
    error('Invalid file path attempted:', filePath);
    throw new Error('Invalid file path');
  }
  
  debug(`Reading file: ${filename}`);
  const content = await fs.readFile(filePath, 'utf8');
  debug(`Read ${content.length} bytes from ${filename}`);
  
  let lastCommit = null;
  if (git) {
    try {
      const log = await git.log({ file: filename, maxCount: 1 });
      if (log.latest) {
        lastCommit = {
          hash: log.latest.hash,
          message: log.latest.message,
          date: log.latest.date,
          author: log.latest.author_name
        };
        debug(`Last commit for ${filename}: ${lastCommit.hash.substring(0, 7)}`);
      }
    } catch (err) {
      error(`Error getting git log for ${filename}:`, err);
    }
  }
  
  return { content, lastCommit };
}

async function writeFile(filename, content, commitMessage = null) {
  const filePath = path.join(TODO_DATA_DIR, filename);
  
  if (!filePath.startsWith(TODO_DATA_DIR)) {
    error('Invalid file path attempted:', filePath);
    throw new Error('Invalid file path');
  }
  
  if (!git) {
    error('Git not initialized, cannot write file');
    throw new Error('Git repository not initialized');
  }
  
  debug(`Writing file: ${filename} (${content.length} bytes)`);
  await fs.writeFile(filePath, content, 'utf8');
  
  await git.add(filename);
  debug(`Added to git: ${filename}`);
  
  const message = commitMessage || `Update ${filename} - ${new Date().toISOString()}`;
  const commitResult = await git.commit(message);
  log(`Committed ${filename}: ${commitResult.commit.substring(0, 7)} - ${message}`);
  
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
    error('Invalid file path attempted:', oldPath, newPath);
    throw new Error('Invalid file path');
  }
  
  if (!git) {
    error('Git not initialized, cannot rename file');
    throw new Error('Git repository not initialized');
  }
  
  debug(`Renaming file: ${oldFilename} -> ${newFilename}`);
  await git.mv(oldFilename, newFilename);
  const commitResult = await git.commit(`Rename ${oldFilename} to ${newFilename}`);
  log(`Renamed file: ${oldFilename} -> ${newFilename} (${commitResult.commit.substring(0, 7)})`);
  
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
    error('Invalid file path attempted:', filePath);
    throw new Error('Invalid file path');
  }
  
  if (!git) {
    error('Git not initialized, cannot delete file');
    throw new Error('Git repository not initialized');
  }
  
  debug(`Deleting file: ${filename}`);
  await git.rm(filename);
  const commitResult = await git.commit(`Delete ${filename}`);
  log(`Deleted file: ${filename} (${commitResult.commit.substring(0, 7)})`);
  
  return {
    success: true,
    commit: {
      hash: commitResult.commit
    }
  };
}

async function getFileHistory(filename, limit = 20) {
  if (!git) {
    error('Git not initialized, cannot get file history');
    throw new Error('Git repository not initialized');
  }
  
  debug(`Getting history for ${filename} (limit: ${limit})`);
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
  if (!git) {
    error('Git not initialized, cannot sync with remote');
    throw new Error('Git repository not initialized');
  }
  
  if (!gitConfig.remoteUrl) {
    throw new Error('No remote URL configured');
  }
  
  log('Starting remote sync with:', gitConfig.remoteUrl);
  
  const remotes = await git.getRemotes(true);
  const remoteExists = remotes.some(r => r.name === gitConfig.remoteName);
  
  if (!remoteExists) {
    debug(`Adding remote: ${gitConfig.remoteName} -> ${gitConfig.remoteUrl}`);
    await git.addRemote(gitConfig.remoteName, gitConfig.remoteUrl);
  }
  
  const sshCommand = `ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no`;
  await git.env('GIT_SSH_COMMAND', sshCommand);
  debug('SSH command set:', sshCommand);
  
  try {
    debug('Fetching from remote...');
    await git.fetch(gitConfig.remoteName);
    
    const status = await git.status();
    
    if (status.conflicted.length > 0) {
      log('Merge conflicts detected:', status.conflicted);
      return {
        success: false,
        conflicts: status.conflicted,
        message: 'Merge conflicts detected'
      };
    }
    
    debug('Pulling with rebase...');
    await git.pull(gitConfig.remoteName, 'main', { '--rebase': 'true' });
    
    debug('Pushing to remote...');
    await git.push(gitConfig.remoteName, 'main');
    
    log('Remote sync completed successfully');
    return {
      success: true,
      message: 'Sync completed successfully'
    };
  } catch (err) {
    error('Git sync error:', err.message);
    throw err;
  }
}

async function getConfig() {
  return gitConfig;
}

async function updateConfig(newConfig) {
  gitConfig = { ...gitConfig, ...newConfig };
  await saveGitConfig();
  
  if (git) {
    if (newConfig.userName) {
      await git.addConfig('user.name', newConfig.userName, false, 'local');
    }
    if (newConfig.userEmail) {
      await git.addConfig('user.email', newConfig.userEmail, false, 'local');
    }
    debug('Updated Git config in repository');
  }
  
  return gitConfig;
}

async function getStatus() {
  if (!git) {
    throw new Error('Git repository not initialized');
  }
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
