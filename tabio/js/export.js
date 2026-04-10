/* ─────────────────────────────────────────────────────────
   export.js  —  tabs → text
   New: incognito labelling/exclusion/warning, expandable
        window tree with per-tab selection, density insights,
        focus mode
───────────────────────────────────────────────────────── */
'use strict';

const Export = (() => {

  // ── State ────────────────────────────────────────────────
  let scope            = 'window';
  let format           = 'url';
  let allTabs          = [];
  let selectedIds      = new Set();
  let selectedGroupIds = new Set();
  let selectedWinIds   = new Set();
  let lastOutput       = '';

  // Window tree state: windowId → { expanded, selectedTabIds }
  const _winTree = new Map();

  // Focus mode: null = off, or a section label string
  let _focusSection = null;

  const GROUP_COLORS = {
    grey:'#9aa0a6', blue:'#1a73e8', red:'#ea4335',
    yellow:'#fbbc04', green:'#34a853', pink:'#f06292',
    purple:'#7b1fa2', cyan:'#00acc1', orange:'#ef6c00',
  };

  // ── Incognito helpers ────────────────────────────────────

  function _isIncognito(tab) { return tab.incognito === true; }

  function _incognitoLabel() { return '[Incognito]'; }

  function _shouldExcludeIncognito() {
    return Settings.get('excludeIncognito') === true;
  }

  // ── Formatters ───────────────────────────────────────────

  function _safeTitle(tab) {
    const base  = (tab.title || 'Untitled').replace(/[\[\]]/g, '').trim();
    const label = _isIncognito(tab) ? `${_incognitoLabel()} ${base}` : base;
    return label;
  }

  function _isSpecialUrl(url) {
    if (!url) return false;
    return !url.startsWith('http://') && !url.startsWith('https://');
  }

  const TAB_FORMATTERS = {
    url:      t => t.url,
    markdown: t => _isSpecialUrl(t.url)
                     ? `${_safeTitle(t)}: ${t.url}`
                     : `[${_safeTitle(t)}](${t.url})`,
    titled:   t => `${_safeTitle(t)}: ${t.url}`,
    notion:   t => _isSpecialUrl(t.url)
                     ? `- ${_safeTitle(t)}: ${t.url}`
                     : `- [${_safeTitle(t)}](${t.url})`,
  };

  const BULK_FORMATTERS = {
    json: tabs => JSON.stringify(
      tabs.map(t => {
        const entry = { title: t.title || '', url: t.url };
        if (_isIncognito(t))     entry.incognito = true;
        if (_isSpecialUrl(t.url)) entry.urlType  = t.url.split('://')[0] || t.url.split(':')[0];
        return entry;
      }),
      null, 2
    ),
  };

  function _isBulk(fmt)      { return fmt in BULK_FORMATTERS; }
  function _esc(s)           { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _formatFlat(tabs, fmt) {
    if (_isBulk(fmt)) return BULK_FORMATTERS[fmt](tabs);
    return tabs.map(t => TAB_FORMATTERS[fmt]?.(t) ?? t.url).join('\n');
  }

  // ── Headers ──────────────────────────────────────────────

  function _groupHeader(name, color, count, incognito) {
    const dot   = `[${(color || 'grey').toUpperCase()}]`;
    const priv  = incognito ? ` ${_incognitoLabel()}` : '';
    return `${dot}${priv} ${name || 'Unnamed Group'} (${count} tab${count !== 1 ? 's' : ''})`;
  }

  function _windowHeader(windowIndex, isCurrent, tabCount, incognito) {
    const label   = isCurrent ? `Window ${windowIndex} (current)` : `Window ${windowIndex}`;
    const privTag = incognito ? ` · ${_incognitoLabel()}` : '';
    return `── ${label}${privTag} · ${tabCount} tab${tabCount !== 1 ? 's' : ''} ──`;
  }

  function _domainHeader(domain, count) { return `── ${domain} (${count}) ──`; }

  // ── Build output ─────────────────────────────────────────

  function _applyIncognitoFilter(tabs) {
    return _shouldExcludeIncognito() ? tabs.filter(t => !_isIncognito(t)) : tabs;
  }

  function _buildFlatOutput(tabs, fmt) {
    const filtered = _applyIncognitoFilter(tabs);
    const cleaned  = Cleaner.apply(filtered, _cleanOptions());
    if (cleaned.grouped) {
      return cleaned.groups.map(({ domain, tabs: gt }) =>
        [_domainHeader(domain, gt.length), _formatFlat(gt, fmt)].join('\n')
      ).join('\n\n');
    }
    return _formatFlat(cleaned.tabs, fmt);
  }

  function _buildGroupOutput(groups, ungroupedTabs, fmt, windowIncognito = false) {
    const sections = [];
    groups.forEach(g => {
      const filtered = _applyIncognitoFilter(g.tabs);
      const cleaned  = Cleaner.apply(filtered, _cleanOptions());
      const tabs     = cleaned.grouped ? cleaned.groups.flatMap(x => x.tabs) : cleaned.tabs;
      if (tabs.length === 0) return;

      // Focus mode: skip sections not in focus
      if (_focusSection && g.title !== _focusSection) return;

      sections.push(_groupHeader(g.title, g.color, tabs.length, windowIncognito || tabs.some(_isIncognito)));
      sections.push(_formatFlat(tabs, fmt));
      sections.push('');
    });

    if (ungroupedTabs.length > 0) {
      const filtered = _applyIncognitoFilter(ungroupedTabs);
      const cleaned  = Cleaner.apply(filtered, _cleanOptions());
      const tabs     = cleaned.grouped ? cleaned.groups.flatMap(x => x.tabs) : cleaned.tabs;
      if (tabs.length > 0 && (!_focusSection || _focusSection === 'Ungrouped')) {
        sections.push('── Ungrouped ──');
        sections.push(_formatFlat(tabs, fmt));
      }
    }

    return sections.join('\n').trim();
  }

  function _buildWindowOutput(windows, fmt) {
    return windows.map(win => {
      const winHeader = _windowHeader(win.windowIndex, win.isCurrent, win.totalTabs, win.incognito);
      const body      = _buildGroupOutput(win.groups, win.ungroupedTabs, fmt, win.incognito);
      return [winHeader, body].filter(Boolean).join('\n');
    }).join('\n\n');
  }

  function _cleanOptions() {
    return {
      dedupe:   getChipToggle('cleanDedupe'),
      stripUtm: getChipToggle('cleanUtm'),
      sort:     getChipToggle('cleanSort'),
      group:    getChipToggle('cleanGroup'),
    };
  }

  // ── Get content by scope ─────────────────────────────────

  async function _getContent() {
    if (scope === 'window') {
      const tabs = TabsAPI.filterExportable(await TabsAPI.getCurrentWindowTabs());
      return { type: 'flat', tabs };
    }
    if (scope === 'all') {
      const tabs = TabsAPI.filterExportable(await TabsAPI.getAllTabs());
      return { type: 'flat', tabs };
    }
    if (scope === 'selected') {
      // Gather from window tree if it's been rendered, otherwise fall back to allTabs
      let tabs;
      if (_winTree.size > 0) {
        // Collect selected tab IDs from all windows in the tree
        const treeSelectedIds = new Set();
        _winTree.forEach(ws => ws.selectedTabIds.forEach(id => treeSelectedIds.add(id)));
        tabs = TabsAPI.filterExportable(allTabs.filter(t => treeSelectedIds.has(t.id)));
      } else {
        tabs = TabsAPI.filterExportable(allTabs.filter(t => selectedIds.has(t.id)));
      }
      return { type: 'flat', tabs };
    }
    if (scope === 'tabgroup') {
      const windows   = await TabsAPI.getWindowsWithGroups();
      const allGroups = windows.flatMap(w => w.groups);
      const selected  = allGroups.filter(g => selectedGroupIds.has(g.id));
      if (selected.length === 0) {
        const curWin = windows.find(w => w.isCurrent);
        if (!curWin) return { type: 'flat', tabs: [] };
        return { type: 'groups', groups: curWin.groups, ungroupedTabs: [] };
      }
      return { type: 'groups', groups: selected, ungroupedTabs: [] };
    }
    if (scope === 'windows') {
      const allWindows = await TabsAPI.getWindowsWithGroups();
      const selected   = allWindows.filter(w => selectedWinIds.has(w.windowId));
      return { type: 'windows', windows: selected };
    }
    return { type: 'flat', tabs: [] };
  }

  // ── Density insights ─────────────────────────────────────

  function _computeDensityInsights(tabs) {
    const urlCounts = {};
    tabs.forEach(t => { urlCounts[t.url] = (urlCounts[t.url] || 0) + 1; });
    const dupes   = Object.values(urlCounts).filter(n => n > 1).reduce((s, n) => s + n - 1, 0);
    const incog   = tabs.filter(_isIncognito).length;
    const special = tabs.filter(t => _isSpecialUrl(t.url)).length;
    return { total: tabs.length, dupes, incog, special };
  }

  function _renderDensityInsights(insights) {
    const el = document.getElementById('densityInsights');
    if (!el) return;
    const parts = [];
    if (insights.dupes > 0)   parts.push(`<span class="density-chip chip-warn">${insights.dupes} duplicate${insights.dupes !== 1 ? 's' : ''}</span>`);
    if (insights.incog > 0)   parts.push(`<span class="density-chip chip-incog">🕵 ${insights.incog} incognito</span>`);
    if (insights.special > 0) parts.push(`<span class="density-chip chip-special">${insights.special} internal</span>`);
    if (parts.length === 0)   parts.push(`<span class="density-chip chip-ok">✓ ${insights.total} tabs</span>`);
    el.innerHTML = parts.join('');
    el.hidden = false;

    // Privacy warning
    const warn = document.getElementById('incognitoWarning');
    if (warn) warn.hidden = (insights.incog === 0);
  }

  // ── Generate ─────────────────────────────────────────────

  async function generate() {
    const content = await _getContent();
    let output = '';
    let flatTabs = [];

    if (content.type === 'flat') {
      if (content.tabs.length === 0) { showToast('No valid tabs found!'); return null; }
      flatTabs = content.tabs;
      output   = _buildFlatOutput(flatTabs, format);

    } else if (content.type === 'groups') {
      flatTabs = [...content.groups.flatMap(g => g.tabs), ...content.ungroupedTabs];
      if (flatTabs.length === 0) { showToast('No tabs in selected groups!'); return null; }
      output   = _buildGroupOutput(content.groups, content.ungroupedTabs, format);

    } else if (content.type === 'windows') {
      flatTabs = content.windows.flatMap(w => [...w.groups.flatMap(g => g.tabs), ...w.ungroupedTabs]);
      if (flatTabs.length === 0) { showToast('No valid tabs found!'); return null; }
      output   = _buildWindowOutput(content.windows, format);
    }

    _renderDensityInsights(_computeDensityInsights(flatTabs));

    lastOutput = output;
    document.getElementById('outputBox').textContent = output;
    await Analytics.recordExport(flatTabs);
    await Sessions.saveLastSession(flatTabs);
    return flatTabs;
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
      href: URL.createObjectURL(new Blob([lastOutput], { type: mime })), download: name,
    });
    a.click(); URL.revokeObjectURL(a.href);
    showToast(`Downloaded ${name}`);
  }

  // ── Expandable window tree (By Window scope) ─────────────

  async function _renderWindowTree() {
    const container = document.getElementById('windowPicker');
    const windows   = await TabsAPI.getWindowsWithGroups();

    if (windows.length === 0) {
      container.innerHTML = '<span class="scope-sub-hint">No windows found.</span>';
      return;
    }

    // Init tree state
    selectedWinIds.clear();
    windows.forEach(w => {
      if (!_winTree.has(w.windowId)) {
        _winTree.set(w.windowId, {
          expanded:       w.isCurrent,
          selectedTabIds: new Set(w.groups.flatMap(g => g.tabs).concat(w.ungroupedTabs).map(t => t.id)),
          selected:       false,
          groupName:      '',
        });
      }
      if (_winTree.get(w.windowId)?.selected) {
        selectedWinIds.add(w.windowId);
      }
    });

    _drawWindowTree(windows);
  }

  function _drawWindowTree(windows) {
    const container = document.getElementById('windowPicker');
    container.innerHTML = '';

    windows.forEach(w => {
      const state    = _winTree.get(w.windowId);
      const allWinTabs = [...w.groups.flatMap(g => g.tabs), ...w.ungroupedTabs];
      const selCount = allWinTabs.filter(t => state.selectedTabIds.has(t.id)).length;
      const incogTag = w.incognito ? ` · 🕵` : '';
      const winLabel = w.isCurrent ? `Window (current)${incogTag}` : `Window ${w.windowIndex}${incogTag}`;

      const winRow = document.createElement('div');
      winRow.className = 'win-tree-row';

      // Header row — checkbox + chevron + label + optional group-name input + count
      const header = document.createElement('div');
      header.className = `win-tree-header ${state.selected ? 'checked' : ''}`;
      header.dataset.winid = w.windowId;

      header.innerHTML = `
        <div class="win-tree-left">
          <div class="group-picker-check"></div>
          <span class="win-expand-chevron ${state.expanded ? 'expanded' : ''}">▶</span>
          <span class="win-tree-label">${_esc(winLabel)}</span>
        </div>
        <div class="win-tree-right">
          <input class="win-group-name-input" type="text"
            placeholder="Name → create group"
            title="Type a name and press Enter to group selected tabs into a Chrome tab group"
            value="${_esc(state.groupName || '')}">
          <span class="win-tree-count">${selCount}/${allWinTabs.length}</span>
        </div>
      `;

      // Checkbox: click anywhere on header except the chevron or name input
      header.addEventListener('click', (e) => {
        if (e.target.closest('.win-expand-chevron') || e.target.closest('.win-group-name-input')) return;
        state.selected = !state.selected;
        if (state.selected) allWinTabs.forEach(t => state.selectedTabIds.add(t.id));
        else                state.selectedTabIds.clear();
        selectedWinIds[state.selected ? 'add' : 'delete'](w.windowId);
        _drawWindowTree(windows);
      });

      // Chevron expand/collapse
      header.querySelector('.win-expand-chevron').addEventListener('click', (e) => {
        e.stopPropagation();
        state.expanded = !state.expanded;
        _drawWindowTree(windows);
      });

      // Group name input — save name on input, create group on Enter or blur
      const nameInput = header.querySelector('.win-group-name-input');
      nameInput.addEventListener('input', e => { state.groupName = e.target.value; });
      nameInput.addEventListener('keydown', async e => {
        if (e.key === 'Enter') { e.preventDefault(); await _createGroupFromWindow(w, state, windows); }
      });

      winRow.appendChild(header);

      // Tab list (shown when expanded)
      if (state.expanded) {
        const tabList = document.createElement('div');
        tabList.className = 'win-tree-tabs';

        // Render groups first
        w.groups.forEach(g => {
          const colorHex = GROUP_COLORS[g.color] || GROUP_COLORS.grey;
          const grpHeader = document.createElement('div');
          grpHeader.className = 'win-tree-group-label';
          grpHeader.innerHTML = `<span class="group-color-dot" style="background:${colorHex}"></span>${_esc(g.title || 'Unnamed Group')}`;
          tabList.appendChild(grpHeader);
          g.tabs.forEach(t => tabList.appendChild(_buildTabRow(t, state, w, windows)));
        });

        // Ungrouped tabs
        if (w.ungroupedTabs.length > 0) {
          if (w.groups.length > 0) {
            const sep = document.createElement('div');
            sep.className = 'win-tree-group-label';
            sep.textContent = 'Ungrouped';
            tabList.appendChild(sep);
          }
          w.ungroupedTabs.forEach(t => tabList.appendChild(_buildTabRow(t, state, w, windows)));
        }

        winRow.appendChild(tabList);
      }

      container.appendChild(winRow);
    });
  }

  function _buildTabRow(tab, state, win, windows) {
    const row      = document.createElement('div');
    const checked  = state.selectedTabIds.has(tab.id);
    row.className  = 'win-tree-tab-row';

    const incogIcon = _isIncognito(tab) ? `<span class="tab-incog-icon" title="Incognito">🕵</span>` : '';
    const favicon   = (tab.favIconUrl && tab.favIconUrl.startsWith('http'))
      ? `<img class="tab-favicon" src="${_esc(tab.favIconUrl)}">`
      : `<div class="tab-favicon-fallback"></div>`;

    row.innerHTML = `
      <div class="tab-checkbox ${checked ? 'checked' : ''}"></div>
      ${favicon}
      ${incogIcon}
      <div class="tab-info">
        <div class="tab-title">${_esc(tab.title || '(untitled)')}</div>
        <div class="tab-url">${_esc(tab.url || '')}</div>
      </div>
    `;

    const faviconImg = row.querySelector('.tab-favicon');
    if (faviconImg) faviconImg.onerror = () => faviconImg.replaceWith(_fallbackFavicon());

    row.addEventListener('click', () => {
      if (state.selectedTabIds.has(tab.id)) state.selectedTabIds.delete(tab.id);
      else state.selectedTabIds.add(tab.id);
      _drawWindowTree(windows);
    });

    return row;
  }

  // ── Create tab group from window name input ─────────────

  async function _createGroupFromWindow(win, state, windows) {
    const name   = (state.groupName || '').trim();
    if (!name) return;

    const allWinTabs = [...win.groups.flatMap(g => g.tabs), ...win.ungroupedTabs];
    const tabIds     = allWinTabs.filter(t => state.selectedTabIds.has(t.id)).map(t => t.id);

    if (tabIds.length === 0) { showToast('Select at least one tab first'); return; }

    const groupId = await TabsAPI.createGroup(tabIds, name, 'blue');
    if (groupId) {
      showToast(`✓ Created group "${name}" (${tabIds.length} tab${tabIds.length !== 1 ? 's' : ''})`);
      state.groupName = '';
      const fresh = await TabsAPI.getWindowsWithGroups();
      _drawWindowTree(fresh);
    } else {
      showToast('Could not create group — check permissions');
    }
  }

  // ── Tab group picker ─────────────────────────────────────

  async function _renderTabGroupPicker() {
    const container = document.getElementById('tabGroupPicker');
    const windows   = await TabsAPI.getWindowsWithGroups();
    const allGroups = windows.flatMap(w =>
      w.groups.map(g => ({ ...g, windowIndex: w.windowIndex, isCurrent: w.isCurrent, winIncognito: w.incognito }))
    );

    if (allGroups.length === 0) {
      container.innerHTML = '<span class="scope-sub-hint">No tab groups found in any window.</span>';
      return;
    }

    allGroups.forEach(g => selectedGroupIds.add(g.id));
    container.innerHTML = '';

    allGroups.forEach(g => {
      const item      = document.createElement('div');
      item.className  = 'group-picker-item checked';
      item.dataset.id = g.id;

      const colorHex = GROUP_COLORS[g.color] || GROUP_COLORS.grey;
      const winLabel = g.isCurrent ? '(this window)' : `Window ${g.windowIndex}`;
      const incogBadge = g.winIncognito ? ` <span class="incog-badge">🕵</span>` : '';

      item.innerHTML = `
        <div class="group-picker-check"></div>
        <div class="group-color-dot" style="background:${colorHex}"></div>
        <span class="group-picker-name">${_esc(g.title || 'Unnamed Group')}${incogBadge}
          <span style="font-weight:400;color:var(--text-hint)">${winLabel}</span>
        </span>
        <span class="group-picker-count">${g.tabs.length} tab${g.tabs.length !== 1 ? 's' : ''}</span>
      `;

      item.addEventListener('click', () => {
        if (selectedGroupIds.has(g.id)) { selectedGroupIds.delete(g.id); item.classList.remove('checked'); }
        else                            { selectedGroupIds.add(g.id);    item.classList.add('checked'); }
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

      const incogIcon = _isIncognito(tab)
        ? Object.assign(document.createElement('span'), { className: 'tab-incog-icon', title: 'Incognito', textContent: '🕵' })
        : null;

      const info = document.createElement('div');
      info.className = 'tab-info';
      info.innerHTML = `
        <div class="tab-title">${_esc(tab.title || '(untitled)')}</div>
        <div class="tab-url">${_esc(tab.url || '')}</div>
      `;

      const parts = [checkbox, _buildFavicon(tab)];
      if (incogIcon) parts.push(incogIcon);
      parts.push(info);
      item.append(...parts);
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
  function _fallbackFavicon() { return Object.assign(document.createElement('div'), { className: 'tab-favicon-fallback' }); }

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
    scope = newScope;
    document.getElementById('scopeSubTabGroup').hidden = (newScope !== 'tabgroup');
    document.getElementById('scopeSubWindows').hidden  = (newScope !== 'windows');
    document.getElementById('tabPickerWrap').hidden    = (newScope !== 'selected');
    document.getElementById('focusModeRow').hidden     = !['window','all','selected'].includes(newScope);

    if (newScope === 'tabgroup') _renderTabGroupPicker();
    if (newScope === 'windows')  _renderWindowTree();
    if (newScope === 'selected') _renderTabPicker();
  }

  // ── Focus mode ───────────────────────────────────────────

  async function _renderFocusOptions() {
    const select = document.getElementById('focusModeSelect');
    if (!select) return;

    const windows = await TabsAPI.getWindowsWithGroups();
    const groups  = windows.flatMap(w => w.groups.map(g => g.title || 'Unnamed Group'));
    const unique  = [...new Set(groups)];

    select.innerHTML = `<option value="">Off — show all</option>` +
      unique.map(g => `<option value="${_esc(g)}">${_esc(g)}</option>`).join('');

    select.value = _focusSection || '';
    select.addEventListener('change', () => {
      _focusSection = select.value || null;
    });
  }

  function restoreUIState(state) {
    const activeScopeId = state?.activeScope;
    if (activeScopeId) {
      const scopeIdMap = {
        scopeWindow: 'window',
        scopeAll: 'all',
        scopeTabGroup: 'tabgroup',
        scopeWindows: 'windows',
        scopeSelected: 'selected',
      };
      _showScopeSub(scopeIdMap[activeScopeId] || 'window');
    } else {
      _showScopeSub(scope);
    }

    const activeFormatId = state?.activeFormat;
    if (activeFormatId) format = activeFormatId.replace('fmt', '').toLowerCase();
  }

  // ── Init ─────────────────────────────────────────────────

  async function init() {
    allTabs = await TabsAPI.getCurrentWindowTabs();
    allTabs.forEach(t => selectedIds.add(t.id));

    bindScopeButtons(
      ['scopeWindow','scopeAll','scopeTabGroup','scopeWindows','scopeSelected'],
      s => { scope = s; _showScopeSub(s); }
    );

    bindChips(['fmtUrl','fmtMarkdown','fmtTitled','fmtJson','fmtNotion'], f => { format = f; });

    ['cleanDedupe','cleanUtm','cleanSort','cleanGroup'].forEach(id => bindChipToggle(id));

    // Incognito exclusion chip
    bindChipToggle('cleanIncognito');

    document.getElementById('selectAllBtn').addEventListener('click', _toggleSelectAll);
    document.getElementById('btnGenerate').addEventListener('click', generate);
    document.getElementById('btnCopy').addEventListener('click', copyToClipboard);
    document.getElementById('btnDownload').addEventListener('click', downloadFile);

    // Focus mode
    await _renderFocusOptions();
  }

  return { init, generate, copyToClipboard, restoreUIState };

})();
