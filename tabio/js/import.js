/* ─────────────────────────────────────────────────────────
   import.js  —  text → tabs: parse, preview, open (batched)
───────────────────────────────────────────────────────── */
'use strict';

const Import = (() => {

  // ── State ────────────────────────────────────────────────
  let _parsedUrls   = [];    // all detected URLs
  let _selectedUrls = new Set();  // user-selected subset

  // ── URL Parser ───────────────────────────────────────────

  function parseUrls(text) {
    const seen = new Set();

    const add = raw => {
      const clean = raw.trim().replace(/[)\]>,"']+$/, '');
      try { new URL(clean); seen.add(clean); } catch {}
    };

    // 1. Markdown [Title](url)
    for (const m of text.matchAll(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)) add(m[1]);

    // 2. Title: url  /  Title | url  (line-based)
    for (const m of text.matchAll(/^.+?(?::\s*|[\s|]+)(https?:\/\/\S+)/gm)) add(m[1]);

    // 3. JSON array of {url} objects or plain url strings
    try {
      const json = JSON.parse(text);
      const arr  = Array.isArray(json) ? json : [json];
      arr.forEach(item => {
        if (typeof item === 'string')      add(item);
        else if (item && item.url)         add(item.url);
      });
    } catch {}

    // 4. Plain URLs
    for (const m of text.matchAll(/https?:\/\/[^\s\[\]()<>,"']+/g)) add(m[0]);

    return [...seen];
  }

  function isValidUrl(url) {
    try { new URL(url); return true; } catch { return false; }
  }

  // ── Preview ──────────────────────────────────────────────

  function _renderPreview(urls) {
    _parsedUrls = urls;
    _selectedUrls = new Set(urls.filter(isValidUrl));

    const preview = document.getElementById('parsedPreview');
    const label   = document.getElementById('parsedLabel');
    const list    = document.getElementById('parsedUrlList');
    const badge   = document.getElementById('urlCountBadge');

    const validCount = urls.filter(isValidUrl).length;

    if (urls.length === 0) {
      preview.hidden = true;
      badge.hidden   = true;
      return;
    }

    label.textContent   = `${validCount} valid URL${validCount !== 1 ? 's' : ''} detected`;
    badge.textContent   = `${validCount} URLs`;
    badge.hidden        = false;
    preview.hidden      = false;

    list.innerHTML = urls.map(url => {
      const valid = isValidUrl(url);
      const sel   = _selectedUrls.has(url);
      return `
        <div class="parsed-url-item ${sel ? 'selected' : 'deselected'}" data-url="${_esc(url)}">
          <div class="parsed-item-check"></div>
          ${!valid ? '<span class="invalid-badge">invalid</span>' : ''}
          <span class="parsed-item-url" title="${_esc(url)}">${_esc(url)}</span>
        </div>
      `;
    }).join('');

    // Click to toggle individual URL
    list.querySelectorAll('.parsed-url-item').forEach(row => {
      const url = row.dataset.url;
      if (!isValidUrl(url)) return;  // can't select invalid
      row.addEventListener('click', () => {
        if (_selectedUrls.has(url)) {
          _selectedUrls.delete(url);
          row.classList.replace('selected', 'deselected');
        } else {
          _selectedUrls.add(url);
          row.classList.replace('deselected', 'selected');
        }
      });
    });
  }

  // ── Open tabs ────────────────────────────────────────────

  async function openTabs() {
    const text = document.getElementById('importTextarea').value.trim();
    if (!text) { showToast('Paste some text first!'); return; }

    // Use selected subset if preview is visible, else re-parse
    const urls = _parsedUrls.length > 0
      ? [..._selectedUrls]
      : parseUrls(text).filter(isValidUrl);

    if (urls.length === 0) { showToast('No valid URLs to open!'); return; }

    const batchSize  = parseInt(document.getElementById('batchSize').value)  || 0;
    const batchDelay = parseInt(document.getElementById('batchDelay').value) || 0;
    const useNewWindow   = getToggle('toggleNewWindow');
    const closeExisting  = getToggle('toggleCloseExisting');

    _setStatus(true, `Opening ${urls.length} tab${urls.length !== 1 ? 's' : ''}…`);

    try {
      let existingIds = [];
      if (closeExisting) {
        const existing = await TabsAPI.getCurrentWindowTabs();
        existingIds = existing.map(t => t.id);
      }

      if (useNewWindow) {
        await TabsAPI.openInNewWindow(urls);
      } else if (batchSize > 0 || batchDelay > 0) {
        await TabsAPI.openInCurrentWindowBatched(urls, batchSize, batchDelay);
      } else {
        await TabsAPI.openInCurrentWindow(urls);
      }

      if (closeExisting) await TabsAPI.closeTabs(existingIds);

      await Analytics.recordImport(urls.length);

      _setStatus(true, `✓ Opened ${urls.length} tabs`);
      setTimeout(() => _setStatus(false), 2500);
      showToast(`✓ Opened ${urls.length} tabs!`);

    } catch (err) {
      _setStatus(false);
      showToast('Error: ' + err.message);
    }
  }

  // ── File loading ─────────────────────────────────────────

  function _handleFileLoad(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      document.getElementById('importTextarea').value = text;
      const urls = parseUrls(text);
      document.getElementById('charCount').textContent = `${text.length} chars`;
      _renderPreview(urls);
      showToast(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  }

  // ── Helpers ──────────────────────────────────────────────

  function _setStatus(visible, message = '') {
    const bar = document.getElementById('statusBar');
    bar.hidden = !visible;
    if (message) document.getElementById('statusText').textContent = message;
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function clear() {
    document.getElementById('importTextarea').value = '';
    document.getElementById('charCount').textContent = '0 chars';
    document.getElementById('parsedPreview').hidden  = true;
    document.getElementById('urlCountBadge').hidden  = true;
    _parsedUrls   = [];
    _selectedUrls = new Set();
    _setStatus(false);
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    initToggle('toggleNewWindow');
    initToggle('toggleCloseExisting');
    bindToggle('toggleNewWindow');
    bindToggle('toggleCloseExisting');

    document.getElementById('importTextarea').addEventListener('input', e => {
      const text = e.target.value;
      document.getElementById('charCount').textContent = `${text.length} chars`;
      _renderPreview(parseUrls(text));
    });

    // Select all / none
    document.getElementById('selectAllUrls').addEventListener('click', () => {
      _selectedUrls = new Set(_parsedUrls.filter(isValidUrl));
      document.querySelectorAll('.parsed-url-item').forEach(row => {
        if (isValidUrl(row.dataset.url)) row.classList.replace('deselected', 'selected');
      });
    });

    document.getElementById('deselectAllUrls').addEventListener('click', () => {
      _selectedUrls.clear();
      document.querySelectorAll('.parsed-url-item').forEach(row => {
        row.classList.replace('selected', 'deselected');
      });
    });

    // File loading
    document.getElementById('btnLoadFile').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', e => {
      _handleFileLoad(e.target.files[0]);
      e.target.value = '';
    });

    document.getElementById('btnOpenTabs').addEventListener('click', openTabs);
    document.getElementById('btnClear').addEventListener('click', clear);
  }

  return { init, parseUrls };

})();
