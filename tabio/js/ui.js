/* ─────────────────────────────────────────────────────────
   ui.js  —  generic UI helpers (toast, toggles, mode)
───────────────────────────────────────────────────────── */

'use strict';

// ── Toast ──────────────────────────────────────────────────

let _toastTimer = null;

function showToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Mode switching ─────────────────────────────────────────

function switchMode(mode) {
  const isExport = mode === 'export';

  document.getElementById('modeExport').classList.toggle('active', isExport);
  document.getElementById('modeImport').classList.toggle('active', !isExport);
  document.getElementById('modeExport').setAttribute('aria-selected', isExport);
  document.getElementById('modeImport').setAttribute('aria-selected', !isExport);

  document.getElementById('panelExport').hidden = !isExport;
  document.getElementById('panelImport').hidden = isExport;
}

// ── Toggle (on/off switch) ─────────────────────────────────

const _toggleState = {};

function initToggle(id) {
  _toggleState[id] = false;
}

function bindToggle(id, onChange) {
  const el = document.getElementById(id);
  el.closest('.toggle-wrap').addEventListener('click', () => {
    _toggleState[id] = !_toggleState[id];
    el.classList.toggle('on', _toggleState[id]);
    if (onChange) onChange(_toggleState[id]);
  });
}

function getToggle(id) {
  return !!_toggleState[id];
}

// ── Scope buttons ──────────────────────────────────────────

function bindScopeButtons(ids, onChange) {
  ids.forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      ids.forEach(i => document.getElementById(i).classList.remove('active'));
      document.getElementById(id).classList.add('active');
      const scope = id.replace('scope', '').toLowerCase();
      onChange(scope);
    });
  });
}

// ── Format chips ───────────────────────────────────────────

function bindChips(ids, onChange) {
  ids.forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      ids.forEach(i => document.getElementById(i).classList.remove('active'));
      document.getElementById(id).classList.add('active');
      const fmt = id.replace('fmt', '').toLowerCase();
      onChange(fmt);
    });
  });
}
