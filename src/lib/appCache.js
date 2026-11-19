/**
 * Process-local cache for data that is shared across many candidates
 * (interview papers, cohort flags) and changes only when staff edit it.
 * Per-student answers/attempts are never stored here.
 */

const store = new Map();

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs = 0) {
  store.set(key, {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
  });
  return value;
}

export function cacheDel(key) {
  store.delete(key);
}

export function cacheDelPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export const CACHE_TTL = {
  enrollment: 15 * 1000,
  cohortFlags: 30 * 1000,
};
