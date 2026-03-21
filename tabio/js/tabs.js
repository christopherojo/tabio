/* ─────────────────────────────────────────────────────────
   tabs.js  —  Chrome tabs / windows / tabGroups API wrappers
───────────────────────────────────────────────────────── */
'use strict';

const TabsAPI = {

  async getCurrentWindowTabs()  { return chrome.tabs.query({ currentWindow: true }); },
  async getAllTabs()             { return chrome.tabs.query({}); },
  async getCurrentWindow()      { return chrome.windows.getCurrent(); },
  async getAllWindows()          { return chrome.windows.getAll({ populate: true }); },

  /** Return all tab groups in the current window */
  async getCurrentWindowGroups() {
    const win = await this.getCurrentWindow();
    try {
      return await chrome.tabGroups.query({ windowId: win.id });
    } catch {
      return []; // tabGroups API not available
    }
  },

  /** Return all tab groups across all windows */
  async getAllGroups() {
    try {
      return await chrome.tabGroups.query({});
    } catch {
      return [];
    }
  },

  /** Return tabs belonging to a specific tab group id */
  async getTabsInGroup(groupId) {
    return chrome.tabs.query({ groupId });
  },

  /** Return tabs belonging to a specific window id */
  async getTabsInWindow(windowId) {
    return chrome.tabs.query({ windowId });
  },

  /**
   * Return a structured snapshot of all windows with their tabs and groups.
   * Shape: [{ windowId, windowIndex, isCurrent, groups: [{ groupId, title, color, tabs[] }], ungroupedTabs: [] }]
   */
  async getWindowsWithGroups() {
    const [allWindows, currentWin] = await Promise.all([
      this.getAllWindows(),
      this.getCurrentWindow(),
    ]);

    const result = [];

    for (const win of allWindows) {
      const tabs = (win.tabs || []).filter(t => this._isNavigable(t));

      let groups = [];
      try {
        groups = await chrome.tabGroups.query({ windowId: win.id });
      } catch {}

      // Map groupId → group info
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
        totalTabs:   tabs.length,
        groups:      [...groupMap.values()].filter(g => g.tabs.length > 0),
        ungroupedTabs,
      });
    }

    return result;
  },

  // ── Open methods ─────────────────────────────────────────

  async openInCurrentWindow(urls) {
    const win = await this.getCurrentWindow();
    for (const url of urls) {
      await chrome.tabs.create({ windowId: win.id, url, active: false });
    }
  },

  async openInCurrentWindowBatched(urls, batchSize, delayMs) {
    const win  = await this.getCurrentWindow();
    const size = batchSize > 0 ? batchSize : urls.length;
    for (let i = 0; i < urls.length; i += size) {
      for (const url of urls.slice(i, i + size)) {
        await chrome.tabs.create({ windowId: win.id, url, active: false });
      }
      if (i + size < urls.length && delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  },

  async openInNewWindow(urls) {
    const win = await chrome.windows.create({ url: urls[0], focused: true });
    for (let i = 1; i < urls.length; i++) {
      await chrome.tabs.create({ windowId: win.id, url: urls[i], active: false });
    }
  },

  async closeTabs(tabIds) {
    if (tabIds.length > 0) await chrome.tabs.remove(tabIds);
  },

  // ── Helpers ──────────────────────────────────────────────

  _isNavigable(t) {
    return t.url &&
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('chrome-extension://') &&
      !t.url.startsWith('about:');
  },

  filterNavigable(tabs) {
    return tabs.filter(t => this._isNavigable(t));
  },
};
