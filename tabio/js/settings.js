/* ─────────────────────────────────────────────────────────
   settings.js  —  persistent settings store + settings panel
───────────────────────────────────────────────────────── */
'use strict';

const Settings = (() => {

  const KEY = 'tabio_settings';

  const DEFAULTS = {
    excludeIncognito:      false,
    incognitoWarning:      true,
    defaultFormat:         'url',
    confirmThreshold:      10,
    defaultScope:          'window',
    autoSaveOnExport:      true,
  };

  let _cache = { ...DEFAULTS };

  // ── Load / Save ──────────────────────────────────────────

  async function load() {
    const stored = await Storage.get(KEY);
    _cache = { ...DEFAULTS, ...(stored || {}) };
  }

  async function _persist() {
    await Storage.set(KEY, _cache);
  }

  function get(key) {
    return _cache[key] ?? DEFAULTS[key];
  }

  async function set(key, value) {
    _cache[key] = value;
    await _persist();
  }

  // ── Settings panel render ────────────────────────────────

  async function render() {
    await load();
    _bindToggleSetting('settingExcludeIncognito', 'excludeIncognito');
    _bindToggleSetting('settingIncognitoWarning', 'incognitoWarning');
    _bindToggleSetting('settingAutoSave',         'autoSaveOnExport');

    _bindSelectSetting('settingDefaultFormat', 'defaultFormat');
    _bindSelectSetting('settingDefaultScope',  'defaultScope');

    _bindNumberSetting('settingConfirmThreshold', 'confirmThreshold');
  }

  function _bindToggleSetting(elementId, settingKey) {
    const toggle = document.getElementById(elementId);
    if (!toggle) return;
    toggle.classList.toggle('on', !!_cache[settingKey]);
    toggle.closest('.toggle-wrap')?.addEventListener('click', async () => {
      _cache[settingKey] = !_cache[settingKey];
      toggle.classList.toggle('on', _cache[settingKey]);
      await _persist();
    });
  }

  function _bindSelectSetting(elementId, settingKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.value = _cache[settingKey] ?? DEFAULTS[settingKey];
    el.addEventListener('change', async () => {
      _cache[settingKey] = el.value;
      await _persist();
    });
  }

  function _bindNumberSetting(elementId, settingKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.value = _cache[settingKey] ?? DEFAULTS[settingKey];
    el.addEventListener('change', async () => {
      _cache[settingKey] = parseInt(el.value) || DEFAULTS[settingKey];
      await _persist();
    });
  }

  return { load, get, set, render };

})();
