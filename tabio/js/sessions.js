/* ─────────────────────────────────────────────────────────
   sessions.js  —  named session CRUD + auto-save last session
───────────────────────────────────────────────────────── */
'use strict';

const Sessions = (() => {

  const KEY      = 'tabio_sessions';
  const LAST_KEY = 'tabio_last_session';

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

  async function getAll() {
    return _loadAll();
  }

  // ── Auto-save last session ───────────────────────────────

  async function saveLastSession(tabs) {
    const entry = {
      ts:   Date.now(),
      tabs: tabs.map(t => ({ title: t.title || '', url: t.url || '' })),
    };
    await Storage.set(LAST_KEY, entry);
  }

  async function getLastSession() {
    return Storage.get(LAST_KEY);
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

  async function restoreLast(inNewWindow = false) {
    const last = await getLastSession();
    if (!last || !last.tabs?.length) { showToast('No last session found'); return; }
    const urls = last.tabs.map(t => t.url).filter(Boolean);
    if (inNewWindow) {
      await TabsAPI.openInNewWindow(urls);
    } else {
      await TabsAPI.openInCurrentWindow(urls);
    }
    showToast(`✓ Restored ${urls.length} tabs from last session`);
    await Analytics.recordImport(urls.length);
  }

  // ── Export as file ────────────────────────────────────────

  function exportAsJson(session) {
    _download(JSON.stringify(session, null, 2), `${session.name}.json`, 'application/json');
  }

  function exportAsTxt(session) {
    _download(session.tabs.map(t => t.url).join('\n'), `${session.name}.txt`, 'text/plain');
  }

  function _download(content, filename, mime) {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([content], { type: mime })),
      download: filename,
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  // ── Render sessions panel ────────────────────────────────

  async function render(filterText = '') {
    const sessions = await _loadAll();
    const list     = document.getElementById('sessionList');
    const empty    = document.getElementById('sessionsEmpty');

    // Render last-session quick-restore card
    await _renderLastSessionCard();

    const filtered = filterText
      ? sessions.filter(s => s.name.toLowerCase().includes(filterText.toLowerCase()))
      : sessions;

    // Remove any existing session cards (keep the last-session card)
    list.querySelectorAll('.session-card').forEach(el => el.remove());

    if (filtered.length === 0) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      filtered.forEach(s => {
        const el = document.createElement('div');
        el.innerHTML = _cardHtml(s);
        list.appendChild(el.firstElementChild);
        _on(`restore-${s.id}`,  'click', () => _handleRestore(s.id));
        _on(`newwin-${s.id}`,   'click', () => _handleRestoreNewWin(s.id));
        _on(`expjson-${s.id}`,  'click', () => _handleExportJson(s.id));
        _on(`exptxt-${s.id}`,   'click', () => _handleExportTxt(s.id));
        _on(`delete-${s.id}`,   'click', () => _handleDelete(s.id));
      });
    }
  }

  async function _renderLastSessionCard() {
    const existing = document.getElementById('lastSessionCard');
    if (existing) existing.remove();

    const last = await getLastSession();
    if (!last || !last.tabs?.length) return;

    const list = document.getElementById('sessionList');
    const date = new Date(last.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const domains = _topDomains(last.tabs, 3);

    const card = document.createElement('div');
    card.id = 'lastSessionCard';
    card.className = 'session-card last-session-card';
    card.innerHTML = `
      <div class="session-card-header">
        <span class="session-name">
          <span class="last-session-badge">AUTO</span>
          Last Session
        </span>
        <div class="session-card-actions">
          <button class="icon-btn" id="lastRestore" title="Quick restore">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 11v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><polyline points="12 2 18 2 18 8"/><line x1="8" y1="12" x2="18" y2="2"/></svg>
          </button>
          <button class="icon-btn" id="lastRestoreNewWin" title="Restore in new window">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="16" height="13" rx="2"/><path d="M2 9h16"/></svg>
          </button>
        </div>
      </div>
      <div class="session-meta">${last.tabs.length} tabs · ${date}</div>
      <div class="session-domains">${domains.map(d => `<span class="domain-pill">${_esc(d)}</span>`).join('')}</div>
    `;

    list.prepend(card);
    _on('lastRestore',       'click', () => restoreLast(false));
    _on('lastRestoreNewWin', 'click', () => restoreLast(true));
  }

  function _cardHtml(s) {
    const date    = new Date(s.ts).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
    const count   = s.tabs.length;
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
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="16" height="13" rx="2"/><path d="M2 9h16"/></svg>
            </button>
            <button class="icon-btn" id="expjson-${s.id}" title="Export JSON">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7l-4-5z"/><polyline points="14 2 14 7 18 7"/></svg>
            </button>
            <button class="icon-btn" id="exptxt-${s.id}" title="Export TXT">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="14" y2="6"/><line x1="6" y1="10" x2="14" y2="10"/><line x1="6" y1="14" x2="10" y2="14"/></svg>
            </button>
            <button class="icon-btn danger" id="delete-${s.id}" title="Delete">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 17 6"/><path d="M16 6l-1 11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
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
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,max).map(([d])=>d);
  }

  // ── Card button handlers ─────────────────────────────────

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
    if (!confirm(`Delete "${s.name}"?`)) return;
    await remove(id);
    showToast(`Deleted "${s.name}"`);
    await render(document.getElementById('sessionSearch').value);
  }

  // ── Init ─────────────────────────────────────────────────

  function _on(id, event, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function init() {
    _on('btnSaveNow', 'click', () => {
      document.getElementById('saveDialog').hidden = false;
      document.getElementById('sessionNameInput').value = '';
      document.getElementById('sessionNameInput').focus();
    });

    _on('btnCancelSave', 'click', () => {
      document.getElementById('saveDialog').hidden = true;
    });

    _on('btnConfirmSave', 'click', async () => {
      await _doSave(document.getElementById('sessionNameInput').value);
      document.getElementById('saveDialog').hidden = true;
    });

    document.getElementById('sessionNameInput').addEventListener('keydown', async e => {
      if (e.key === 'Enter')  { await _doSave(e.target.value); document.getElementById('saveDialog').hidden = true; }
      if (e.key === 'Escape') { document.getElementById('saveDialog').hidden = true; }
    });

    document.getElementById('sessionSearch').addEventListener('input', e => render(e.target.value));
    _on('btnSaveSession', 'click', _showModal);
    _on('modalBtnSave',   'click', async () => { await _doSave(document.getElementById('modalSessionName').value); _closeModal(); });
    _on('modalBtnCancel', 'click', _closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', e => {
      if (e.target === document.getElementById('modalBackdrop')) _closeModal();
    });
    document.getElementById('modalSessionName').addEventListener('keydown', async e => {
      if (e.key === 'Enter')  { await _doSave(e.target.value); _closeModal(); }
      if (e.key === 'Escape') _closeModal();
    });
  }

  async function _doSave(name) {
    const tabs = await TabsAPI.getCurrentWindowTabs();
    const exportable = TabsAPI.filterExportable(tabs);
    if (exportable.length === 0) { showToast('No tabs to save!'); return; }
    const session = await save(name, exportable);
    await Analytics.recordSession(session.name);
    await render();
    showToast(`✓ Saved "${session.name}" (${exportable.length} tabs)`);
  }

  async function _showModal() {
    const tabs = await TabsAPI.getCurrentWindowTabs();
    const exportable = TabsAPI.filterExportable(tabs);
    document.getElementById('modalSessionName').value = '';
    document.getElementById('modalMeta').textContent = `${exportable.length} tabs will be saved.`;
    document.getElementById('modalBackdrop').hidden = false;
    document.getElementById('modalSessionName').focus();
  }

  function _closeModal() {
    document.getElementById('modalBackdrop').hidden = true;
  }

  return { init, render, save, remove, saveLastSession, getLastSession };

})();
