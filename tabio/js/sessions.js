/* ─────────────────────────────────────────────────────────
   sessions.js  —  named session save / restore / delete
───────────────────────────────────────────────────────── */
'use strict';

const Sessions = (() => {

  const KEY = 'tabio_sessions';

  // ── Storage helpers ──────────────────────────────────────

  async function _loadAll() {
    return (await Storage.get(KEY)) || [];
  }

  async function _saveAll(sessions) {
    await Storage.set(KEY, sessions);
  }

  // ── CRUD ─────────────────────────────────────────────────

  async function save(name, tabs) {
    const sessions = await _loadAll();
    const session = {
      id:   Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim() || `Session ${new Date().toLocaleDateString()}`,
      ts:   Date.now(),
      tabs: tabs.map(t => ({ title: t.title || '', url: t.url || '' })),
    };
    sessions.unshift(session);
    await _saveAll(sessions);
    return session;
  }

  async function remove(id) {
    const sessions = await _loadAll();
    await _saveAll(sessions.filter(s => s.id !== id));
  }

  async function rename(id, newName) {
    const sessions = await _loadAll();
    const s = sessions.find(s => s.id === id);
    if (s) s.name = newName.trim();
    await _saveAll(sessions);
  }

  async function getAll() {
    return _loadAll();
  }

  // ── Restore ──────────────────────────────────────────────

  async function restore(id, inNewWindow = false) {
    const sessions = await _loadAll();
    const session  = sessions.find(s => s.id === id);
    if (!session) return;

    const urls = session.tabs.map(t => t.url).filter(Boolean);
    if (urls.length === 0) return;

    if (inNewWindow) {
      await TabsAPI.openInNewWindow(urls);
    } else {
      await TabsAPI.openInCurrentWindow(urls);
    }

    return session;
  }

  // ── Export session as file ────────────────────────────────

  function exportAsJson(session) {
    const data = JSON.stringify(session, null, 2);
    _download(data, `${session.name}.json`, 'application/json');
  }

  function exportAsTxt(session) {
    const lines = session.tabs.map(t => t.url);
    _download(lines.join('\n'), `${session.name}.txt`, 'text/plain');
  }

  function _download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ───────────────────────────────────────────────

  async function render(filterText = '') {
    const sessions = await _loadAll();
    const list     = document.getElementById('sessionList');
    const empty    = document.getElementById('sessionsEmpty');

    const filtered = filterText
      ? sessions.filter(s => s.name.toLowerCase().includes(filterText.toLowerCase()))
      : sessions;

    if (filtered.length === 0) {
      list.innerHTML = '';
      list.appendChild(empty);
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    list.innerHTML = filtered.map(s => _cardHtml(s)).join('');

    // Bind card buttons
    filtered.forEach(s => {
      _on(`restore-${s.id}`,  'click', () => _handleRestore(s.id));
      _on(`newwin-${s.id}`,   'click', () => _handleRestoreNewWin(s.id));
      _on(`expjson-${s.id}`,  'click', () => _handleExportJson(s.id));
      _on(`exptxt-${s.id}`,   'click', () => _handleExportTxt(s.id));
      _on(`delete-${s.id}`,   'click', () => _handleDelete(s.id));
    });
  }

  function _cardHtml(s) {
    const date   = new Date(s.ts).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
    const count  = s.tabs.length;
    const domains = _topDomains(s.tabs, 4);

    return `
      <div class="session-card" id="card-${s.id}">
        <div class="session-card-header">
          <span class="session-name" title="${_esc(s.name)}">${_esc(s.name)}</span>
          <div class="session-card-actions">
            <button class="icon-btn" id="restore-${s.id}" title="Open in this window">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 11v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><polyline points="12 2 18 2 18 8"/><line x1="8" y1="12" x2="18" y2="2"/></svg>
            </button>
            <button class="icon-btn" id="newwin-${s.id}" title="Open in new window">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="16" height="13" rx="2"/><path d="M2 9h16"/><path d="M6 5V3"/><path d="M14 5V3"/></svg>
            </button>
            <button class="icon-btn" id="expjson-${s.id}" title="Export as JSON">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7l-4-5z"/><polyline points="14 2 14 7 18 7"/></svg>
            </button>
            <button class="icon-btn" id="exptxt-${s.id}" title="Export as TXT">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="14" y2="6"/><line x1="6" y1="10" x2="14" y2="10"/><line x1="6" y1="14" x2="10" y2="14"/></svg>
            </button>
            <button class="icon-btn danger" id="delete-${s.id}" title="Delete session">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 17 6"/><path d="M16 6l-1 11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/><path d="M8 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
        <div class="session-meta">${count} tab${count !== 1 ? 's' : ''} · ${date}</div>
        <div class="session-domains">${domains.map(d => `<span class="domain-pill">${_esc(d)}</span>`).join('')}</div>
      </div>
    `;
  }

  function _topDomains(tabs, max) {
    const counts = {};
    tabs.forEach(t => {
      try {
        const h = new URL(t.url).hostname.replace(/^www\./, '');
        counts[h] = (counts[h] || 0) + 1;
      } catch {}
    });
    return Object.entries(counts)
      .sort((a,b) => b[1]-a[1])
      .slice(0, max)
      .map(([d]) => d);
  }

  // ── Handlers ─────────────────────────────────────────────

  async function _handleRestore(id) {
    const s = await restore(id, false);
    if (s) { showToast(`✓ Restored "${s.name}"`); await Analytics.recordImport(s.tabs.length); }
  }

  async function _handleRestoreNewWin(id) {
    const sessions = await _loadAll();
    const s = sessions.find(s => s.id === id);
    if (!s) return;
    await restore(id, true);
    showToast(`✓ Opened "${s.name}" in new window`);
    await Analytics.recordImport(s.tabs.length);
  }

  async function _handleExportJson(id) {
    const sessions = await _loadAll();
    const s = sessions.find(s => s.id === id);
    if (s) { exportAsJson(s); showToast('Downloading JSON…'); }
  }

  async function _handleExportTxt(id) {
    const sessions = await _loadAll();
    const s = sessions.find(s => s.id === id);
    if (s) { exportAsTxt(s); showToast('Downloading TXT…'); }
  }

  async function _handleDelete(id) {
    const sessions = await _loadAll();
    const s = sessions.find(s => s.id === id);
    if (!s) return;
    if (!confirm(`Delete session "${s.name}"?`)) return;
    await remove(id);
    showToast(`Deleted "${s.name}"`);
    await render(document.getElementById('sessionSearch').value);
  }

  // ── Helpers ──────────────────────────────────────────────

  function _on(id, event, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    // "Save current tabs" button in sessions panel
    document.getElementById('btnSaveNow').addEventListener('click', () => {
      document.getElementById('saveDialog').hidden = false;
      document.getElementById('sessionNameInput').value = '';
      document.getElementById('sessionNameInput').focus();
    });

    document.getElementById('btnCancelSave').addEventListener('click', () => {
      document.getElementById('saveDialog').hidden = true;
    });

    document.getElementById('btnConfirmSave').addEventListener('click', async () => {
      await _doSave(document.getElementById('sessionNameInput').value);
      document.getElementById('saveDialog').hidden = true;
    });

    document.getElementById('sessionNameInput').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        await _doSave(e.target.value);
        document.getElementById('saveDialog').hidden = true;
      }
      if (e.key === 'Escape') {
        document.getElementById('saveDialog').hidden = true;
      }
    });

    // Search filter
    document.getElementById('sessionSearch').addEventListener('input', (e) => {
      render(e.target.value);
    });

    // "Save as Session" button from export panel
    document.getElementById('btnSaveSession').addEventListener('click', () => {
      _showModal();
    });

    // Modal
    document.getElementById('modalBtnSave').addEventListener('click', async () => {
      const name = document.getElementById('modalSessionName').value;
      await _doSave(name);
      _closeModal();
    });

    document.getElementById('modalBtnCancel').addEventListener('click', _closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modalBackdrop')) _closeModal();
    });
    document.getElementById('modalSessionName').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        await _doSave(e.target.value);
        _closeModal();
      }
      if (e.key === 'Escape') _closeModal();
    });
  }

  async function _doSave(name) {
    const tabs = await TabsAPI.getCurrentWindowTabs();
    const navigable = TabsAPI.filterNavigable(tabs);
    if (navigable.length === 0) { showToast('No tabs to save!'); return; }

    const session = await save(name, navigable);
    await Analytics.recordSession(session.name);
    await render();
    showToast(`✓ Saved "${session.name}" (${navigable.length} tabs)`);
  }

  async function _showModal() {
    const tabs = await TabsAPI.getCurrentWindowTabs();
    const navigable = TabsAPI.filterNavigable(tabs);
    document.getElementById('modalSessionName').value = '';
    document.getElementById('modalMeta').textContent = `${navigable.length} tabs will be saved.`;
    document.getElementById('modalBackdrop').hidden = false;
    document.getElementById('modalSessionName').focus();
  }

  function _closeModal() {
    document.getElementById('modalBackdrop').hidden = true;
  }

  return { init, render, save, remove };

})();
