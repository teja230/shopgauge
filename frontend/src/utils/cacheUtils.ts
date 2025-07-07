/**
 * @file cacheUtils.ts
 * @description Enhanced cache utilities with Redis fallback and improved cache management.
 *
 * This file centralizes cache-related logic to be used across different
 * components and contexts, ensuring consistent cache key generation,
 * Redis fallback, and invalidation behavior.
 */

// Use a consistent version for the cache to allow for easy invalidation when the data structure changes.
export const CACHE_VERSION = '2.1.0';
export const CACHE_KEY_PREFIX = 'dashboard_cache';

// Cache timing configuration (matches backend TTL)
export const CACHE_DURATION_MS = 120 * 60 * 1000; // 2 hours in milliseconds
export const CACHE_WARNING_THRESHOLD_MS = 100 * 60 * 1000; // Show warning when cache is 100+ minutes old

/**
 * Cache entry interface for consistent data structure
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastUpdated: Date;
  version: string;
  shop: string;
  source: 'session' | 'redis' | 'api';
  ttlSeconds?: number;
}

/**
 * Cache metadata for monitoring and debugging
 */
export interface CacheMetadata {
  ageMinutes: number;
  isExpired: boolean;
  source: 'session' | 'redis' | 'api';
  lastUpdated: Date;
  shop: string;
}

/**
 * Generates a shop-specific cache key.
 * @param shop The shop domain (e.g., 'your-shop.myshopify.com').
 * @returns A unique string key for sessionStorage.
 */
export const getCacheKey = (shop: string): string => `${CACHE_KEY_PREFIX}_${shop}_v3`;

/**
 * Check if a cache entry is expired
 * @param entry The cache entry to check
 * @returns true if the cache is expired
 */
export const isCacheExpired = (entry: CacheEntry<any>): boolean => {
  const age = Date.now() - entry.timestamp;
  return age > CACHE_DURATION_MS;
};

/**
 * Get cache age in minutes
 * @param entry The cache entry
 * @returns Age in minutes
 */
export const getCacheAgeMinutes = (entry: CacheEntry<any>): number => {
  return Math.round((Date.now() - entry.timestamp) / (1000 * 60));
};

/**
 * Check if cache should show a warning (getting old but not expired)
 * @param entry The cache entry
 * @returns true if cache is old and should show warning
 */
export const shouldShowCacheWarning = (entry: CacheEntry<any>): boolean => {
  const age = Date.now() - entry.timestamp;
  return age > CACHE_WARNING_THRESHOLD_MS && age < CACHE_DURATION_MS;
};

/**
 * Enhanced cache retrieval with Redis fallback
 * @param shop The shop domain
 * @param cacheKey The specific cache key (e.g., 'revenue', 'orders')
 * @param fallbackFn Optional fallback function to fetch from Redis/API
 * @returns Cache entry or null if not found
 */
export const getCachedData = async <T>(
  shop: string,
  cacheKey: string,
  fallbackFn?: () => Promise<T>
): Promise<CacheEntry<T> | null> => {
  if (!shop) {
    console.warn('getCachedData: No shop provided');
    return null;
  }

  try {
    // First, try session storage
    const sessionKey = getCacheKey(shop);
    const sessionData = sessionStorage.getItem(sessionKey);
    
    if (sessionData) {
      const cache = JSON.parse(sessionData);
      const entry = cache[cacheKey] as CacheEntry<T>;
      
      if (entry && !isCacheExpired(entry)) {
        console.log(`✅ Session cache hit for ${cacheKey} (${getCacheAgeMinutes(entry)}min old)`);
        return {
          ...entry,
          source: 'session',
          lastUpdated: new Date(entry.lastUpdated)
        };
      }
      
      if (entry && isCacheExpired(entry)) {
        console.log(`⚠️ Session cache expired for ${cacheKey} (${getCacheAgeMinutes(entry)}min old)`);
      }
    }

    // If session cache miss/expired, try Redis fallback via API
    if (fallbackFn) {
      console.log(`🔄 Attempting Redis fallback for ${cacheKey}`);
      try {
        const redisData = await fallbackFn();
        if (redisData) {
          const redisEntry: CacheEntry<T> = {
            data: redisData,
            timestamp: Date.now(),
            lastUpdated: new Date(),
            version: CACHE_VERSION,
            shop,
            source: 'redis'
          };
          
          // Update session storage with Redis data
          setCachedData(shop, cacheKey, redisEntry);
          console.log(`✅ Redis cache hit for ${cacheKey}, updated session storage`);
          return redisEntry;
        }
      } catch (error) {
        console.warn(`Redis fallback failed for ${cacheKey}:`, error);
      }
    }

    console.log(`❌ Cache miss for ${cacheKey}`);
    return null;
    
  } catch (error) {
    console.error(`Error retrieving cached data for ${cacheKey}:`, error);
    return null;
  }
};

