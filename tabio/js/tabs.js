/* ─────────────────────────────────────────────────────────
   tabs.js  —  Chrome tabs / windows API wrappers
───────────────────────────────────────────────────────── */
'use strict';

const TabsAPI = {

  async getCurrentWindowTabs()  { return chrome.tabs.query({ currentWindow: true }); },
  async getAllTabs()             { return chrome.tabs.query({}); },
  async getCurrentWindow()      { return chrome.windows.getCurrent(); },

  async openInCurrentWindow(urls) {
    const win = await this.getCurrentWindow();
    for (const url of urls) {
      await chrome.tabs.create({ windowId: win.id, url, active: false });
    }
  },

  async openInCurrentWindowBatched(urls, batchSize, delayMs) {
    const win = await this.getCurrentWindow();
    const size = batchSize > 0 ? batchSize : urls.length;

    for (let i = 0; i < urls.length; i += size) {
      const batch = urls.slice(i, i + size);
      for (const url of batch) {
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

  filterNavigable(tabs) {
    return tabs.filter(t =>
      t.url &&
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('chrome-extension://') &&
      !t.url.startsWith('about:')
    );
  },
};
