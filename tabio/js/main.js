/* ─────────────────────────────────────────────────────────
   main.js  —  entry point: init all modules, wire nav,
               keyboard shortcuts
───────────────────────────────────────────────────────── */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Tab count badge ──────────────────────────────────────
  const tabs = await TabsAPI.getCurrentWindowTabs();
  document.getElementById('tabCountBadge').textContent =
    `${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`;

  // ── Nav buttons ──────────────────────────────────────────
  const navMap = {
    modeExport:    'export',
    modeImport:    'import',
    modeSessions:  'sessions',
    modeAnalytics: 'analytics',
  };

  Object.entries(navMap).forEach(([btnId, mode]) => {
    document.getElementById(btnId).addEventListener('click', async () => {
      switchMode(mode);
      if (mode === 'sessions')  await Sessions.render();
      if (mode === 'analytics') await Analytics.render();
    });
  });

  // ── Init all modules ─────────────────────────────────────
  await Export.init();
  Import.init();
  Sessions.init();
  Analytics.init();

  // ── Keyboard shortcuts ───────────────────────────────────
  // Alt+E  → Export panel
  // Alt+I  → Import panel
  // Alt+S  → Sessions panel
  // Alt+A  → Analytics panel
  // Alt+G  → Generate (when on export)
  // Alt+C  → Copy (when on export)
  // Alt+O  → Open tabs (when on import)

  document.addEventListener('keydown', async e => {
    if (!e.altKey) return;

    switch (e.key.toLowerCase()) {
      case 'e': e.preventDefault(); document.getElementById('modeExport').click();    break;
      case 'i': e.preventDefault(); document.getElementById('modeImport').click();    break;
      case 's': e.preventDefault(); document.getElementById('modeSessions').click();  break;
      case 'a': e.preventDefault(); document.getElementById('modeAnalytics').click(); break;
      case 'g': e.preventDefault();
        if (!document.getElementById('panelExport').hidden) await Export.generate();
        break;
      case 'c': e.preventDefault();
        if (!document.getElementById('panelExport').hidden) await Export.copyToClipboard();
        break;
      case 'o': e.preventDefault();
        if (!document.getElementById('panelImport').hidden) document.getElementById('btnOpenTabs').click();
        break;
    }
  });

});
