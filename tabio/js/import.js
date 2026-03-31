/* ─────────────────────────────────────────────────────────
   import.js  —  text → tabs
   Features: grouped preview, search/filter, domain insights,
             tab-count confirmation, undo, per-window opening,
             auto-parse on paste, structured section parsing
───────────────────────────────────────────────────────── */
'use strict';

const Import = (() => {

  // ── State ────────────────────────────────────────────────
  let _sections      = [];          // [{ label, groupColor, urls[] }]
  let _selectedUrls  = new Set();
  let _lastOpenedIds = [];          // tab IDs opened in last import (for undo)
  let _filterText    = '';
  const CONFIRM_THRESHOLD = 10;    // show confirmation above this many tabs

  // ── URL scheme classification ────────────────────────────

  const OPENABLE_SCHEMES   = new Set(['http:', 'https:', 'file:', 'ftp:']);
  const RESTRICTED_SCHEMES = new Set([
    'chrome:', 'chrome-extension:', 'edge:', 'brave:', 'opera:',
    'about:', 'data:', 'javascript:', 'vivaldi:', 'firefox:',
  ]);

  const URL_REGEX = /(?:https?|file|ftp|chrome|chrome-extension|edge|brave|opera|about|vivaldi):\/\/[^\s\[\]()<>,"'\n]+/g;

  function classifyUrl(url) {
    try {
      const u = new URL(url);
      if (OPENABLE_SCHEMES.has(u.protocol))    return 'openable';
      if (RESTRICTED_SCHEMES.has(u.protocol))  return 'restricted';
      return 'unknown';
    } catch {
      const scheme = url.split('://')[0].toLowerCase() + ':';
      if (RESTRICTED_SCHEMES.has(scheme + '//') || RESTRICTED_SCHEMES.has(scheme)) return 'restricted';
      return 'invalid';
    }
  }

  function isUsable(url)   { const c = classifyUrl(url); return c === 'openable' || c === 'restricted'; }
  function isOpenable(url) { return classifyUrl(url) === 'openable'; }

  // ── Structured section parser ────────────────────────────

  /**
   * Parse text into structured sections. Recognises:
   *   Window headers:    "── Window 1 (current) · 5 tabs ──"
   *   Tab group headers: "[BLUE] Research (3 tabs)"
   *   Domain headers:    "── github.com (2) ──"
   *   Markdown headers:  "## Section Name" / "# Title"
   *
   * Returns: [{ label: string|null, groupColor: string|null, urls: string[] }]
   */
  function parseSections(text) {
    const lines = text.split('\n');
    const sections = [];
    let current = { label: null, groupColor: null, urls: [] };

    const WINDOW_RE   = /^──\s+Window\s+\d+/;
    const GROUP_RE    = /^\[([A-Z]+)\]\s+(.+?)(?:\s+\(\d+\s+tabs?\))?$/;
    const DOMAIN_RE   = /^──\s+[\w.-]+(?:\s+\(\d+\))\s+──\s*$/;
    const MARKDOWN_RE = /^#{1,3}\s+(.+)/;
    const UNGROUPED_RE= /^──\s+Ungrouped\s+──/;

    const isHeader = line =>
      WINDOW_RE.test(line)   ||
      GROUP_RE.test(line)    ||
      DOMAIN_RE.test(line)   ||
      MARKDOWN_RE.test(line) ||
      UNGROUPED_RE.test(line);

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (isHeader(line)) {
        // Flush current section if it has URLs
        if (current.urls.length > 0) sections.push(current);

        let label = null;
        let groupColor = null;

        const gm = GROUP_RE.exec(line);
        if (gm) {
          groupColor = gm[1].toLowerCase();
          label = gm[2].trim();
        } else if (WINDOW_RE.test(line)) {
          label = line.replace(/^──\s*/, '').replace(/\s*──$/, '').trim();
        } else if (DOMAIN_RE.test(line)) {
          label = line.replace(/^──\s*/, '').replace(/\s*──$/, '').trim();
        } else if (UNGROUPED_RE.test(line)) {
          label = 'Ungrouped';
        } else {
          const mm = MARKDOWN_RE.exec(line);
          if (mm) label = mm[1].trim();
        }

        current = { label, groupColor, urls: [] };
      } else {
        // Try to extract URLs from this line
        const extracted = _extractUrlsFromLine(line);
        extracted.forEach(u => {
          if (!current.urls.includes(u)) current.urls.push(u);
        });
      }
    }

    if (current.urls.length > 0) sections.push(current);

    // If nothing structured found, single flat section
    if (sections.length === 0) {
      const urls = _extractUrls(text);
      return urls.length > 0 ? [{ label: null, groupColor: null, urls }] : [];
    }

    return sections;
  }

  function _extractUrlsFromLine(line) {
    const results = [];
    const add = raw => {
      const clean = raw.trim().replace(/[)\]>,"']+$/, '');
      if (clean && isUsable(clean) && !results.includes(clean)) results.push(clean);
    };
    for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) add(m[1]);
    for (const m of line.matchAll(URL_REGEX)) add(m[0]);
    return results;
  }

  function _extractUrls(text) {
    const seen = new Set();
    const add = raw => {
      const clean = raw.trim().replace(/[)\]>,"']+$/, '');
      if (clean && isUsable(clean)) seen.add(clean);
    };
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) add(m[1]);
    for (const m of text.matchAll(/^.+?(?::\s*|[\s|]+)((?:https?|file|ftp|chrome|edge|brave|opera|about|vivaldi):\/\/\S+)/gm)) add(m[1]);
    try {
      const json = JSON.parse(text);
      const arr  = Array.isArray(json) ? json : [json];
      arr.forEach(item => {
        if (typeof item === 'string') add(item);
        else if (item?.url)           add(item.url);
      });
    } catch {}
    for (const m of text.matchAll(URL_REGEX)) add(m[0]);
    return [...seen];
  }

  function parseUrls(text) {
    return parseSections(text).flatMap(s => s.urls);
  }

  // ── Domain insights ──────────────────────────────────────

  function _buildDomainInsights(sections) {
    const counts = {};
    sections.forEach(s => s.urls.forEach(url => {
      try {
        const h = new URL(url).hostname.replace(/^www\./, '');
        counts[h] = (counts[h] || 0) + 1;
      } catch {}
    }));
    return Object.entries(counts)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 6);
  }

  // ── Preview render ───────────────────────────────────────

  const GROUP_COLOR_MAP = {
    grey:'#9aa0a6', blue:'#1a73e8', red:'#ea4335',
    yellow:'#fbbc04', green:'#34a853', pink:'#f06292',
    purple:'#7b1fa2', cyan:'#00acc1', orange:'#ef6c00',
  };

  function _renderPreview() {
    const allUrls    = _sections.flatMap(s => s.urls);
    const usable     = allUrls.filter(isUsable);
    const preview    = document.getElementById('parsedPreview');
    const label      = document.getElementById('parsedLabel');
    const badge      = document.getElementById('urlCountBadge');
    const list       = document.getElementById('parsedUrlList');
    const insightsEl = document.getElementById('domainInsights');
    const filterEl   = document.getElementById('previewFilter');

    if (allUrls.length === 0) {
      preview.hidden = true;
      badge.hidden   = true;
      return;
    }

    const selectedCount = [..._selectedUrls].filter(isOpenable).length;
    label.textContent = `${usable.length} URL${usable.length !== 1 ? 's' : ''} · ${selectedCount} selected`;
    badge.textContent = `${usable.length} URLs`;
    badge.hidden      = false;
    preview.hidden    = false;
    filterEl.hidden   = usable.length < 5;

    // Domain insights
    const insights = _buildDomainInsights(_sections);
    if (insights.length > 0) {
      insightsEl.hidden   = false;
      insightsEl.innerHTML = insights.map(([d, n]) =>
        `<span class="insight-chip" data-domain="${_esc(d)}">${_esc(d)} <span class="insight-count">${n}</span></span>`
      ).join('');
      insightsEl.querySelectorAll('.insight-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const domain = chip.dataset.domain;
          document.getElementById('previewFilterInput').value = domain;
          _filterText = domain;
          _renderPreview();
        });
      });
    } else {
      insightsEl.hidden = true;
    }

    // Render sections
    const filter = _filterText.toLowerCase();
    list.innerHTML = '';

    _sections.forEach(section => {
      const visibleUrls = section.urls.filter(url =>
        !filter || url.toLowerCase().includes(filter)
      );
      if (visibleUrls.length === 0) return;

      // Section header
      if (section.label) {
        const header = document.createElement('div');
        header.className = 'preview-section-header';

        const colorDot = section.groupColor && GROUP_COLOR_MAP[section.groupColor]
          ? `<span class="preview-section-dot" style="background:${GROUP_COLOR_MAP[section.groupColor]}"></span>`
          : '';

        const sectionSelected = visibleUrls.filter(u => _selectedUrls.has(u) && isOpenable(u)).length;
        const sectionOpenable = visibleUrls.filter(isOpenable).length;

        header.innerHTML = `
          <div class="preview-section-left">
            ${colorDot}
            <span class="preview-section-label">${_esc(section.label)}</span>
            <span class="preview-section-count">${visibleUrls.length}</span>
          </div>
          <div class="preview-section-actions">
            <button class="text-btn preview-section-toggle" data-section="${_esc(section.label)}">
              ${sectionSelected === sectionOpenable && sectionOpenable > 0 ? 'Deselect' : 'Select'} all
            </button>
          </div>
        `;

        header.querySelector('.preview-section-toggle').addEventListener('click', e => {
          e.stopPropagation();
          const allSel = visibleUrls.filter(isOpenable).every(u => _selectedUrls.has(u));
          visibleUrls.filter(isOpenable).forEach(u => {
            if (allSel) _selectedUrls.delete(u);
            else        _selectedUrls.add(u);
          });
          _refreshPreviewSelections();
          _updateLabel();
        });

        list.appendChild(header);
      }

      // URL rows
      visibleUrls.forEach(url => {
        const cls  = classifyUrl(url);
        const sel  = _selectedUrls.has(url);

        const typeBadge = cls === 'restricted'
          ? `<span class="url-type-badge badge-restricted" title="Cannot be opened by extension">internal</span>`
          : url.startsWith('file://')
          ? `<span class="url-type-badge badge-file">file</span>`
          : cls === 'invalid'
          ? `<span class="url-type-badge badge-invalid">invalid</span>`
          : '';

        const row = document.createElement('div');
        row.className = `parsed-url-item ${sel ? 'selected' : 'deselected'}`;
        row.dataset.url = url;
        row.innerHTML = `
          <div class="parsed-item-check"></div>
          ${typeBadge}
          <span class="parsed-item-url" title="${_esc(url)}">${_esc(url)}</span>
        `;

        if (isUsable(url)) {
          row.addEventListener('click', () => {
            if (_selectedUrls.has(url)) {
              _selectedUrls.delete(url);
              row.classList.replace('selected','deselected');
            } else {
              _selectedUrls.add(url);
              row.classList.replace('deselected','selected');
            }
            _updateLabel();
          });
        }

        list.appendChild(row);
      });
    });
  }

  function _refreshPreviewSelections() {
    document.querySelectorAll('.parsed-url-item').forEach(row => {
      const url = row.dataset.url;
      const sel = _selectedUrls.has(url);
      row.classList.toggle('selected',   sel);
      row.classList.toggle('deselected', !sel);
    });
  }

  function _updateLabel() {
    const allUrls   = _sections.flatMap(s => s.urls);
    const usable    = allUrls.filter(isUsable).length;
    const selected  = [..._selectedUrls].filter(isOpenable).length;
    document.getElementById('parsedLabel').textContent =
      `${usable} URL${usable !== 1 ? 's' : ''} · ${selected} selected`;
  }

  // ── Confirmation bar ─────────────────────────────────────

  function _showConfirmBar(count, onConfirm) {
    const bar = document.getElementById('confirmBar');
    document.getElementById('confirmBarText').textContent =
      `Open ${count} tab${count !== 1 ? 's' : ''}? This may take a moment.`;
    bar.hidden = false;

    const yes = document.getElementById('confirmBarYes');
    const no  = document.getElementById('confirmBarNo');

    const cleanup = () => {
      bar.hidden = true;
      yes.replaceWith(yes.cloneNode(true));
      no.replaceWith(no.cloneNode(true));
    };

    document.getElementById('confirmBarYes').addEventListener('click', () => { cleanup(); onConfirm(); });
    document.getElementById('confirmBarNo').addEventListener('click',  cleanup);
  }

  // ── Undo ─────────────────────────────────────────────────

  async function undoLastImport() {
    if (_lastOpenedIds.length === 0) { showToast('Nothing to undo'); return; }
    try {
      await TabsAPI.closeTabs(_lastOpenedIds);
      showToast(`✓ Closed ${_lastOpenedIds.length} tabs`);
      _lastOpenedIds = [];
      document.getElementById('btnUndo').hidden = true;
    } catch (err) {
      showToast('Undo failed: ' + err.message);
    }
  }

  // ── Open tabs ────────────────────────────────────────────

  async function _doOpen(sections) {
    const perWindow   = getToggle('togglePerWindow');
    const useNewWin   = getToggle('toggleNewWindow');
    const closeExist  = getToggle('toggleCloseExisting');
    const batchSize   = parseInt(document.getElementById('batchSize').value)  || 0;
    const batchDelay  = parseInt(document.getElementById('batchDelay').value) || 0;

    _setStatus(true, `Opening tabs…`);

    try {
      let existingIds = [];
      if (closeExist) {
        const existing = await TabsAPI.getCurrentWindowTabs();
        existingIds = existing.map(t => t.id);
      }

      const newTabIds = [];

      // Capture newly opened tab IDs for undo
      const _origCreate = chrome.tabs.create.bind(chrome.tabs);

      const useIncognito = getToggle('toggleIncognito');
      const useMixedMode = getToggle('toggleMixedMode');

      if (perWindow && sections.length > 1) {
        for (const sec of sections) {
          const secIncognito = useIncognito || (useMixedMode && sec.label && sec.label.includes('Incognito'));
          const win = await chrome.windows.create({ url: sec.urls[0], focused: false, ...(secIncognito && { incognito: true }) });
          newTabIds.push(...(win.tabs || []).map(t => t.id));
          for (let i = 1; i < sec.urls.length; i++) {
            const t = await _origCreate({ windowId: win.id, url: sec.urls[i], active: false });
            newTabIds.push(t.id);
          }
        }
      } else {
        const allUrls = sections.flatMap(s => s.urls);
        if (useNewWin || useIncognito) {
          const winOpts = { url: allUrls[0], focused: true };
          if (useIncognito) winOpts.incognito = true;
          const win = await chrome.windows.create(winOpts);
          newTabIds.push(...(win.tabs || []).map(t => t.id));
          for (let i = 1; i < allUrls.length; i++) {
            const t = await _origCreate({ windowId: win.id, url: allUrls[i], active: false });
            newTabIds.push(t.id);
          }
        } else if (batchSize > 0 || batchDelay > 0) {
          const curWin = await TabsAPI.getCurrentWindow();
          const size   = batchSize > 0 ? batchSize : allUrls.length;
          for (let i = 0; i < allUrls.length; i += size) {
            for (const url of allUrls.slice(i, i + size)) {
              const t = await _origCreate({ windowId: curWin.id, url, active: false });
              newTabIds.push(t.id);
            }
            if (i + size < allUrls.length && batchDelay > 0)
              await new Promise(r => setTimeout(r, batchDelay));
          }
        } else {
          const curWin = await TabsAPI.getCurrentWindow();
          for (const url of allUrls) {
            const t = await _origCreate({ windowId: curWin.id, url, active: false });
            newTabIds.push(t.id);
          }
        }
      }

      if (closeExist) await TabsAPI.closeTabs(existingIds);

      _lastOpenedIds = newTabIds;
      document.getElementById('btnUndo').hidden = false;

      const total = sections.reduce((n,s) => n + s.urls.length, 0);
      const skipped = _sections.flatMap(s=>s.urls).filter(u=>classifyUrl(u)==='restricted').length;

      await Analytics.recordImport(total);
      _setStatus(true, `✓ Opened ${total} tab${total!==1?'s':''}${skipped>0?` (${skipped} internal skipped)`:''}`);
      setTimeout(() => _setStatus(false), 3000);
      showToast(`✓ ${total} tabs opened${sections.length > 1 ? ` in ${sections.length} windows` : ''}!`);

    } catch (err) {
      _setStatus(false);
      showToast('Error: ' + err.message);
    }
  }

  async function openTabs() {
    const text = document.getElementById('importTextarea').value.trim();
    if (!text && _sections.length === 0) { showToast('Paste some text first!'); return; }

    const rawSections = _sections.length > 0 ? _sections : parseSections(text);
    const perWindow   = getToggle('togglePerWindow');

    // Build sections to open
    let toOpen;
    if (_selectedUrls.size > 0) {
      const selectedSet = _selectedUrls;
      if (perWindow && rawSections.length > 1) {
        toOpen = rawSections.map(s => ({
          label: s.label,
          urls: s.urls.filter(u => selectedSet.has(u) && isOpenable(u)),
        })).filter(s => s.urls.length > 0);
      } else {
        const urls = [...selectedSet].filter(isOpenable);
        toOpen = urls.length > 0 ? [{ label: null, urls }] : [];
      }
    } else {
      if (perWindow && rawSections.length > 1) {
        toOpen = rawSections.map(s => ({
          label: s.label,
          urls: s.urls.filter(isOpenable),
        })).filter(s => s.urls.length > 0);
      } else {
        const urls = rawSections.flatMap(s => s.urls).filter(isOpenable);
        toOpen = urls.length > 0 ? [{ label: null, urls }] : [];
      }
    }

    if (toOpen.length === 0) { showToast('No openable URLs selected!'); return; }

    const total = toOpen.reduce((n,s) => n+s.urls.length, 0);

    if (total >= CONFIRM_THRESHOLD) {
      _showConfirmBar(total, () => _doOpen(toOpen));
    } else {
      await _doOpen(toOpen);
    }
  }

  // ── File loading ─────────────────────────────────────────

  function _handleFileLoad(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      document.getElementById('importTextarea').value = text;
      document.getElementById('charCount').textContent = `${text.length} chars`;
      _ingestText(text);
      showToast(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  }

  function _ingestText(text) {
    _sections     = parseSections(text);
    _selectedUrls = new Set(_sections.flatMap(s => s.urls).filter(isUsable));
    _filterText   = '';
    const filterInput = document.getElementById('previewFilterInput');
    if (filterInput) filterInput.value = '';
    _renderPreview();
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
    document.getElementById('confirmBar').hidden     = true;
    _sections     = [];
    _selectedUrls = new Set();
    _filterText   = '';
    _setStatus(false);
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    initToggle('toggleNewWindow');
    initToggle('toggleIncognito');
    initToggle('toggleMixedMode');
    initToggle('toggleCloseExisting');
    initToggle('togglePerWindow');
    bindToggle('toggleNewWindow');
    bindToggle('toggleIncognito');
    bindToggle('toggleMixedMode');
    bindToggle('toggleCloseExisting');
    bindToggle('togglePerWindow');

    // Auto-parse on input
    document.getElementById('importTextarea').addEventListener('input', e => {
      const text = e.target.value;
      document.getElementById('charCount').textContent = `${text.length} chars`;
      _ingestText(text);
    });

    // Search/filter
    document.getElementById('previewFilterInput').addEventListener('input', e => {
      _filterText = e.target.value;
      _renderPreview();
    });

    // Select all / none
    document.getElementById('selectAllUrls').addEventListener('click', () => {
      _selectedUrls = new Set(_sections.flatMap(s=>s.urls).filter(isUsable));
      _refreshPreviewSelections();
      _updateLabel();
    });

    document.getElementById('deselectAllUrls').addEventListener('click', () => {
      _selectedUrls.clear();
      _refreshPreviewSelections();
      _updateLabel();
    });

    // File load
    document.getElementById('btnLoadFile').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', e => {
      _handleFileLoad(e.target.files[0]);
      e.target.value = '';
    });

    // Main actions
    document.getElementById('btnOpenTabs').addEventListener('click', openTabs);
    document.getElementById('btnClear').addEventListener('click', clear);
    document.getElementById('btnUndo').addEventListener('click', undoLastImport);
  }

  return { init, parseUrls, parseSections, undoLastImport };

})();
