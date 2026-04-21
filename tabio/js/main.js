/* ─────────────────────────────────────────────────────────
   main.js  —  entry point
───────────────────────────────────────────────────────── */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  // Tab count badge
  const tabs = await TabsAPI.getCurrentWindowTabs();
  document.getElementById('tabCountBadge').textContent =
    `${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`;

  registerPanels(['panelGroups', 'panelSettings']);
  registerModeButtons(['modeGroups', 'modeSettings']);

  // Nav wiring
  const navMap = {
    modeExport:    'export',
    modeImport:    'import',
    modeSessions:  'sessions',
    modeGroups:    'groups',
    modeAnalytics: 'analytics',
    modeSettings:  'settings',
  };

  Object.entries(navMap).forEach(([btnId, mode]) => {
    document.getElementById(btnId).addEventListener('click', async () => {
      switchMode(mode);
      if (mode === 'sessions')  await Sessions.render();
      if (mode === 'groups')    await Groups.render();
      if (mode === 'analytics') await Analytics.render();
      if (mode === 'settings')  await Settings.render();
    });
  });

  // Init modules (settings first — others may read Settings.get())
  await Settings.load();
  await Settings.render();
  await Theme.init();
  await Export.init();
  Import.init();
  Sessions.init();
  Groups.init();
  Analytics.init();

  // Restore persisted UI state
  const savedMode = await UIState.restore();

  // Switch to the panel the user was on when they last closed the popup
  if (savedMode && savedMode !== 'export') {
    switchMode(savedMode);
    // Trigger any lazy-render for that panel
    if (savedMode === 'sessions')  await Sessions.render();
    if (savedMode === 'groups')    await Groups.render();
    if (savedMode === 'analytics') await Analytics.render();
    if (savedMode === 'settings')  await Settings.render();
  }

  // Wire autosave listeners (after all modules init so elements exist)
  UIState.wireAutosave();

  // Keyboard shortcuts
  // Alt+E Export  Alt+I Import  Alt+S Sessions  Alt+G Groups/Generate
  // Alt+A Stats   Alt+, Settings  Alt+Enter Generate  Alt+C Copy
  // Alt+O Open tabs  Alt+U Undo  Alt+F Focus filter

  document.addEventListener('keydown', async e => {
    if (!e.altKey) return;

    const exportVisible = !document.getElementById('panelExport').hidden;
    const importVisible = !document.getElementById('panelImport').hidden;

    switch (e.key.toLowerCase()) {
      case 'e': e.preventDefault(); document.getElementById('modeExport').click();    break;
      case 'i': e.preventDefault(); document.getElementById('modeImport').click();    break;
      case 's': e.preventDefault(); document.getElementById('modeSessions').click();  break;
      case 'g':
        e.preventDefault();
        if (exportVisible) await Export.generate();
        else document.getElementById('modeGroups').click();
        break;
      case 'a': e.preventDefault(); document.getElementById('modeAnalytics').click(); break;
      case ',': e.preventDefault(); document.getElementById('modeSettings').click();  break;
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
