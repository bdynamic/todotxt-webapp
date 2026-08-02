'use strict';

fetch('/api/version')
  .then(function(res) { return res.json(); })
  .then(function(info) {
    const el = document.getElementById('appVersionFooter');
    if (!el || !info || !info.commit) return;

    const shortCommit = info.shortCommit || info.commit.slice(0, 7);
    const date = info.date ? new Date(info.date) : null;
    const dateStr = date ? date.toLocaleString() : '';

    el.textContent = 'v ' + shortCommit + (dateStr ? ' — ' + dateStr : '');
  })
  .catch(function() {
    // no version info available - leave footer empty
  });
