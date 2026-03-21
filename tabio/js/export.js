/* ─────────────────────────────────────────────────────────
   export.js  —  tabs → text, all formats + cleaning
───────────────────────────────────────────────────────── */
'use strict';

const Export = (() => {

  // ── State ────────────────────────────────────────────────
  let scope       = 'window';
  let format      = 'url';
  let allTabs     = [];
  let selectedIds = new Set();
  let lastOutput  = '';

  // ── Formatters ───────────────────────────────────────────

  const formatters = {
    url:      tab => tab.url,
    markdown: tab => `[${_safeTitle(tab.title)}](${tab.url})`,
    titled:   tab => `${_safeTitle(tab.title)}: ${tab.url}`,

    json: tabs => JSON.stringify(
      tabs.map(t => ({ title: t.title || '', url: t.url })),
      null, 2
    ),

    notion: tabs => tabs.map(t =>
      `[${_safeTitle(t.title)}](${t.url})`
    ).join('\n'),
  };

  // Formats that receive the entire array (not per-tab)
  const BULK_FORMATS = new Set(['json']);

  function _safeTitle(title) {
    return (title || 'Untitled').replace(/[\[\]]/g, '').trim();
  }

  // ── Build output string ──────────────────────────────────

  function _buildOutput(tabs, fmt, grouped) {
    if (grouped) {
      return grouped.groups.map(({ domain, tabs: gtabs }) => {
        const header = `── ${domain} (${gtabs.length}) ──`;
        const lines  = _formatFlat(gtabs, fmt);
        return `${header}\n${lines}`;
      }).join('\n\n');
    }
    return _formatFlat(tabs, fmt);
  }

  function _formatFlat(tabs, fmt) {
    if (BULK_FORMATS.has(fmt)) return formatters[fmt](tabs);
    return tabs.map(t => (formatters[fmt] || formatters.url)(t)).join('\n');
  }

  // ── Generate ─────────────────────────────────────────────

  async function generate() {
    let tabs = await _getTabsByScope();
    if (tabs.length === 0) { showToast('No valid tabs found!'); return null; }

    // Apply cleaning
    const cleaned = Cleaner.apply(tabs, {
      dedupe:   getChipToggle('cleanDedupe'),
      stripUtm: getChipToggle('cleanUtm'),
      sort:     getChipToggle('cleanSort'),
      group:    getChipToggle('cleanGroup'),
    });

    const flatTabs  = cleaned.grouped ? cleaned.groups.flatMap(g => g.tabs) : cleaned.tabs;
    lastOutput = _buildOutput(flatTabs, format, cleaned.grouped ? cleaned : null);

    document.getElementById('outputBox').textContent = lastOutput;

    // Track analytics
    await Analytics.recordExport(flatTabs);

    return flatTabs;
  }

  async function _getTabsByScope() {
    let tabs = [];
    if (scope === 'window')       tabs = await TabsAPI.getCurrentWindowTabs();
    else if (scope === 'all')     tabs = await TabsAPI.getAllTabs();
    else                          tabs = allTabs.filter(t => selectedIds.has(t.id));
    return TabsAPI.filterNavigable(tabs);
  }

  // ── Copy ─────────────────────────────────────────────────

  async function copyToClipboard() {
    if (!lastOutput) await generate();
    if (!lastOutput) { showToast('Nothing to copy!'); return; }
    try {
      await navigator.clipboard.writeText(lastOutput);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: lastOutput });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('✓ Copied to clipboard!');
  }

  // ── Download file ────────────────────────────────────────

  async function downloadFile() {
    if (!lastOutput) await generate();
    if (!lastOutput) { showToast('Nothing to download!'); return; }

    const ext  = format === 'json' ? 'json' : (format === 'markdown' || format === 'notion') ? 'md' : 'txt';
    const mime = format === 'json' ? 'application/json' : 'text/plain';
    const name = `tabio-export-${new Date().toISOString().slice(0,10)}.${ext}`;

    const blob = new Blob([lastOutput], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${name}`);
  }

  // ── Tab picker ───────────────────────────────────────────

  function _renderTabPicker() {
    const list = document.getElementById('tabPickerList');
    list.innerHTML = '';

    allTabs.forEach(tab => {
      const item = document.createElement('div');
      item.className = 'tab-item';

      const checkbox = document.createElement('div');
      checkbox.className = 'tab-checkbox' + (selectedIds.has(tab.id) ? ' checked' : '');

      item.addEventListener('click', () => {
        if (selectedIds.has(tab.id)) { selectedIds.delete(tab.id); checkbox.classList.remove('checked'); }
        else                         { selectedIds.add(tab.id);    checkbox.classList.add('checked'); }
        _updatePickerHeader();
      });

      const favicon = _buildFavicon(tab);

      const info = document.createElement('div');
      info.className = 'tab-info';
      info.innerHTML = `
        <div class="tab-title">${_esc(tab.title || '(untitled)')}</div>
        <div class="tab-url">${_esc(tab.url || '')}</div>
      `;

      item.append(checkbox, favicon, info);
      list.appendChild(item);
    });

    _updatePickerHeader();
  }

  function _buildFavicon(tab) {
    if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
      const img = Object.assign(document.createElement('img'), {
        className: 'tab-favicon', src: tab.favIconUrl,
      });
      img.onerror = () => img.replaceWith(_fallbackFavicon());
      return img;
    }
    return _fallbackFavicon();
  }

  function _fallbackFavicon() {
    const d = document.createElement('div');
    d.className = 'tab-favicon-fallback';
    return d;
  }

  function _updatePickerHeader() {
    const count = selectedIds.size;
    document.getElementById('selectedCount').textContent = `${count} selected`;
    document.getElementById('selectAllBtn').textContent  = count === allTabs.length ? 'Deselect all' : 'Select all';
  }

  function _toggleSelectAll() {
    if (selectedIds.size === allTabs.length) selectedIds.clear();
    else allTabs.forEach(t => selectedIds.add(t.id));
    _renderTabPicker();
  }

  // ── Helpers ──────────────────────────────────────────────

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Init ─────────────────────────────────────────────────

  async function init() {
    allTabs = await TabsAPI.getCurrentWindowTabs();
    allTabs.forEach(t => selectedIds.add(t.id));

    bindScopeButtons(['scopeWindow','scopeAll','scopeSelected'], s => {
      scope = s;
      document.getElementById('tabPickerWrap').hidden = s !== 'selected';
      if (s === 'selected') _renderTabPicker();
    });

    bindChips(['fmtUrl','fmtMarkdown','fmtTitled','fmtJson','fmtNotion'], f => { format = f; });

    document.getElementById('selectAllBtn').addEventListener('click', _toggleSelectAll);
    document.getElementById('btnGenerate').addEventListener('click', generate);
    document.getElementById('btnCopy').addEventListener('click', copyToClipboard);
    document.getElementById('btnDownload').addEventListener('click', downloadFile);
  }

  return { init, generate, copyToClipboard };

})();
