/* ─────────────────────────────────────────────────────────
   settings.js  —  persistent settings store + settings panel
───────────────────────────────────────────────────────── */
'use strict';

const Settings = (() => {

  const KEY = 'tabio_settings';

  const DEFAULTS = {
    excludeIncognito:  false,
    incognitoWarning:  true,
    defaultFormat:     'url',
    confirmThreshold:  10,
    defaultScope:      'window',
    autoSaveOnExport:  true,
  };

  let _cache   = { ...DEFAULTS };
  let _bound   = false;   // guard — only bind listeners once

  // ── Load / Save ──────────────────────────────────────────

  async function load() {
    const stored = await Storage.get(KEY);
    _cache = { ...DEFAULTS, ...(stored || {}) };
  }

  async function _persist() {
    await Storage.set(KEY, _cache);
  }

  function get(key) { return _cache[key] ?? DEFAULTS[key]; }

  async function set(key, value) {
    _cache[key] = value;
    await _persist();
  }

  // ── Render settings panel ────────────────────────────────
  // Called every time the Settings tab is clicked.
  // Syncs current values to the DOM. Binds listeners only once.

  async function render() {
    await load();

    // Always sync current values to UI
    _syncToggle('settingExcludeIncognito', 'excludeIncognito');
    _syncToggle('settingIncognitoWarning', 'incognitoWarning');
    _syncToggle('settingAutoSave',         'autoSaveOnExport');
    _syncSelect('settingDefaultFormat',    'defaultFormat');
    _syncSelect('settingDefaultScope',     'defaultScope');
    _syncNumber('settingConfirmThreshold', 'confirmThreshold');

    // Bind listeners only on first render
    if (_bound) return;
    _bound = true;

    _bindToggle('settingExcludeIncognito', 'excludeIncognito');
    _bindToggle('settingIncognitoWarning', 'incognitoWarning');
    _bindToggle('settingAutoSave',         'autoSaveOnExport');
    _bindSelect('settingDefaultFormat',    'defaultFormat');
    _bindSelect('settingDefaultScope',     'defaultScope');
    _bindNumber('settingConfirmThreshold', 'confirmThreshold');
  }

  // ── Sync (value → DOM) ───────────────────────────────────

  function _syncToggle(elementId, key) {
    document.getElementById(elementId)?.classList.toggle('on', !!_cache[key]);
  }

  function _syncSelect(elementId, key) {
    const el = document.getElementById(elementId);
    if (el) el.value = _cache[key] ?? DEFAULTS[key];
  }

  function _syncNumber(elementId, key) {
    const el = document.getElementById(elementId);
    if (el) el.value = _cache[key] ?? DEFAULTS[key];
  }

  // ── Bind (DOM → storage) — called once ───────────────────

  function _bindToggle(elementId, key) {
    const toggle = document.getElementById(elementId);
    if (!toggle) return;
    toggle.closest('.toggle-wrap')?.addEventListener('click', async () => {
      _cache[key] = !_cache[key];
      toggle.classList.toggle('on', _cache[key]);
      await _persist();
    });
  }

  function _bindSelect(elementId, key) {
    document.getElementById(elementId)?.addEventListener('change', async e => {
      _cache[key] = e.target.value;
      await _persist();
    });
  }

  function _bindNumber(elementId, key) {
    document.getElementById(elementId)?.addEventListener('change', async e => {
      _cache[key] = parseInt(e.target.value) || DEFAULTS[key];
      await _persist();
    });
  }

  return { load, get, set, render };

})();
