// MI-specific session cache utils, similar to dashboard cache but under an `mi_` key

export interface MiCacheEntry<T> {
  data: T;
  timestamp: number;
  lastUpdated: string;
  version: string;
  shop: string;
  source?: 'session' | 'redis' | 'api';
  ttlSeconds?: number;
}

const MI_CACHE_VERSION = '1.0';

export const getMiCacheKey = (shop: string): string => `mi_cache_${shop}_v1`;

export const isExpired = (entry?: MiCacheEntry<any>): boolean => {
  if (!entry || !entry.ttlSeconds) return false;
  return Date.now() - entry.timestamp > entry.ttlSeconds * 1000;
};

export const getMiCachedData = <T>(shop: string | null | undefined, key: string): MiCacheEntry<T> | null => {
  if (!shop) return null;
  try {
    const sessionKey = getMiCacheKey(shop);
    const raw = sessionStorage.getItem(sessionKey);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, any>;
    const entry = cache[key] as MiCacheEntry<T> | undefined;
    if (!entry) return null;
    if (isExpired(entry)) return null;
    return entry;
  } catch (err) {
    // Log but do not break UX
    console.warn('MI cache read failed', err);
    return null;
  }
};

export const setMiCachedData = <T>(shop: string | null | undefined, key: string, data: T, opts?: { source?: 'session' | 'redis' | 'api'; ttlSeconds?: number }): void => {
  if (!shop) return;
  try {
    const sessionKey = getMiCacheKey(shop);
    const raw = sessionStorage.getItem(sessionKey);
    const cache = raw ? JSON.parse(raw) : { version: MI_CACHE_VERSION, shop };
    const entry: MiCacheEntry<T> = {
      data,
      timestamp: Date.now(),
      lastUpdated: new Date().toISOString(),
      version: MI_CACHE_VERSION,
      shop,
      source: opts?.source,
      ttlSeconds: opts?.ttlSeconds,
    };
    cache[key] = entry;
    cache.version = MI_CACHE_VERSION;
    cache.shop = shop;
    sessionStorage.setItem(sessionKey, JSON.stringify(cache));
  } catch (err) {
    console.warn('MI cache write failed', err);
  }
};

export const invalidateMiSpecificCache = (shop: string | null | undefined, key: string): void => {
  if (!shop) return;
  try {
    const sessionKey = getMiCacheKey(shop);
    const raw = sessionStorage.getItem(sessionKey);
    if (!raw) return;
    const cache = JSON.parse(raw);
    delete cache[key];
    sessionStorage.setItem(sessionKey, JSON.stringify(cache));
  } catch (err) {
    console.warn('MI cache invalidate failed', err);
  }
};