/**
 * Set cached data in session storage
 * @param shop The shop domain
 * @param cacheKey The specific cache key
 * @param entry The cache entry to store
 */
export const setCachedData = <T>(shop: string, cacheKey: string, entry: CacheEntry<T>): void => {
  if (!shop) {
    console.warn('setCachedData: No shop provided');
    return;
  }

  try {
    const sessionKey = getCacheKey(shop);
    const existingData = sessionStorage.getItem(sessionKey);
    const cache = existingData ? JSON.parse(existingData) : { version: CACHE_VERSION, shop };
    
    cache[cacheKey] = entry;
    cache.version = CACHE_VERSION;
    cache.shop = shop;
    
    sessionStorage.setItem(sessionKey, JSON.stringify(cache));
    console.log(`💾 Cached ${cacheKey} for shop ${shop} (source: ${entry.source})`);
    
  } catch (error) {
    console.error(`Error setting cached data for ${cacheKey}:`, error);
  }
};

/**
 * Get cache metadata for monitoring
 * @param shop The shop domain
 * @param cacheKey The specific cache key
 * @returns Cache metadata or null
 */
export const getCacheMetadata = (shop: string, cacheKey: string): CacheMetadata | null => {
  if (!shop) return null;

  try {
    const sessionKey = getCacheKey(shop);
    const sessionData = sessionStorage.getItem(sessionKey);
    
    if (sessionData) {
      const cache = JSON.parse(sessionData);
      const entry = cache[cacheKey] as CacheEntry<any>;
      
      if (entry) {
        return {
          ageMinutes: getCacheAgeMinutes(entry),
          isExpired: isCacheExpired(entry),
          source: entry.source || 'session',
          lastUpdated: new Date(entry.lastUpdated),
          shop: entry.shop
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting cache metadata for ${cacheKey}:`, error);
    return null;
  }
};

/**
 * Invalidates the cache for a specific shop by removing it from sessionStorage.
 * This is the primary mechanism for clearing cached data on logout, disconnect, or manual refresh.
 * @param shop The shop domain to invalidate.
 * @returns A new, empty cache object with the current version and shop.
 */
export const invalidateCache = (shop: string) => {
  if (!shop) {
    console.warn('Attempted to invalidate cache without a shop name.');
    return { version: CACHE_VERSION, shop: '' };
  }
  console.log(`🗑️ Invalidating cache for shop: ${shop}`);
  sessionStorage.removeItem(getCacheKey(shop));
  return { version: CACHE_VERSION, shop };
};

/**
 * Invalidate specific cache key for a shop
 * @param shop The shop domain
 * @param cacheKey The specific cache key to invalidate
 */
export const invalidateSpecificCache = (shop: string, cacheKey: string): void => {
  if (!shop) return;

  try {
    const sessionKey = getCacheKey(shop);
    const sessionData = sessionStorage.getItem(sessionKey);
    
    if (sessionData) {
      const cache = JSON.parse(sessionData);
      delete cache[cacheKey];
      sessionStorage.setItem(sessionKey, JSON.stringify(cache));
      console.log(`🗑️ Invalidated ${cacheKey} cache for shop: ${shop}`);
    }
  } catch (error) {
    console.error(`Error invalidating ${cacheKey} cache:`, error);
  }
};

/**
 * Get all cache keys for a shop
 * @param shop The shop domain
 * @returns Array of cache keys
 */
export const getCacheKeys = (shop: string): string[] => {
  if (!shop) return [];

  try {
    const sessionKey = getCacheKey(shop);
    const sessionData = sessionStorage.getItem(sessionKey);
    
    if (sessionData) {
      const cache = JSON.parse(sessionData);
      return Object.keys(cache).filter(key => key !== 'version' && key !== 'shop');
    }
    
    return [];
  } catch (error) {
    console.error('Error getting cache keys:', error);
    return [];
  }
};

/**
 * Get cache statistics for debugging
 * @param shop The shop domain
 * @returns Cache statistics object
 */
export const getCacheStats = (shop: string) => {
  if (!shop) return null;

  try {
    const cacheKeys = getCacheKeys(shop);
    const stats = {
      shop,
      totalKeys: cacheKeys.length,
      keys: {} as Record<string, CacheMetadata | null>
    };

    cacheKeys.forEach(key => {
      stats.keys[key] = getCacheMetadata(shop, key);
    });

    return stats;
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
}; 