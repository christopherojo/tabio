/* ─────────────────────────────────────────────────────────
   tabs.js  —  Chrome tabs / windows API wrappers
───────────────────────────────────────────────────────── */

'use strict';

const TabsAPI = {

  /** Return all tabs in the current window */
  async getCurrentWindowTabs() {
    return chrome.tabs.query({ currentWindow: true });
  },

  /** Return all tabs across every window */
  async getAllTabs() {
    return chrome.tabs.query({});
  },

  /** Return the current window object */
  async getCurrentWindow() {
    return chrome.windows.getCurrent();
  },

  /** Open a list of URLs as new tabs in the current window */
  async openInCurrentWindow(urls) {
    const win = await this.getCurrentWindow();
    for (const url of urls) {
      await chrome.tabs.create({ windowId: win.id, url, active: false });
    }
  },

  /** Open a list of URLs in a brand-new window */
  async openInNewWindow(urls) {
    const win = await chrome.windows.create({ url: urls[0], focused: true });
    for (let i = 1; i < urls.length; i++) {
      await chrome.tabs.create({ windowId: win.id, url: urls[i], active: false });
    }
  },

  /** Close tabs by their IDs */
  async closeTabs(tabIds) {
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds);
    }
  },

  /** Filter out browser-internal and extension URLs */
  filterNavigable(tabs) {
    return tabs.filter(t =>
      t.url &&
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('chrome-extension://') &&
      !t.url.startsWith('about:')
    );
  },

};
