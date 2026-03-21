/* ─────────────────────────────────────────────────────────
   analytics.js  —  local-only usage stats
───────────────────────────────────────────────────────── */
'use strict';

const Analytics = (() => {

  const KEY = 'tabio_analytics';

  const _defaults = () => ({
    tabsExported: 0,
    tabsImported: 0,
    sessionsSaved: 0,
    domains: {},          // domain → count
    activity: [],         // [{type, label, ts}] newest first, max 20
  });

  let _data = null;

  async function _load() {
    if (_data) return;
    _data = (await Storage.get(KEY)) || _defaults();
  }

  async function _save() {
    await Storage.set(KEY, _data);
  }

  // ── Public record functions ──────────────────────────────

  async function recordExport(tabs) {
    await _load();
    _data.tabsExported += tabs.length;
    tabs.forEach(t => {
      try {
        const host = new URL(t.url).hostname.replace(/^www\./, '');
        _data.domains[host] = (_data.domains[host] || 0) + 1;
      } catch {}
    });
    _pushActivity('export', `Exported ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`);
    await _save();
  }

  async function recordImport(count) {
    await _load();
    _data.tabsImported += count;
    _pushActivity('import', `Imported ${count} tab${count !== 1 ? 's' : ''}`);
    await _save();
  }

  async function recordSession(name) {
    await _load();
    _data.sessionsSaved += 1;
    _pushActivity('session', `Saved session "${name}"`);
    await _save();
  }

  function _pushActivity(type, label) {
    _data.activity.unshift({ type, label, ts: Date.now() });
    if (_data.activity.length > 20) _data.activity = _data.activity.slice(0, 20);
  }

  // ── Render stats panel ───────────────────────────────────

  async function render() {
    await _load();

    document.getElementById('statExported').textContent  = _data.tabsExported;
    document.getElementById('statImported').textContent  = _data.tabsImported;
    document.getElementById('statSessions').textContent  = _data.sessionsSaved;
    document.getElementById('statDomains').textContent   = Object.keys(_data.domains).length;

    _renderDomains();
    _renderActivity();
  }

  function _renderDomains() {
    const container = document.getElementById('domainList');
    const sorted = Object.entries(_data.domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">No data yet — export some tabs!</div>';
      return;
    }

    const max = sorted[0][1];
    container.innerHTML = sorted.map(([domain, count]) => `
      <div class="domain-row">
        <span class="domain-name">${_esc(domain)}</span>
        <div class="domain-bar-wrap">
          <div class="domain-bar" style="width:${Math.round((count/max)*100)}%"></div>
        </div>
        <span class="domain-count">${count}</span>
      </div>
    `).join('');
  }

  function _renderActivity() {
    const container = document.getElementById('activityList');
    if (_data.activity.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">No activity recorded yet.</div>';
      return;
    }

    container.innerHTML = _data.activity.slice(0, 10).map(a => `
      <div class="activity-row">
        <div class="activity-dot ${a.type}"></div>
        <span class="activity-text">${_esc(a.label)}</span>
        <span class="activity-time">${_timeAgo(a.ts)}</span>
      </div>
    `).join('');
  }

  function _timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)    return `${s}s ago`;
    if (s < 3600)  return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  async function reset() {
    _data = _defaults();
    await _save();
    render();
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    document.getElementById('btnResetStats').addEventListener('click', async () => {
      if (confirm('Reset all analytics? This cannot be undone.')) {
        await reset();
        showToast('Stats reset.');
      }
    });
  }

  return { init, render, recordExport, recordImport, recordSession };

})();
