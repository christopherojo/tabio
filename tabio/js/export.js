/* ─────────────────────────────────────────────────────────
   export.js  —  tabs → text, all formats + cleaning + groups
───────────────────────────────────────────────────────── */
'use strict';

const Export = (() => {

  // ── State ────────────────────────────────────────────────
  let scope            = 'window';  // window | all | tabgroup | windows | selected
  let format           = 'url';
  let allTabs          = [];
  let selectedIds      = new Set();
  let selectedGroupIds = new Set();   // for tabgroup scope
  let selectedWinIds   = new Set();   // for windows scope
  let lastOutput       = '';

  // ── Tab group colour map (Chrome's named colours → CSS) ──
  const GROUP_COLORS = {
    grey: '#9aa0a6', blue: '#1a73e8', red: '#ea4335',
    yellow: '#fbbc04', green: '#34a853', pink: '#f06292',
    purple: '#7b1fa2', cyan: '#00acc1', orange: '#ef6c00',
  };

  // ── Formatters ───────────────────────────────────────────

  // Per-tab formatters (receive one tab, return one string)
  // Special URLs (file://, chrome://, edge://, etc.) are preserved as-is.
  const TAB_FORMATTERS = {
    url:      t => t.url,
    markdown: t => _isSpecialUrl(t.url)
                     ? `${_safeTitle(t.title)}: ${t.url}`
                     : `[${_safeTitle(t.title)}](${t.url})`,
    titled:   t => `${_safeTitle(t.title)}: ${t.url}`,
    notion:   t => _isSpecialUrl(t.url)
                     ? `- ${_safeTitle(t.title)}: ${t.url}`
                     : `- [${_safeTitle(t.title)}](${t.url})`,
  };

  // Bulk formatters (receive full tab array, return full string)
  const BULK_FORMATTERS = {
    json: tabs => JSON.stringify(
      tabs.map(t => {
        const entry = { title: t.title || '', url: t.url };
        if (_isSpecialUrl(t.url)) entry.urlType = t.url.split('://')[0] || t.url.split(':')[0];
        return entry;
      }),
      null, 2
    ),
  };

  function _safeTitle(title) {
    return (title || 'Untitled').replace(/[\[\]]/g, '').trim();
  }

  /** Returns true for URLs that can't be wrapped in Markdown links cleanly */
  function _isSpecialUrl(url) {
    if (!url) return false;
    return !url.startsWith('http://') && !url.startsWith('https://');
  }

  function _isBulk(fmt) { return fmt in BULK_FORMATTERS; }

  // Format a flat array of tabs into a string
  function _formatFlat(tabs, fmt) {
    if (_isBulk(fmt)) return BULK_FORMATTERS[fmt](tabs);
    return tabs.map(t => TAB_FORMATTERS[fmt]?.(t) ?? t.url).join('\n');
  }

  // ── Section header helpers ───────────────────────────────

  function _groupHeader(name, color, count) {
    const colorName = color || 'grey';
    const dot = `[${colorName.toUpperCase()}]`;
    return `${dot} ${name || 'Unnamed Group'} (${count} tab${count !== 1 ? 's' : ''})`;
  }

  function _windowHeader(windowIndex, isCurrent, tabCount) {
    const label = isCurrent ? `Window ${windowIndex} (current)` : `Window ${windowIndex}`;
    return `── ${label} · ${tabCount} tab${tabCount !== 1 ? 's' : ''} ──`;
  }

  function _domainHeader(domain, count) {
    return `── ${domain} (${count}) ──`;
  }

  function _divider() { return ''; }  // blank line between sections

  // ── Build output for different scope structures ──────────

  /**
   * Build output from a flat tab array (window / all / selected scopes).
   * Cleaning (dedupe, stripUtm, sort, groupByDomain) applied here.
   */
  function _buildFlatOutput(tabs, fmt) {
    const cleaned = Cleaner.apply(tabs, _cleanOptions());

    if (cleaned.grouped) {
      // Group-by-domain mode
      return cleaned.groups.map(({ domain, tabs: gt }) =>
        [_domainHeader(domain, gt.length), _formatFlat(gt, fmt)].join('\n')
      ).join('\n\n');
    }

    return _formatFlat(cleaned.tabs, fmt);
  }

  /**
   * Build output preserving tab group structure.
   * groups: [{ groupId, title, color, tabs[] }]
   * ungroupedTabs: []
   */
  function _buildGroupOutput(groups, ungroupedTabs, fmt) {
    const sections = [];

    groups.forEach(g => {
      const cleanedResult = Cleaner.apply(g.tabs, _cleanOptions());
      const tabs = cleanedResult.grouped
        ? cleanedResult.groups.flatMap(x => x.tabs)
        : cleanedResult.tabs;
      if (tabs.length === 0) return;
      sections.push(_groupHeader(g.title, g.color, tabs.length));
      sections.push(_formatFlat(tabs, fmt));
      sections.push(_divider());
    });

    if (ungroupedTabs.length > 0) {
      const cleanedResult = Cleaner.apply(ungroupedTabs, _cleanOptions());
      const tabs = cleanedResult.grouped
        ? cleanedResult.groups.flatMap(x => x.tabs)
        : cleanedResult.tabs;
      if (tabs.length > 0) {
        sections.push('── Ungrouped ──');
        sections.push(_formatFlat(tabs, fmt));
      }
    }

    return sections.join('\n').trim();
  }

  /**
   * Build output preserving window structure.
   * windows: [{ windowId, windowIndex, isCurrent, groups[], ungroupedTabs[] }]
   */
  function _buildWindowOutput(windows, fmt) {
    return windows.map(win => {
      const winHeader = _windowHeader(win.windowIndex, win.isCurrent, win.totalTabs);
      const body      = _buildGroupOutput(win.groups, win.ungroupedTabs, fmt);
      return [winHeader, body].filter(Boolean).join('\n');
    }).join('\n\n');
  }

  // ── Clean options ────────────────────────────────────────

  function _cleanOptions() {
    return {
      dedupe:   getChipToggle('cleanDedupe'),
      stripUtm: getChipToggle('cleanUtm'),
      sort:     getChipToggle('cleanSort'),
      group:    getChipToggle('cleanGroup'),
    };
  }

  // ── Get tabs by scope ────────────────────────────────────

  async function _getContent() {
    // Returns { type: 'flat'|'groups'|'windows', ... }

    if (scope === 'window') {
      const tabs = TabsAPI.filterExportable(await TabsAPI.getCurrentWindowTabs());
      return { type: 'flat', tabs };
    }

    if (scope === 'all') {
      const tabs = TabsAPI.filterExportable(await TabsAPI.getAllTabs());
      return { type: 'flat', tabs };
    }

    if (scope === 'selected') {
      const tabs = TabsAPI.filterExportable(allTabs.filter(t => selectedIds.has(t.id)));
      return { type: 'flat', tabs };
    }

    if (scope === 'tabgroup') {
      // Get windows with groups, filter to selected group ids
      const windows = await TabsAPI.getWindowsWithGroups();
      const allGroups = windows.flatMap(w => w.groups);
      const selected  = allGroups.filter(g => selectedGroupIds.has(g.id));

      if (selected.length === 0) {
        // No groups selected — export all groups from current window
        const curWin = windows.find(w => w.isCurrent);
        if (!curWin) return { type: 'flat', tabs: [] };
        return { type: 'groups', groups: curWin.groups, ungroupedTabs: [] };
      }

      return { type: 'groups', groups: selected, ungroupedTabs: [] };
    }

    if (scope === 'windows') {
      const allWindows = await TabsAPI.getWindowsWithGroups();
      const selected   = selectedWinIds.size > 0
        ? allWindows.filter(w => selectedWinIds.has(w.windowId))
        : allWindows;
      return { type: 'windows', windows: selected };
    }

    return { type: 'flat', tabs: [] };
  }

  // ── Generate ─────────────────────────────────────────────

  async function generate() {
    const content = await _getContent();
    let output = '';
    let flatTabsForAnalytics = [];

    if (content.type === 'flat') {
      if (content.tabs.length === 0) { showToast('No valid tabs found!'); return null; }
      output = _buildFlatOutput(content.tabs, format);
      flatTabsForAnalytics = content.tabs;

    } else if (content.type === 'groups') {
      const allGroupTabs = [
        ...content.groups.flatMap(g => g.tabs),
        ...content.ungroupedTabs,
      ];
      if (allGroupTabs.length === 0) { showToast('No tabs in selected groups!'); return null; }
      output = _buildGroupOutput(content.groups, content.ungroupedTabs, format);
      flatTabsForAnalytics = allGroupTabs;

    } else if (content.type === 'windows') {
      const allWinTabs = content.windows.flatMap(w => [
        ...w.groups.flatMap(g => g.tabs),
        ...w.ungroupedTabs,
      ]);
      if (allWinTabs.length === 0) { showToast('No valid tabs found!'); return null; }
      output = _buildWindowOutput(content.windows, format);
      flatTabsForAnalytics = allWinTabs;
    }

    lastOutput = output;
    document.getElementById('outputBox').textContent = output;
    await Analytics.recordExport(flatTabsForAnalytics);
    // Auto-save as last session for quick restore
    await Sessions.saveLastSession(flatTabsForAnalytics);
    return flatTabsForAnalytics;
  }

  // ── Copy / Download ──────────────────────────────────────

  async function copyToClipboard() {
    if (!lastOutput) await generate();
    if (!lastOutput) { showToast('Nothing to copy!'); return; }
    try {
      await navigator.clipboard.writeText(lastOutput);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: lastOutput });
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    showToast('✓ Copied to clipboard!');
  }

  async function downloadFile() {
    if (!lastOutput) await generate();
    if (!lastOutput) { showToast('Nothing to download!'); return; }
    const ext  = format === 'json' ? 'json' : (format === 'markdown' || format === 'notion') ? 'md' : 'txt';
    const mime = format === 'json' ? 'application/json' : 'text/plain';
    const name = `tabio-export-${new Date().toISOString().slice(0,10)}.${ext}`;
    const a    = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([lastOutput], { type: mime })),
      download: name,
    });
    a.click(); URL.revokeObjectURL(a.href);
    showToast(`Downloaded ${name}`);
  }

  // ── Tab group picker ─────────────────────────────────────

  async function _renderTabGroupPicker() {
    const container = document.getElementById('tabGroupPicker');
    const windows   = await TabsAPI.getWindowsWithGroups();
    const allGroups = windows.flatMap(w =>
      w.groups.map(g => ({ ...g, windowIndex: w.windowIndex, isCurrent: w.isCurrent }))
    );

    if (allGroups.length === 0) {
      container.innerHTML = '<span class="scope-sub-hint">No tab groups found in any window.</span>';
      return;
    }

    // Default: select all
    allGroups.forEach(g => selectedGroupIds.add(g.id));
    container.innerHTML = '';

    allGroups.forEach(g => {
      const item = document.createElement('div');
      item.className = 'group-picker-item checked';
      item.dataset.id = g.id;

      const colorHex = GROUP_COLORS[g.color] || GROUP_COLORS.grey;
      const winLabel = g.isCurrent ? '(this window)' : `Window ${g.windowIndex}`;

      item.innerHTML = `
        <div class="group-picker-check"></div>
        <div class="group-color-dot" style="background:${colorHex}"></div>
        <span class="group-picker-name">${_esc(g.title || 'Unnamed Group')} <span style="font-weight:400;color:var(--text-hint)">${winLabel}</span></span>
        <span class="group-picker-count">${g.tabs.length} tab${g.tabs.length !== 1 ? 's' : ''}</span>
      `;

      item.addEventListener('click', () => {
        if (selectedGroupIds.has(g.id)) {
          selectedGroupIds.delete(g.id);
          item.classList.remove('checked');
        } else {
          selectedGroupIds.add(g.id);
          item.classList.add('checked');
        }
      });

      container.appendChild(item);
    });
  }

  // ── Window picker ────────────────────────────────────────

  async function _renderWindowPicker() {
    const container = document.getElementById('windowPicker');
    const windows   = await TabsAPI.getWindowsWithGroups();

    if (windows.length === 0) {
      container.innerHTML = '<span class="scope-sub-hint">No windows found.</span>';
      return;
    }

    // Default: select all
    windows.forEach(w => selectedWinIds.add(w.windowId));
    container.innerHTML = '';

    windows.forEach(w => {
      const item = document.createElement('div');
      item.className = 'group-picker-item checked';
      item.dataset.id = w.windowId;

      const groupCount = w.groups.length;
      const label = w.isCurrent ? 'Window (current)' : `Window ${w.windowIndex}`;
      const sub   = groupCount > 0
        ? `${w.totalTabs} tabs · ${groupCount} group${groupCount !== 1 ? 's' : ''}`
        : `${w.totalTabs} tabs`;

      item.innerHTML = `
        <div class="group-picker-check"></div>
        <span class="group-picker-name">${_esc(label)}</span>
        <span class="group-picker-count">${sub}</span>
      `;

      item.addEventListener('click', () => {
        if (selectedWinIds.has(w.windowId)) {
          selectedWinIds.delete(w.windowId);
          item.classList.remove('checked');
        } else {
          selectedWinIds.add(w.windowId);
          item.classList.add('checked');
        }
      });

      container.appendChild(item);
    });
  }

  // ── Tab picker (Pick Tabs scope) ─────────────────────────

  function _renderTabPicker() {
    const list = document.getElementById('tabPickerList');
    list.innerHTML = '';

    allTabs.forEach(tab => {
      const item     = document.createElement('div');
      item.className = 'tab-item';
      const checkbox = document.createElement('div');
      checkbox.className = 'tab-checkbox' + (selectedIds.has(tab.id) ? ' checked' : '');

      item.addEventListener('click', () => {
        if (selectedIds.has(tab.id)) { selectedIds.delete(tab.id); checkbox.classList.remove('checked'); }
        else                         { selectedIds.add(tab.id);    checkbox.classList.add('checked'); }
        _updatePickerHeader();
      });

      const info = document.createElement('div');
      info.className = 'tab-info';
      info.innerHTML = `
        <div class="tab-title">${_esc(tab.title || '(untitled)')}</div>
        <div class="tab-url">${_esc(tab.url || '')}</div>
      `;

      item.append(checkbox, _buildFavicon(tab), info);
      list.appendChild(item);
    });

    _updatePickerHeader();
  }

  function _buildFavicon(tab) {
    if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
      const img = Object.assign(document.createElement('img'), { className: 'tab-favicon', src: tab.favIconUrl });
      img.onerror = () => img.replaceWith(_fallbackFavicon());
      return img;
    }
    return _fallbackFavicon();
  }

  function _fallbackFavicon() {
    return Object.assign(document.createElement('div'), { className: 'tab-favicon-fallback' });
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

  // ── Scope sub-panel visibility ───────────────────────────

  function _showScopeSub(newScope) {
    document.getElementById('scopeSubTabGroup').hidden = (newScope !== 'tabgroup');
    document.getElementById('scopeSubWindows').hidden  = (newScope !== 'windows');
    document.getElementById('tabPickerWrap').hidden    = (newScope !== 'selected');

    if (newScope === 'tabgroup') _renderTabGroupPicker();
    if (newScope === 'windows')  _renderWindowPicker();
    if (newScope === 'selected') _renderTabPicker();
  }

  // ── Helpers ──────────────────────────────────────────────

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Init ─────────────────────────────────────────────────

  async function init() {
    allTabs = await TabsAPI.getCurrentWindowTabs();
    allTabs.forEach(t => selectedIds.add(t.id));

    // Scope buttons
    bindScopeButtons(
      ['scopeWindow','scopeAll','scopeTabGroup','scopeWindows','scopeSelected'],
      s => { scope = s; _showScopeSub(s); }
    );

    // Format chips
    bindChips(['fmtUrl','fmtMarkdown','fmtTitled','fmtJson','fmtNotion'], f => { format = f; });

    // Clean chip-toggles — wire each one (they self-toggle via CSS, generate reads them live)
    ['cleanDedupe','cleanUtm','cleanSort','cleanGroup'].forEach(id => bindChipToggle(id));

    document.getElementById('selectAllBtn').addEventListener('click', _toggleSelectAll);
    document.getElementById('btnGenerate').addEventListener('click', generate);
    document.getElementById('btnCopy').addEventListener('click', copyToClipboard);
    document.getElementById('btnDownload').addEventListener('click', downloadFile);
  }

  return { init, generate, copyToClipboard };

})();
