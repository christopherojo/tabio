/* ─────────────────────────────────────────────────────────
   storage.js  —  chrome.storage.local wrapper
───────────────────────────────────────────────────────── */
'use strict';

const Storage = {

  async get(key) {
    return new Promise(resolve => {
      chrome.storage.local.get(key, result => resolve(result[key] ?? null));
    });
  },

  async set(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  async remove(key) {
    return new Promise(resolve => {
      chrome.storage.local.remove(key, resolve);
    });
  },

  async getAll() {
    return new Promise(resolve => {
      chrome.storage.local.get(null, resolve);
    });
  },
};
