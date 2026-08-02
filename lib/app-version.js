'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP_ROOT = path.join(__dirname, '..');
const VERSION_FILE = path.join(APP_ROOT, 'version.json');

function readVersionFile() {
  try {
    const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    if (data.commit) return data;
  } catch (err) {
    // no version.json (e.g. running directly from source, not via Docker build)
  }
  return null;
}

function readFromGit() {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: APP_ROOT }).toString().trim();
    const shortCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: APP_ROOT }).toString().trim();
    const date = execFileSync('git', ['log', '-1', '--format=%cI'], { cwd: APP_ROOT }).toString().trim();
    return { commit, shortCommit, date };
  } catch (err) {
    return { commit: null, shortCommit: null, date: null };
  }
}

// Computed once at startup - the running version doesn't change during the process lifetime.
const versionInfo = readVersionFile() || readFromGit();

module.exports = { versionInfo };
