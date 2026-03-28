/* ─────────────────────────────────────────────────────────
   theme.js  —  dark / light mode toggle + persistence
───────────────────────────────────────────────────────── */
'use strict';

const Theme = (() => {

  const KEY = 'tabio_theme';

  async function init() {
    // Load saved preference, fall back to system preference
    const saved = await Storage.get(KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved !== null ? saved === 'dark' : prefersDark;

    _apply(isDark);

    document.getElementById('themeToggle').addEventListener('click', toggle);
  }

  async function toggle() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    _apply(!isDark);
    await Storage.set(KEY, !isDark ? 'dark' : 'light');
  }

  function _apply(dark) {
    if (dark) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }

  return { init };

})();
