/**
 * @file cacheUtils.ts
 * @description Shared utility functions for managing dashboard cache.
 *
 * This file centralizes cache-related logic to be used across different
 * components and contexts, ensuring consistent cache key generation and
 * invalidation behavior.
 */

// Use a consistent version for the cache to allow for easy invalidation when the data structure changes.
export const CACHE_VERSION = '2.0.0';
export const CACHE_KEY_PREFIX = 'dashboard_cache';

/**
 * Generates a shop-specific cache key.
 * @param shop The shop domain (e.g., 'your-shop.myshopify.com').
 * @returns A unique string key for sessionStorage.
 */
export const getCacheKey = (shop: string): string => `${CACHE_KEY_PREFIX}_${shop}_v3`;

/**
 * Invalidates the cache for a specific shop by removing it from sessionStorage.
 * This is the primary mechanism for clearing cached data on logout, disconnect, or manual refresh.
 * @param shop The shop domain to invalidate.
 * @returns A new, empty cache object with the current version and shop.
 */
export const invalidateCache = (shop: string) => {
  if (!shop) {
    console.warn('Attempted to invalidate cache without a shop name.');
    return;
  }
  console.log(`🗑️ Invalidating cache for shop: ${shop}`);
  sessionStorage.removeItem(getCacheKey(shop));
  return { version: CACHE_VERSION, shop };
}; 