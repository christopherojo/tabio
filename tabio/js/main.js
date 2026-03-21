/* ─────────────────────────────────────────────────────────
   main.js  —  entry point, wires up mode switching + modules
───────────────────────────────────────────────────────── */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Tab count badge ──────────────────────────────────────
  const tabs = await TabsAPI.getCurrentWindowTabs();
  document.getElementById('tabCountBadge').textContent =
    `${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`;

  // ── Mode toggle ──────────────────────────────────────────
  document.getElementById('modeExport').addEventListener('click', () => switchMode('export'));
  document.getElementById('modeImport').addEventListener('click', () => switchMode('import'));

  // ── Init modules ─────────────────────────────────────────
  await Export.init();
  Import.init();

});
