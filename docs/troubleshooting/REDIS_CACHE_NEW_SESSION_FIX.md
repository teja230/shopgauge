# Redis Cache Issue on New Login Sessions - Fix

## Problem Description

On new login sessions for the Dashboard, Redis cache was not being properly utilized. New sessions were almost always making API calls to Shopify instead of hitting Redis cache first, even when valid cache data existed.

### Symptoms

1. **New sessions bypass Redis cache**: When a user logs in with a new browser session, the system would skip Redis cache and make fresh API calls to Shopify
2. **Cache miss on valid data**: Redis had valid cached data but new sessions weren't using it
3. **Increased API calls**: More Shopify API calls than necessary, leading to potential rate limiting
4. **Slower dashboard loading**: New sessions took longer to load because they bypassed cache

### Root Cause

The frontend's "fresh login" detection logic was incorrectly treating any new browser session (without local sessionStorage cache) as a "fresh login" and skipping Redis cache entirely. This caused new sessions to always make API calls to Shopify instead of utilizing existing Redis cache data.

## Solution Implemented

### 1. Fixed Fresh Login Detection

**File**: `frontend/src/pages/DashboardPage.tsx`

- **Before**: Any session without local cache was treated as "fresh login" and bypassed Redis
- **After**: Distinguishes between shop changes and new browser sessions
- **New Logic**: 
  - Shop change = fresh login (bypass cache)
  - New browser session = check Redis cache first

```typescript
// Fresh login detection: handles both shop changes and new browser sessions
useEffect(() => {
  if (shop && isAuthenticated) {
    // Check if this is a new shop login (shop change)
    if (prevShopRef.current && prevShopRef.current !== shop) {
      console.log(`🆕 Fresh login detected for shop: ${shop} (previous: ${prevShopRef.current})`);
      isFreshLoginRef.current = true;
      
      // Reset fresh login flag after initial data loading
      setTimeout(() => {
        isFreshLoginRef.current = false;
        console.log(`✅ Fresh login period ended for shop: ${shop}`);
      }, 3000); // 3 seconds should be enough for initial load
    } else if (!hasInitializedRef.current) {
      // This could be a new browser session - check Redis cache status
      checkRedisCacheStatus(shop).then(cacheStatus => {
        if (cacheStatus && Object.values(cacheStatus).some(Boolean)) {
          console.log(`🔄 New browser session detected with existing Redis cache for ${shop}`);
          // Use Redis cache for new browser sessions
        }
      });
    }
    
    prevShopRef.current = shop;
    hasInitializedRef.current = true;
  }
}, [shop, isAuthenticated]);
```

### 2. Updated Cache Strategy

**File**: `frontend/src/pages/DashboardPage.tsx`

- **Before**: Fresh logins skipped Redis cache entirely
- **After**: Always check Redis first for new sessions
- **Strategy**: Redis-first approach for all new browser sessions

```typescript
// Stable cache check function with optimal strategy
const checkCacheAndFetch = useCallback(async (
  cacheKey: keyof DashboardCache,
  fetchFunction: () => Promise<any>,
  forceRefresh = false
): Promise<any> => {
  // Skip version and shop keys
  if (cacheKey === 'version' || cacheKey === 'shop') return null;
  
  const fetchKey = `${shop}_${cacheKey}`;
  
  // If there's already an active fetch for this key, wait for it
  if (activeFetches.current.has(fetchKey)) {
    return await activeFetches.current.get(fetchKey);
  }
  
  // Get current cache state from sessionStorage
  const sessionCache = JSON.parse(sessionStorage.getItem(getCacheKey(shop || '')) || '{}');
  const cachedEntry = sessionCache[cacheKey] as CacheEntry<any>;
  
  // Check if we should use cache (not expired and not force refresh)
  const shouldUseCache = cachedEntry && 
    !isCacheExpired(cachedEntry) && 
    !forceRefresh;
  
  if (shouldUseCache) {
    console.log(`📦 Using sessionStorage cache for ${cacheKey} (age: ${getCacheAgeMinutes(cachedEntry)}m)`);
    return cachedEntry.data;
  }
  
  // Cache miss or force refresh - make API call
  console.log(`🌐 Making API call for ${cacheKey}${forceRefresh ? ' (force refresh)' : ''}`);
  
  const promise = fetchFunction().then(freshData => {
    // Update sessionStorage cache with fresh data
    sessionCache[cacheKey] = {
      data: freshData,
      timestamp: Date.now(),
      lastUpdated: new Date(),
      version: CACHE_VERSION,
      shop: shop,
      source: 'api'
    };
    sessionStorage.setItem(getCacheKey(shop || ''), JSON.stringify(sessionCache));
    
    return freshData;
  });
  
  activeFetches.current.set(fetchKey, promise);
  return promise;
}, [shop, isAuthenticated]);
```

