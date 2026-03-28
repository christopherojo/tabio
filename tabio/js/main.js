/* ─────────────────────────────────────────────────────────
   main.js  —  entry point: init modules, nav, shortcuts
───────────────────────────────────────────────────────── */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Tab count badge ──────────────────────────────────────
  const tabs = await TabsAPI.getCurrentWindowTabs();
  document.getElementById('tabCountBadge').textContent =
    `${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`;

  // ── Nav ──────────────────────────────────────────────────
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

  // ── Init modules ─────────────────────────────────────────
  await Theme.init();
  await Export.init();
  Import.init();
  Sessions.init();
  Analytics.init();

  // ── Keyboard shortcuts ───────────────────────────────────
  // Alt+E  → Export       Alt+I → Import
  // Alt+S  → Sessions     Alt+A → Analytics
  // Alt+G  → Generate     Alt+C → Copy
  // Alt+O  → Open tabs    Alt+U → Undo import
  // Alt+F  → Focus filter (import panel)

  document.addEventListener('keydown', async e => {
    if (!e.altKey) return;

    const exportVisible = !document.getElementById('panelExport').hidden;
    const importVisible = !document.getElementById('panelImport').hidden;

    switch (e.key.toLowerCase()) {
      case 'e': e.preventDefault(); document.getElementById('modeExport').click();    break;
      case 'i': e.preventDefault(); document.getElementById('modeImport').click();    break;
      case 's': e.preventDefault(); document.getElementById('modeSessions').click();  break;
      case 'a': e.preventDefault(); document.getElementById('modeAnalytics').click(); break;
      case 'g':
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
