/* ─────────────────────────────────────────────────────────
   cleaner.js  —  URL cleaning: dedupe, strip UTM, sort, group
───────────────────────────────────────────────────────── */
'use strict';

const Cleaner = (() => {

  // ── UTM & tracking params to strip ──────────────────────
  const TRACKING_PARAMS = new Set([
    'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
    'utm_id','utm_source_platform','utm_creative_format','utm_marketing_tactic',
    'fbclid','gclid','gclsrc','dclid','gbraid','wbraid',
    'msclkid','mc_cid','mc_eid',
    'ref','source','_hsenc','_hsmi','hsCtaTracking',
    'igshid','s_kwcid','ef_id','mkt_tok',
  ]);

  /** Remove duplicate URLs (case-insensitive on href) */
  function dedupe(tabs) {
    const seen = new Set();
    return tabs.filter(t => {
      const key = (t.url || '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Strip known tracking query parameters from each tab's URL */
  function stripTracking(tabs) {
    return tabs.map(t => {
      try {
        const u = new URL(t.url);
        TRACKING_PARAMS.forEach(p => u.searchParams.delete(p));
        // Also strip params that start with utm_ not in our list
        [...u.searchParams.keys()].forEach(k => {
          if (k.startsWith('utm_')) u.searchParams.delete(k);
        });
        return { ...t, url: u.toString() };
      } catch {
        return t;
      }
    });
  }

  /** Sort tabs alphabetically by URL */
  function sort(tabs) {
    return [...tabs].sort((a, b) => (a.url || '').localeCompare(b.url || ''));
  }

  /** Group tabs by domain, returns array of { domain, tabs[] } */
  function groupByDomain(tabs) {
    const map = new Map();
    tabs.forEach(t => {
      let domain = 'other';
      try { domain = new URL(t.url).hostname.replace(/^www\./, ''); } catch {}
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain).push(t);
    });
    // Sort groups by count descending
    return [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([domain, tabs]) => ({ domain, tabs }));
  }

  /**
   * Apply all active cleaning options to a flat tab array.
   * Returns flat tabs (or grouped structure if group=true).
   */
  function apply(tabs, { dedupe: doDedupe, stripUtm, sort: doSort, group: doGroup }) {
    let result = [...tabs];
    if (doDedupe)  result = dedupe(result);
    if (stripUtm)  result = stripTracking(result);
    if (doSort)    result = sort(result);
    if (doGroup)   return { grouped: true, groups: groupByDomain(result) };
    return { grouped: false, tabs: result };
  }

  return { apply, dedupe, stripTracking, sort, groupByDomain };

})();
