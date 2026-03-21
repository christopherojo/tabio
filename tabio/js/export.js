/* ─────────────────────────────────────────────────────────
   export.js  —  tabs → text logic
───────────────────────────────────────────────────────── */

'use strict';

const Export = (() => {

  // ── State ────────────────────────────────────────────────

  let scope         = 'window';   // 'window' | 'all' | 'selected'
  let format        = 'url';      // 'url' | 'markdown' | 'titled'
  let allTabs       = [];
  let selectedIds   = new Set();
  let lastOutput    = '';

  // ── Formatters ───────────────────────────────────────────

  const formatters = {
    url:      tab => tab.url,
    markdown: tab => `[${_safeTitle(tab.title)}](${tab.url})`,
    titled:   tab => `${_safeTitle(tab.title)}: ${tab.url}`,
  };

  function _safeTitle(title) {
    return (title || 'Untitled').replace(/[\[\]]/g, '').trim();
  }

  // ── Tab picker ───────────────────────────────────────────

  function _renderTabPicker() {
    const list = document.getElementById('tabPickerList');
    list.innerHTML = '';

    allTabs.forEach(tab => {
      const item = document.createElement('div');
      item.className = 'tab-item';
      item.addEventListener('click', () => _toggleTab(tab.id, checkbox));

      const checkbox = document.createElement('div');
      checkbox.className = 'tab-checkbox' + (selectedIds.has(tab.id) ? ' checked' : '');

      const favicon = _buildFavicon(tab);

      const info = document.createElement('div');
      info.className = 'tab-info';
      info.innerHTML = `
        <div class="tab-title">${_escapeHtml(tab.title || '(untitled)')}</div>
        <div class="tab-url">${_escapeHtml(tab.url || '')}</div>
      `;

      item.append(checkbox, favicon, info);
      list.appendChild(item);
    });

    _updatePickerHeader();
  }

  function _buildFavicon(tab) {
    if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
      const img = document.createElement('img');
      img.className = 'tab-favicon';
      img.src = tab.favIconUrl;
      img.onerror = () => img.replaceWith(_fallbackFavicon());
      return img;
    }
    return _fallbackFavicon();
  }

  function _fallbackFavicon() {
    const div = document.createElement('div');
    div.className = 'tab-favicon-fallback';
    return div;
  }

  function _toggleTab(id, checkbox) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
      checkbox.classList.remove('checked');
    } else {
      selectedIds.add(id);
      checkbox.classList.add('checked');
    }
    _updatePickerHeader();
  }

  function _updatePickerHeader() {
    const count = selectedIds.size;
    const allSelected = count === allTabs.length;
    document.getElementById('selectedCount').textContent = `${count} selected`;
    document.getElementById('selectAllBtn').textContent = allSelected ? 'Deselect all' : 'Select all';
  }

  function _toggleSelectAll() {
    if (selectedIds.size === allTabs.length) {
      selectedIds.clear();
    } else {
      allTabs.forEach(t => selectedIds.add(t.id));
    }
    _renderTabPicker();
  }

  // ── Generate ─────────────────────────────────────────────

  async function generate() {
    let tabs = [];

    if (scope === 'window') {
      tabs = await TabsAPI.getCurrentWindowTabs();
    } else if (scope === 'all') {
      tabs = await TabsAPI.getAllTabs();
    } else {
      tabs = allTabs.filter(t => selectedIds.has(t.id));
    }

    tabs = TabsAPI.filterNavigable(tabs);

    if (tabs.length === 0) {
      showToast('No valid tabs found!');
      return;
    }

    const formatter = formatters[format] || formatters.url;
    lastOutput = tabs.map(formatter).join('\n');

    const box = document.getElementById('outputBox');
    box.textContent = lastOutput;
  }

  async function copyToClipboard() {
    if (!lastOutput) await generate();
    if (!lastOutput) { showToast('Nothing to copy!'); return; }

    try {
      await navigator.clipboard.writeText(lastOutput);
    } catch {
      // Fallback for clipboard permission issues
      const ta = document.createElement('textarea');
      ta.value = lastOutput;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('✓ Copied to clipboard!');
  }

  // ── Helpers ──────────────────────────────────────────────

  function _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ─────────────────────────────────────────────────

  async function init() {
    allTabs = await TabsAPI.getCurrentWindowTabs();
    allTabs.forEach(t => selectedIds.add(t.id));

    // Scope
    bindScopeButtons(['scopeWindow', 'scopeAll', 'scopeSelected'], (s) => {
      scope = s;
      const wrap = document.getElementById('tabPickerWrap');
      wrap.hidden = (s !== 'selected');
      if (s === 'selected') _renderTabPicker();
    });

    // Format
    bindChips(['fmtUrl', 'fmtMarkdown', 'fmtTitled'], (f) => { format = f; });

    // Select all button
    document.getElementById('selectAllBtn').addEventListener('click', _toggleSelectAll);

    // Action buttons
    document.getElementById('btnGenerate').addEventListener('click', generate);
    document.getElementById('btnCopy').addEventListener('click', copyToClipboard);
  }

  return { init };

})();
