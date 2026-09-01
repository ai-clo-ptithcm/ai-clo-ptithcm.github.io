/* AI-CLO PTITHCM V11 — shared lightweight performance helpers.
 * Keep this file dependency-free so domain modules can reuse it safely.
 */
(() => {
  'use strict';

  const cache = new Map();

  async function memo(key, ttlMs, loader, { force = false } = {}) {
    const now = Date.now();
    const hit = cache.get(key);
    if (!force && hit && hit.expiresAt > now) return hit.promise;

    const promise = Promise.resolve().then(loader);
    cache.set(key, { expiresAt: now + Math.max(0, Number(ttlMs) || 0), promise });
    try {
      return await promise;
    } catch (error) {
      if (cache.get(key)?.promise === promise) cache.delete(key);
      throw error;
    }
  }

  function invalidate(prefix = '') {
    for (const key of cache.keys()) {
      if (!prefix || key.startsWith(prefix)) cache.delete(key);
    }
  }

  function idle(task, timeout = 1200) {
    if (typeof requestIdleCallback === 'function') {
      return requestIdleCallback(task, { timeout });
    }
    return setTimeout(task, 0);
  }

  window.AICLO_PERF = Object.freeze({ memo, invalidate, idle });
})();
