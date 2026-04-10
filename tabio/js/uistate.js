/* ─────────────────────────────────────────────────────────
   uistate.js  —  persist UI state across popup open/close
   Saves: active panel, scope, format, clean chips,
          import toggles, import textarea content,
          batch size/delay values
───────────────────────────────────────────────────────── */
'use strict';

const UIState = (() => {

  const KEY = 'tabio_uistate';

  // Element IDs whose state we track, grouped by type
  const TOGGLE_IDS = [
    'toggleNewWindow', 'toggleIncognito', 'toggleMixedMode',
    'toggleCloseExisting', 'togglePerWindow',
  ];

  const CHIP_TOGGLE_IDS = [
    'cleanDedupe', 'cleanUtm', 'cleanSort', 'cleanGroup', 'cleanIncognito',
  ];

  const SCOPE_IDS = [
    'scopeWindow', 'scopeAll', 'scopeTabGroup', 'scopeWindows', 'scopeSelected',
  ];

  const FORMAT_IDS = [
    'fmtUrl', 'fmtMarkdown', 'fmtTitled', 'fmtJson', 'fmtNotion',
  ];

  const NUMBER_IDS = ['batchSize', 'batchDelay'];

  // ── Save ─────────────────────────────────────────────────

  function save() {
    const state = {
      // Active nav panel — find which mode button is active
      activeMode: (() => {
        const active = document.querySelector('.mode-btn.active');
        return active ? active.id.replace('mode', '').toLowerCase() : 'export';
      })(),

      // Toggles
      toggles: Object.fromEntries(
        TOGGLE_IDS.map(id => {
          const el = document.getElementById(id);
          return [id, el ? el.classList.contains('on') : false];
        })
      ),

      // Chip toggles (clean options)
      chipToggles: Object.fromEntries(
        CHIP_TOGGLE_IDS.map(id => {
          const el = document.getElementById(id);
          return [id, el ? el.classList.contains('on') : false];
        })
      ),

      // Active scope button
      activeScope: (() => {
        const active = SCOPE_IDS.find(id => document.getElementById(id)?.classList.contains('active'));
        return active || 'scopeWindow';
      })(),

      // Active format chip
      activeFormat: (() => {
        const active = FORMAT_IDS.find(id => document.getElementById(id)?.classList.contains('active'));
        return active || 'fmtUrl';
      })(),

      // Number inputs
      numbers: Object.fromEntries(
        NUMBER_IDS.map(id => {
          const el = document.getElementById(id);
          return [id, el ? el.value : '0'];
        })
      ),

      // Import textarea content
      importText: document.getElementById('importTextarea')?.value || '',
    };

    // Fire-and-forget — don't await so UI isn't blocked
    Storage.set(KEY, state).catch(() => {});
  }

  // ── Restore ──────────────────────────────────────────────

  async function restore() {
    const state = await Storage.get(KEY);
    if (!state) return null;

    // Restore toggles (update _toggleState in ui.js and visual class)
    if (state.toggles) {
      Object.entries(state.toggles).forEach(([id, on]) => {
        _toggleState[id] = on;
        document.getElementById(id)?.classList.toggle('on', on);
      });
    }

    // Restore chip toggles
    if (state.chipToggles) {
      Object.entries(state.chipToggles).forEach(([id, on]) => {
        document.getElementById(id)?.classList.toggle('on', on);
      });
    }

    // Restore scope button
    if (state.activeScope) {
      SCOPE_IDS.forEach(id => document.getElementById(id)?.classList.remove('active'));
      document.getElementById(state.activeScope)?.classList.add('active');
    }

    // Restore format chip
    if (state.activeFormat) {
      FORMAT_IDS.forEach(id => document.getElementById(id)?.classList.remove('active'));
      document.getElementById(state.activeFormat)?.classList.add('active');
    }

    // Restore number inputs
    if (state.numbers) {
      Object.entries(state.numbers).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
    }

    // Restore import textarea
    if (state.importText) {
      const ta = document.getElementById('importTextarea');
      if (ta) {
        ta.value = state.importText;
      }
    }

    return state;
  }

  // ── Wire autosave listeners ──────────────────────────────

  function wireAutosave() {
    // Save on any toggle click
    TOGGLE_IDS.forEach(id => {
      document.getElementById(id)?.closest('.toggle-wrap')
        ?.addEventListener('click', () => setTimeout(save, 50));
    });

    // Save on any chip toggle click
    CHIP_TOGGLE_IDS.forEach(id => {
      document.getElementById(id)
        ?.addEventListener('click', () => setTimeout(save, 50));
    });

    // Save on scope/format chip clicks
    [...SCOPE_IDS, ...FORMAT_IDS].forEach(id => {
      document.getElementById(id)
        ?.addEventListener('click', () => setTimeout(save, 50));
    });

    // Save on number input change
    NUMBER_IDS.forEach(id => {
      document.getElementById(id)
        ?.addEventListener('change', () => setTimeout(save, 50));
    });

    // Save on textarea input (debounced — don't thrash storage on every keystroke)
    let _textTimer;
    document.getElementById('importTextarea')
      ?.addEventListener('input', () => {
        clearTimeout(_textTimer);
        _textTimer = setTimeout(save, 800);
      });

    // Save on nav tab click
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(save, 50));
    });
  }

  return { save, restore, wireAutosave };

})();
