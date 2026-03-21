/* ─────────────────────────────────────────────────────────
   import.js  —  text → tabs logic + URL parsing
───────────────────────────────────────────────────────── */

'use strict';

const Import = (() => {

  // ── URL Parser ───────────────────────────────────────────

  /**
   * Extract all valid URLs from an arbitrary block of text.
   * Handles: plain URLs, Markdown [title](url), Title: url, Title | url
   */
  function parseUrls(text) {
    const seen = new Set();

    const add = (url) => {
      const clean = url.trim().replace(/[)\]>,"']+$/, '');
      try {
        new URL(clean);            // validates it's a real URL
        seen.add(clean);
      } catch { /* skip invalid */ }
    };

    // 1. Markdown: [Title](url)
    const markdownRe = /\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
    for (const m of text.matchAll(markdownRe)) add(m[1]);

    // 2. Title: url  or  Title | url
    const titledRe = /(?:^|\n)[^\n]+?(?::\s*|[\s|]+(https?:\/\/))/gm;
    // Simpler approach — extract any https:// that follows a non-URL prefix on same line
    const lineRe = /^.+?(?::\s*|[\s|]+)(https?:\/\/\S+)/gm;
    for (const m of text.matchAll(lineRe)) add(m[1]);

    // 3. All remaining plain URLs
    const plainRe = /https?:\/\/[^\s\[\]()<>,"']+/g;
    for (const m of text.matchAll(plainRe)) add(m[0]);

    return [...seen];
  }

  // ── Preview ──────────────────────────────────────────────

  function updatePreview(urls) {
    const preview  = document.getElementById('parsedPreview');
    const label    = document.getElementById('parsedLabel');
    const urlList  = document.getElementById('parsedUrlList');

    if (urls.length === 0) {
      preview.hidden = true;
      return;
    }

    label.textContent = `${urls.length} URL${urls.length !== 1 ? 's' : ''} detected`;
    const shown = urls.slice(0, 8);
    urlList.innerHTML = shown
      .map(u => `<div class="parsed-url-item">→ <span class="url-text">${_escapeHtml(u)}</span></div>`)
      .join('');
    if (urls.length > 8) {
      urlList.innerHTML += `<div class="parsed-url-item">… and ${urls.length - 8} more</div>`;
    }

    preview.hidden = false;
  }

  // ── Open tabs ────────────────────────────────────────────

  async function openTabs() {
    const text = document.getElementById('importTextarea').value.trim();
    if (!text) { showToast('Paste some text first!'); return; }

    const urls = parseUrls(text);
    if (urls.length === 0) { showToast('No valid URLs found!'); return; }

    _setStatus(true, `Opening ${urls.length} tab${urls.length !== 1 ? 's' : ''}…`);

    try {
      const useNewWindow    = getToggle('toggleNewWindow');
      const closeExisting   = getToggle('toggleCloseExisting');

      // Snapshot current tabs before opening new ones
      let existingIds = [];
      if (closeExisting) {
        const existing = await TabsAPI.getCurrentWindowTabs();
        existingIds = existing.map(t => t.id);
      }

      if (useNewWindow) {
        await TabsAPI.openInNewWindow(urls);
      } else {
        await TabsAPI.openInCurrentWindow(urls);
      }

      if (closeExisting) {
        await TabsAPI.closeTabs(existingIds);
      }

      _setStatus(true, `✓ Opened ${urls.length} tabs`);
      setTimeout(() => _setStatus(false), 2500);
      showToast(`✓ Opened ${urls.length} tabs!`);

    } catch (err) {
      _setStatus(false);
      showToast('Error: ' + err.message);
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  function _setStatus(visible, message = '') {
    const bar = document.getElementById('statusBar');
    bar.hidden = !visible;
    if (message) document.getElementById('statusText').textContent = message;
  }

  function _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function clear() {
    document.getElementById('importTextarea').value = '';
    document.getElementById('charCount').textContent = '0 characters';
    document.getElementById('parsedPreview').hidden = true;
    _setStatus(false);
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    initToggle('toggleNewWindow');
    initToggle('toggleCloseExisting');
    bindToggle('toggleNewWindow');
    bindToggle('toggleCloseExisting');

    document.getElementById('importTextarea').addEventListener('input', (e) => {
      const text = e.target.value;
      document.getElementById('charCount').textContent = `${text.length} character${text.length !== 1 ? 's' : ''}`;
      updatePreview(parseUrls(text));
    });

    document.getElementById('btnOpenTabs').addEventListener('click', openTabs);
    document.getElementById('btnClear').addEventListener('click', clear);
  }

  return { init };

})();
