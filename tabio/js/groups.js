/* ─────────────────────────────────────────────────────────
   groups.js  —  tab group management panel
   Create, rename, recolour, collapse, delete groups
───────────────────────────────────────────────────────── */
'use strict';

const Groups = (() => {

  const CHROME_COLORS = ['grey','blue','red','yellow','green','pink','purple','cyan','orange'];

  const COLOR_HEX = {
    grey:'#9aa0a6', blue:'#1a73e8', red:'#ea4335',
    yellow:'#fbbc04', green:'#34a853', pink:'#f06292',
    purple:'#7b1fa2', cyan:'#00acc1', orange:'#ef6c00',
  };

  // ── Render ───────────────────────────────────────────────

  async function render() {
    const container = document.getElementById('groupsPanel');
    if (!container) return;

    const windows = await TabsAPI.getWindowsWithGroups();
    const hasGroups = windows.some(w => w.groups.length > 0);

    if (!hasGroups) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 48 48" fill="none" stroke="var(--border)" stroke-width="2">
            <rect x="4" y="10" width="18" height="28" rx="3"/>
            <rect x="26" y="10" width="18" height="28" rx="3"/>
            <line x1="13" y1="22" x2="13" y2="30"/>
          </svg>
          <p>No tab groups open.<br>Create one below to get started.</p>
        </div>
        <div id="createGroupArea"></div>
      `;
      _renderCreateArea(document.getElementById('createGroupArea'), windows);
      return;
    }

    container.innerHTML = '';

    windows.forEach(win => {
      if (win.groups.length === 0) return;

      const winLabel = win.isCurrent ? 'This Window' : `Window ${win.windowIndex}`;
      const winSection = document.createElement('div');
      winSection.className = 'groups-window-section';
      winSection.innerHTML = `<div class="groups-window-label">${_esc(winLabel)}${win.incognito ? ' <span class="incog-badge">🕵</span>' : ''}</div>`;

      win.groups.forEach(g => {
        winSection.appendChild(_buildGroupCard(g, win));
      });

      container.appendChild(winSection);
    });

    const createArea = document.createElement('div');
    createArea.id = 'createGroupArea';
    container.appendChild(createArea);
    _renderCreateArea(createArea, windows);
  }

  function _buildGroupCard(group, win) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.id = `grp-card-${group.id}`;

    const colorHex = COLOR_HEX[group.color] || COLOR_HEX.grey;

    card.innerHTML = `
      <div class="group-card-header">
        <div class="group-card-left">
          <div class="group-color-bar" style="background:${colorHex}"></div>
          <input class="group-name-input" type="text" value="${_esc(group.title || '')}" placeholder="Unnamed Group" data-groupid="${group.id}">
        </div>
        <div class="group-card-actions">
          <button class="icon-btn" data-action="collapse" data-groupid="${group.id}" title="${group.collapsed ? 'Expand' : 'Collapse'}">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${group.collapsed
                ? '<polyline points="5 8 10 13 15 8"/>'
                : '<polyline points="5 12 10 7 15 12"/>'}
            </svg>
          </button>
          <button class="icon-btn danger" data-action="ungroup" data-groupid="${group.id}" title="Ungroup tabs">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="3" x2="17" y2="17"/><line x1="17" y1="3" x2="3" y2="17"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Colour picker -->
      <div class="group-color-picker">
        ${CHROME_COLORS.map(c =>
          `<div class="color-swatch ${c === group.color ? 'active' : ''}"
               style="background:${COLOR_HEX[c]}"
               data-color="${c}" data-groupid="${group.id}" title="${c}"></div>`
        ).join('')}
      </div>

      <!-- Tab count -->
      <div class="group-tab-count">${group.tabs.length} tab${group.tabs.length !== 1 ? 's' : ''}</div>
    `;

    // Rename on blur / Enter
    const nameInput = card.querySelector('.group-name-input');
    nameInput.addEventListener('keydown', async e => {
      if (e.key === 'Enter') { nameInput.blur(); }
    });
    nameInput.addEventListener('blur', async () => {
      const ok = await TabsAPI.renameGroup(group.id, nameInput.value.trim());
      if (ok) showToast(`✓ Renamed to "${nameInput.value.trim()}"`);
      else    showToast('Could not rename group');
    });

    // Colour swatches
    card.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', async () => {
        const color   = swatch.dataset.color;
        const groupId = parseInt(swatch.dataset.groupid);
        const ok      = await TabsAPI.recolorGroup(groupId, color);
        if (ok) { showToast(`✓ Color changed to ${color}`); await render(); }
      });
    });

    // Collapse/expand
    card.querySelector('[data-action="collapse"]').addEventListener('click', async () => {
      await TabsAPI.collapseGroup(group.id, !group.collapsed);
      await render();
    });

    // Ungroup
    card.querySelector('[data-action="ungroup"]').addEventListener('click', async () => {
      if (!confirm(`Ungroup "${group.title || 'this group'}"? Tabs will remain open.`)) return;
      try {
        const tabIds = group.tabs.map(t => t.id);
        await chrome.tabs.ungroup(tabIds);
        showToast('Tabs ungrouped');
        await render();
      } catch (e) {
        showToast('Could not ungroup: ' + e.message);
      }
    });

    return card;
  }

  function _renderCreateArea(container, windows) {
    container.innerHTML = `
      <div class="create-group-box">
        <div class="create-group-title">Create new group</div>
        <input class="group-name-input" type="text" id="newGroupName" placeholder="Group name (optional)">
        <div class="create-group-row">
          <div class="group-color-picker" id="newGroupColorPicker">
            ${CHROME_COLORS.map((c, i) =>
              `<div class="color-swatch ${i === 0 ? 'active' : ''}"
                   style="background:${COLOR_HEX[c]}" data-color="${c}" title="${c}"></div>`
            ).join('')}
          </div>
        </div>
        <div class="create-group-hint">Select tabs from current window:</div>
        <div class="create-group-tabs" id="newGroupTabList"></div>
        <button class="btn btn-primary btn-sm" id="btnCreateGroup" style="margin-top:8px">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="3" x2="10" y2="17"/><line x1="3" y1="10" x2="17" y2="10"/></svg>
          Create Group
        </button>
      </div>
    `;

    // Populate tabs for current window
    const curWin = windows.find(w => w.isCurrent);
    if (curWin) {
      const allWinTabs = [...curWin.groups.flatMap(g => g.tabs), ...curWin.ungroupedTabs];
      const tabList    = document.getElementById('newGroupTabList');
      const selected   = new Set();

      allWinTabs.forEach(t => {
        const row = document.createElement('div');
        row.className = 'win-tree-tab-row';
        row.innerHTML = `
          <div class="tab-checkbox"></div>
          <div class="tab-info">
            <div class="tab-title">${_esc(t.title || '(untitled)')}</div>
          </div>
        `;
        row.addEventListener('click', () => {
          if (selected.has(t.id)) { selected.delete(t.id); row.querySelector('.tab-checkbox').classList.remove('checked'); }
          else                    { selected.add(t.id);    row.querySelector('.tab-checkbox').classList.add('checked'); }
        });
        tabList.appendChild(row);
      });
    }

    // Colour picker
    let chosenColor = CHROME_COLORS[0];
    container.querySelectorAll('.color-swatch').forEach(s => {
      s.addEventListener('click', () => {
        container.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('active'));
        s.classList.add('active');
        chosenColor = s.dataset.color;
      });
    });

    // Create button
    document.getElementById('btnCreateGroup').addEventListener('click', async () => {
      const tabList = document.getElementById('newGroupTabList');
      const selected = new Set();
      tabList.querySelectorAll('.tab-checkbox.checked').forEach(cb => {
        const row = cb.closest('.win-tree-tab-row');
        // We'll reconstruct selected IDs by index
      });

      // Collect all checked rows
      const checkedRows = [...tabList.querySelectorAll('.win-tree-tab-row')]
        .filter(r => r.querySelector('.tab-checkbox.checked'));

      if (checkedRows.length === 0) { showToast('Select at least one tab'); return; }

      const curWin = windows.find(w => w.isCurrent);
      if (!curWin) return;

      const allWinTabs = [...curWin.groups.flatMap(g => g.tabs), ...curWin.ungroupedTabs];
      const tabIds     = [];
      checkedRows.forEach((row, _i) => {
        const idx = [...tabList.children].indexOf(row);
        if (allWinTabs[idx]) tabIds.push(allWinTabs[idx].id);
      });

      const name     = document.getElementById('newGroupName').value.trim();
      const groupId  = await TabsAPI.createGroup(tabIds, name, chosenColor);
      if (groupId) { showToast(`✓ Created group${name ? ` "${name}"` : ''}`); await render(); }
      else           showToast('Could not create group');
    });
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function init() {
    // render is called when the Groups tab is clicked
  }

  return { init, render };

})();
