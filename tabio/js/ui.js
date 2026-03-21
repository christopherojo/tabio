/* ─────────────────────────────────────────────────────────
   ui.js  —  toast, mode switching, toggles, chips, scope
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

// ── Mode (tab nav) ─────────────────────────────────────────
const _allPanels  = ['panelExport','panelImport','panelSessions','panelAnalytics'];
const _allModeBtns= ['modeExport','modeImport','modeSessions','modeAnalytics'];

function switchMode(mode) {
  _allModeBtns.forEach(id => {
    const btn = document.getElementById(id);
    const active = btn.dataset.panel === 'panel' + _cap(mode);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
  });
  _allPanels.forEach(id => {
    document.getElementById(id).hidden = (id !== 'panel' + _cap(mode));
  });
}

function _cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Toggles ────────────────────────────────────────────────
const _toggleState = {};

function initToggle(id) { _toggleState[id] = false; }

function bindToggle(id, onChange) {
  document.getElementById(id).closest('.toggle-wrap')
    .addEventListener('click', () => {
      _toggleState[id] = !_toggleState[id];
      document.getElementById(id).classList.toggle('on', _toggleState[id]);
      if (onChange) onChange(_toggleState[id]);
    });
}

function getToggle(id) { return !!_toggleState[id]; }

// ── Scope buttons ──────────────────────────────────────────
function bindScopeButtons(ids, onChange) {
  ids.forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      ids.forEach(i => document.getElementById(i).classList.remove('active'));
      document.getElementById(id).classList.add('active');
      onChange(id.replace('scope','').toLowerCase());
    });
  });
}

// ── Format chips ───────────────────────────────────────────
function bindChips(ids, onChange) {
  ids.forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      ids.forEach(i => document.getElementById(i).classList.remove('active'));
      document.getElementById(id).classList.add('active');
      onChange(id.replace('fmt','').toLowerCase());
    });
  });
}

// ── Chip toggles (on/off) ──────────────────────────────────
function bindChipToggle(id, onChange) {
  document.getElementById(id).addEventListener('click', () => {
    const el = document.getElementById(id);
    const on = el.classList.toggle('on');
    if (onChange) onChange(on);
  });
}

function getChipToggle(id) {
  return document.getElementById(id).classList.contains('on');
}