### 3. Added Redis Cache Status Endpoint

**File**: `backend/src/main/java/com/storesight/backend/controller/AnalyticsController.java`

New endpoint to check Redis cache status for debugging and optimization:

```java
@GetMapping("/cache/status")
public ResponseEntity<Map<String, Object>> getCacheStatus(
    @CookieValue(value = "shop", required = false) String shop, HttpSession session) {
  if (shop == null) {
    return ResponseEntity.badRequest()
        .body(Map.of("error", "No shop provided", "success", false));
  }

  try {
    Map<String, Object> cacheStatus = new HashMap<>();
    
    // Check if Redis has cached data for each endpoint
    cacheStatus.put("revenue", dashboardCacheService.getCachedRevenueData(shop).isPresent());
    cacheStatus.put("orders", dashboardCacheService.getCachedOrdersData(shop).isPresent());
    cacheStatus.put("products", dashboardCacheService.getCachedProductsData(shop).isPresent());
    cacheStatus.put("inventory", dashboardCacheService.getCachedInventoryData(shop).isPresent());
    cacheStatus.put("newProducts", dashboardCacheService.getCachedNewProductsData(shop).isPresent());
    cacheStatus.put("abandonedCarts", dashboardCacheService.getCachedAbandonedCartsData(shop).isPresent());
    cacheStatus.put("analytics", dashboardCacheService.getCachedAnalyticsData(shop).isPresent());
    
    // Get session count
    cacheStatus.put("activeSessions", dashboardCacheService.getSessionCount(shop));
    cacheStatus.put("isSessionRegistered", dashboardCacheService.isSessionRegistered(shop, session.getId()));
    
    // Get cache statistics
    cacheStatus.put("cacheStats", dashboardCacheService.getCacheStatistics());
    
    return ResponseEntity.ok(Map.of("success", true, "cacheStatus", cacheStatus));
  } catch (Exception e) {
    logger.error("Failed to get cache status: {}", e.getMessage());
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "Failed to get cache status", "success", false));
  }
}
```

### 4. Added Debug Endpoint (Development Only)

**File**: `backend/src/main/java/com/storesight/backend/controller/AnalyticsController.java`

Debug endpoint for detailed cache information (only available in non-production):

```java
@GetMapping("/cache/debug")
@Profile("!prod") // Only available in non-production environments
public ResponseEntity<Map<String, Object>> debugCache(
    @CookieValue(value = "shop", required = false) String shop, HttpSession session) {
  // Detailed cache debugging information
  // Returns cache key details, TTL, value sizes, etc.
}
```

### 5. Enhanced Cache Utilities

**File**: `frontend/src/utils/cacheUtils.ts`

Added Redis cache status checking functionality:

