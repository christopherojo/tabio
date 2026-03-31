/* ─────────────────────────────────────────────────────────
   tabs.js  —  Chrome tabs / windows / tabGroups API wrappers
───────────────────────────────────────────────────────── */
'use strict';

const TabsAPI = {

  async getCurrentWindowTabs()  { return chrome.tabs.query({ currentWindow: true }); },
  async getAllTabs()             { return chrome.tabs.query({}); },
  async getCurrentWindow()      { return chrome.windows.getCurrent(); },
  async getAllWindows()          { return chrome.windows.getAll({ populate: true }); },

  async getCurrentWindowGroups() {
    const win = await this.getCurrentWindow();
    try   { return await chrome.tabGroups.query({ windowId: win.id }); }
    catch { return []; }
  },

  async getAllGroups() {
    try   { return await chrome.tabGroups.query({}); }
    catch { return []; }
  },

  async getTabsInGroup(groupId)   { return chrome.tabs.query({ groupId }); },
  async getTabsInWindow(windowId) { return chrome.tabs.query({ windowId }); },

  /**
   * Full structured snapshot: windows → groups → tabs.
   * Each window entry now includes `incognito: bool`.
   * Each tab retains its native `incognito` property from the Chrome API.
   */
  async getWindowsWithGroups() {
    const [allWindows, currentWin] = await Promise.all([
      this.getAllWindows(),
      this.getCurrentWindow(),
    ]);

    const result = [];

    for (const win of allWindows) {
      const tabs = (win.tabs || []).filter(t => this._hasUrl(t));

      let groups = [];
      try { groups = await chrome.tabGroups.query({ windowId: win.id }); } catch {}

      const groupMap = new Map(groups.map(g => [g.id, { ...g, tabs: [] }]));
      const ungroupedTabs = [];

      tabs.forEach(t => {
        if (t.groupId && t.groupId !== -1 && groupMap.has(t.groupId)) {
          groupMap.get(t.groupId).tabs.push(t);
        } else {
          ungroupedTabs.push(t);
        }
      });

      result.push({
        windowId:    win.id,
        windowIndex: allWindows.indexOf(win) + 1,
        isCurrent:   win.id === currentWin.id,
        incognito:   win.incognito || false,
        totalTabs:   tabs.length,
        groups:      [...groupMap.values()].filter(g => g.tabs.length > 0),
        ungroupedTabs,
      });
    }

    return result;
  },

  // ── Tab group management ─────────────────────────────────

  /** Rename a tab group */
  async renameGroup(groupId, title) {
    try { await chrome.tabGroups.update(groupId, { title }); return true; }
    catch (e) { console.warn('[Tabio] renameGroup:', e); return false; }
  },

  /** Change a tab group's colour */
  async recolorGroup(groupId, color) {
    try { await chrome.tabGroups.update(groupId, { color }); return true; }
    catch (e) { console.warn('[Tabio] recolorGroup:', e); return false; }
  },

  /** Collapse / expand a tab group */
  async collapseGroup(groupId, collapsed) {
    try { await chrome.tabGroups.update(groupId, { collapsed }); return true; }
    catch (e) { console.warn('[Tabio] collapseGroup:', e); return false; }
  },

  /** Create a new tab group from given tab IDs */
  async createGroup(tabIds, title, color) {
    try {
      const groupId = await chrome.tabs.group({ tabIds });
      const update  = {};
      if (title) update.title = title;
      if (color) update.color = color;
      if (Object.keys(update).length) await chrome.tabGroups.update(groupId, update);
      return groupId;
    } catch (e) { console.warn('[Tabio] createGroup:', e); return null; }
  },

  /** Move tabs into an existing group */
  async moveTabsToGroup(tabIds, groupId) {
    try { await chrome.tabs.group({ tabIds, groupId }); return true; }
    catch (e) { console.warn('[Tabio] moveTabsToGroup:', e); return false; }
  },

  // ── Open methods ─────────────────────────────────────────

  async openInCurrentWindow(urls) {
    const win = await this.getCurrentWindow();
    for (const url of urls) await chrome.tabs.create({ windowId: win.id, url, active: false });
  },

  async openInCurrentWindowBatched(urls, batchSize, delayMs) {
    const win  = await this.getCurrentWindow();
    const size = batchSize > 0 ? batchSize : urls.length;
    for (let i = 0; i < urls.length; i += size) {
      for (const url of urls.slice(i, i + size))
        await chrome.tabs.create({ windowId: win.id, url, active: false });
      if (i + size < urls.length && delayMs > 0)
        await new Promise(r => setTimeout(r, delayMs));
    }
  },

  async openInNewWindow(urls, incognito = false) {
    const opts = { url: urls[0], focused: true };
    if (incognito) opts.incognito = true;
    const win = await chrome.windows.create(opts);
    for (let i = 1; i < urls.length; i++)
      await chrome.tabs.create({ windowId: win.id, url: urls[i], active: false });
    return win;
  },

  async closeTabs(tabIds) {
    if (tabIds.length > 0) await chrome.tabs.remove(tabIds);
  },

  // ── Helpers ──────────────────────────────────────────────

  _hasUrl(t)    { return !!(t.url && t.url.length > 0); },

  _isOpenable(t) {
    if (!t.url) return false;
    const BLOCKED = ['chrome://', 'chrome-extension://', 'edge://',
                     'brave://', 'opera://', 'vivaldi://', 'about:', 'javascript:', 'data:'];
    return !BLOCKED.some(b => t.url.startsWith(b));
  },

  filterExportable(tabs) { return tabs.filter(t => this._hasUrl(t)); },
  filterOpenable(tabs)   { return tabs.filter(t => this._isOpenable(t)); },
  filterNavigable(tabs)  { return this.filterExportable(tabs); },
};
