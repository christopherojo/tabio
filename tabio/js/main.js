/* ─────────────────────────────────────────────────────────
   main.js  —  entry point
───────────────────────────────────────────────────────── */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  // Tab count badge
  const tabs = await TabsAPI.getCurrentWindowTabs();
  document.getElementById('tabCountBadge').textContent =
    `${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`;

  // Nav
  const navMap = {
    modeExport:    'export',
    modeImport:    'import',
    modeSessions:  'sessions',
    modeGroups:    'groups',
    modeAnalytics: 'analytics',
    modeSettings:  'settings',
  };

  // Update ui.js panel/btn lists to include new panels
  _allPanels.push('panelGroups','panelSettings');
  _allModeBtns.push('modeGroups','modeSettings');

  Object.entries(navMap).forEach(([btnId, mode]) => {
    document.getElementById(btnId).addEventListener('click', async () => {
      switchMode(mode);
      if (mode === 'sessions')  await Sessions.render();
      if (mode === 'groups')    await Groups.render();
      if (mode === 'analytics') await Analytics.render();
      if (mode === 'settings')  await Settings.render();
    });
  });

  // Init modules
  await Settings.load();
  await Theme.init();
  await Export.init();
  Import.init();
  Sessions.init();
  Groups.init();
  Analytics.init();

  // Keyboard shortcuts
  document.addEventListener('keydown', async e => {
    if (!e.altKey) return;

    const exportVisible   = !document.getElementById('panelExport').hidden;
    const importVisible   = !document.getElementById('panelImport').hidden;

    switch (e.key.toLowerCase()) {
      case 'e':        e.preventDefault(); document.getElementById('modeExport').click();    break;
      case 'i':        e.preventDefault(); document.getElementById('modeImport').click();    break;
      case 's':        e.preventDefault(); document.getElementById('modeSessions').click();  break;
      case 'g':
        // Alt+G: generate on export, else go to Groups
        if (exportVisible) { e.preventDefault(); await Export.generate(); }
        else { e.preventDefault(); document.getElementById('modeGroups').click(); }
        break;
      case 'a':        e.preventDefault(); document.getElementById('modeAnalytics').click(); break;
      case ',':        e.preventDefault(); document.getElementById('modeSettings').click();  break;
      case 'enter':
        e.preventDefault();
        if (exportVisible) await Export.generate();
        break;
      case 'c':
        e.preventDefault();
        if (exportVisible) await Export.copyToClipboard();
        break;
      case 'o':
        e.preventDefault();
        if (importVisible) document.getElementById('btnOpenTabs').click();
        break;
      case 'u':
        e.preventDefault();
        if (importVisible) await Import.undoLastImport();
        break;
      case 'f':
        e.preventDefault();
        if (importVisible) {
          const f = document.getElementById('previewFilterInput');
          if (f && !document.getElementById('parsedPreview').hidden) f.focus();
        }
        break;
    }
  });

});