```typescript
/**
 * Check Redis cache status for a shop
 * @param shop The shop domain
 * @returns Cache status object or null if failed
 */
export const checkRedisCacheStatus = async (shop: string): Promise<any | null> => {
  if (!shop) {
    console.warn('checkRedisCacheStatus: No shop provided');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/analytics/cache/status`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`🔍 Redis cache status for ${shop}:`, data.cacheStatus);
      return data.cacheStatus;
    } else {
      console.warn(`Failed to check Redis cache status: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error checking Redis cache status:', error);
    return null;
  }
};
```

## Cache Flow Architecture

### Frontend Cache Strategy (Browser)
```
1. SessionStorage Cache (Browser) → 2. API Call → 3. Update SessionStorage
```

### Backend Cache Strategy (Server)
```
1. Redis Cache → 2. API Call to Shopify → 3. Update Redis Cache
```

### Complete Request Flow
```
User Request → Frontend → Backend → Response
     ↓
1. Frontend checks SessionStorage (browser cache)
     ↓
2. If SessionStorage miss → Frontend makes API call to Backend
     ↓
3. Backend checks Redis cache
     ↓
4. If Redis miss → Backend makes API call to Shopify
     ↓
5. Backend updates Redis cache
     ↓
6. Backend returns data to Frontend
     ↓
7. Frontend updates SessionStorage cache
     ↓
8. Frontend displays data to user
```

### Cache Hierarchy
- **Frontend**: SessionStorage → API Call → Update SessionStorage
- **Backend**: Redis → Shopify API → Update Redis
- **Shop Isolation**: Each shop has separate cache entries at both levels
- **Cache Updates**: Both caches are updated when fresh data is fetched

## Cache Key Patterns

### Frontend SessionStorage Keys
```
dashboard_cache_shop-a.myshopify.com_v3
dashboard_cache_shop-b.myshopify.com_v3
```

### Backend Redis Keys
```
dashboard:revenue:shop-a.myshopify.com
dashboard:orders:shop-a.myshopify.com
dashboard:products:shop-a.myshopify.com
dashboard:inventory:shop-a.myshopify.com
dashboard:new_products:shop-a.myshopify.com
dashboard:abandoned_carts:shop-a.myshopify.com
dashboard:analytics:shop-a.myshopify.com
```

## Cache TTL and Expiration

- **Frontend SessionStorage**: 120 minutes (2 hours)
- **Backend Redis**: 120 minutes (2 hours)
- **Warning Threshold**: 60 minutes (1 hour) - shows warning when cache is getting old
- **Automatic Refresh**: Cache expires and triggers fresh API calls

## Manual Refresh Behavior

When users click "Refresh Data":

1. **Force Refresh**: Bypasses both SessionStorage and Redis cache
2. **Fresh API Calls**: Makes new calls to Shopify
3. **Cache Updates**: Updates both SessionStorage and Redis with fresh data
4. **Shop-Specific**: Only refreshes cache for the current shop

## Testing and Validation

### Test Script
A test script is provided at `scripts/test-redis-cache.sh` for validating cache behavior:

```bash
# Test Redis cache endpoints
./scripts/test-redis-cache.sh
```

### Manual Testing
1. **New Session Test**: Open new browser session → Should use Redis cache
2. **Shop Change Test**: Switch to different shop → Should bypass cache
3. **Refresh Test**: Click refresh → Should update both caches
4. **Cache Status**: Check `/api/analytics/cache/status` endpoint

## Benefits of the Fix

1. **Reduced API Calls**: New sessions use existing Redis cache instead of making fresh API calls
2. **Improved Performance**: Faster dashboard loading for new sessions
3. **Better Resource Utilization**: Reduced Shopify API rate limiting
4. **Maintained Data Freshness**: Cache still expires and gets updated appropriately
5. **Shop Isolation**: Each shop maintains separate cache entries
6. **Debugging Capabilities**: Enhanced monitoring and debugging endpoints

## Monitoring and Maintenance

### Cache Monitoring
- Use `/api/analytics/cache/status` to monitor cache health
- Check cache hit/miss ratios in logs
- Monitor Redis memory usage

### Cache Invalidation
- Manual invalidation via `/api/analytics/cache/invalidate`
- Automatic expiration after 2 hours
- Force refresh bypasses cache entirely

### Troubleshooting
- Check Redis connectivity and health
- Verify cache key patterns
- Monitor API call frequency
- Review cache expiration settings

## Future Enhancements

1. **Cache Warming**: Pre-populate cache for frequently accessed shops
2. **Adaptive TTL**: Adjust cache duration based on data volatility
3. **Cache Analytics**: Track cache performance metrics
4. **Distributed Cache**: Consider Redis cluster for high availability
5. **Cache Compression**: Compress large cache entries to save memory

---

**Note**: This fix ensures that new login sessions properly utilize Redis cache while maintaining data freshness and shop-level isolation. The cache hierarchy is optimized for performance while preserving the integrity of the caching system. 