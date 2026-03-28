/* ─────────────────────────────────────────────────────────
   storage.js  —  chrome.storage.local wrapper with
                  safe access guard + in-memory fallback
───────────────────────────────────────────────────────── */
'use strict';

const Storage = (() => {

  // ── In-memory fallback (used when chrome.storage is unavailable) ─────
  const _mem = new Map();

  function _isAvailable() {
    try {
      return (
        typeof chrome !== 'undefined' &&
        chrome.storage != null &&
        chrome.storage.local != null
      );
    } catch {
      return false;
    }
  }

  // ── Core operations ──────────────────────────────────────

  async function get(key) {
    if (!_isAvailable()) return _mem.get(key) ?? null;
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(key, result => {
          if (chrome.runtime.lastError) {
            console.warn('[Tabio] storage.get error:', chrome.runtime.lastError.message);
            resolve(_mem.get(key) ?? null);
          } else {
            resolve(result[key] ?? null);
          }
        });
      } catch (err) {
        console.warn('[Tabio] storage.get exception:', err);
        resolve(_mem.get(key) ?? null);
      }
    });
  }

  async function set(key, value) {
    // Always keep in-memory copy as safety net
    _mem.set(key, value);

    if (!_isAvailable()) return;
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Tabio] storage.set error:', chrome.runtime.lastError.message);
          }
          resolve();
        });
      } catch (err) {
        console.warn('[Tabio] storage.set exception:', err);
        resolve();
      }
    });
  }

  async function remove(key) {
    _mem.delete(key);

    if (!_isAvailable()) return;
    return new Promise((resolve) => {
      try {
        chrome.storage.local.remove(key, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Tabio] storage.remove error:', chrome.runtime.lastError.message);
          }
          resolve();
        });
      } catch (err) {
        console.warn('[Tabio] storage.remove exception:', err);
        resolve();
      }
    });
  }

  async function getAll() {
    if (!_isAvailable()) return Object.fromEntries(_mem);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(null, result => {
          if (chrome.runtime.lastError) {
            console.warn('[Tabio] storage.getAll error:', chrome.runtime.lastError.message);
            resolve(Object.fromEntries(_mem));
          } else {
            resolve(result);
          }
        });
      } catch (err) {
        console.warn('[Tabio] storage.getAll exception:', err);
        resolve(Object.fromEntries(_mem));
      }
    });
  }

  return { get, set, remove, getAll };

})();
