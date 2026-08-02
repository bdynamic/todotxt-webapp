'use strict';

fetch('/api/version')
  .then(function(res) {
    if (!res.ok) throw new Error('http ' + res.status);
    return res.json();
  })
  .then(function(info) {
    const el = document.getElementById('appVersionFooter');
    if (!el) return;

    if (!info || !info.commit) {
      el.textContent = 'version unknown';
      return;
    }

    const shortCommit = info.shortCommit || info.commit.slice(0, 7);
    const date = info.date ? new Date(info.date) : null;
    const dateStr = date ? date.toLocaleString() : '';

    el.textContent = 'v ' + shortCommit + (dateStr ? ' — ' + dateStr : '');
  })
  .catch(function() {
    const el = document.getElementById('appVersionFooter');
    if (el) el.textContent = 'version unavailable';
  });
