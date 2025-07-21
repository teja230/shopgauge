# Redis Cache Issue on New Login Sessions - Fix

## Problem Description

On new login sessions for the Dashboard, Redis cache was not being properly utilized. New sessions were almost always making API calls to Shopify instead of hitting Redis cache first, even when valid cache data existed.

### Symptoms

1. **New sessions bypass Redis cache**: When a user logs in with a new browser session, the system would skip Redis cache and make fresh API calls to Shopify
2. **Cache miss on valid data**: Redis had valid cached data but new sessions weren't using it
3. **Increased API calls**: More Shopify API calls than necessary, leading to potential rate limiting
4. **Slower dashboard loading**: New sessions took longer to load because they bypassed cache

### Root Cause

The issue was in the frontend's "fresh login" detection logic in `DashboardPage.tsx`:

1. **Flawed fresh login detection**: The frontend incorrectly identified any session without local sessionStorage cache as a "fresh login"
2. **Incorrect cache strategy**: For "fresh logins", the system would skip session cache entirely and go directly to API calls
3. **Missing Redis awareness**: The frontend didn't check if Redis had valid cache data before deciding to skip cache

## Solution Implemented

### 1. Fixed Fresh Login Detection Logic

**File**: `frontend/src/pages/DashboardPage.tsx`

**Changes**:
- Modified fresh login detection to distinguish between shop changes and new browser sessions
- Added Redis cache status checking for new browser sessions
- Changed cache strategy to always check Redis first for new sessions

```typescript
// Before: Incorrectly treated new browser sessions as fresh logins
if (!hasSessionCache) {
  isFreshLoginRef.current = true; // This skipped Redis cache
}

// After: Check Redis cache status for new sessions
if (!hasSessionCache) {
  checkRedisCacheStatus(shop).then(redisStatus => {
    if (redisStatus && hasRedisCache) {
      isFreshLoginRef.current = false; // Use Redis cache
    } else {
      isFreshLoginRef.current = false; // Still check Redis, expect cache miss
    }
  });
}
```

### 2. Added Redis Cache Status Endpoint

**File**: `backend/src/main/java/com/storesight/backend/controller/AnalyticsController.java`

**New Endpoint**: `GET /api/analytics/cache/status`

**Purpose**: Allows frontend to check if Redis has valid cache data before making API calls

```java
@GetMapping("/cache/status")
public ResponseEntity<Map<String, Object>> getCacheStatus(
    @CookieValue(value = "shop", required = false) String shop, 
    HttpSession session) {
    
    Map<String, Object> cacheStatus = new HashMap<>();
    
    // Check if Redis has cached data for each endpoint
    cacheStatus.put("revenue", dashboardCacheService.getCachedRevenueData(shop).isPresent());
    cacheStatus.put("orders", dashboardCacheService.getCachedOrdersData(shop).isPresent());
    cacheStatus.put("products", dashboardCacheService.getCachedProductsData(shop).isPresent());
    // ... other endpoints
    
    return ResponseEntity.ok(Map.of("success", true, "cacheStatus", cacheStatus));
}
```

### 3. Enhanced Cache Strategy

**File**: `frontend/src/pages/DashboardPage.tsx`

**Changes**:
- Updated cache strategy to be more explicit about Redis usage
- Added better logging for debugging cache behavior
- Improved cache decision logic

```typescript
// OPTIMAL STRATEGY: Session cache first, then Redis via backend
if (isFreshLogin) {
  // SHOP CHANGE STRATEGY: Skip session cache, go directly to backend (which checks Redis first)
  console.log(`🔄 ${cacheKey.toUpperCase()}: Shop change detected - checking Redis cache first via backend`);
} else {
  // NORMAL STRATEGY: Session First, Redis Second (to prevent continuous Redis hits)
  if (!forceRefresh && isSessionFresh) {
    console.log(`✅ ${cacheKey.toUpperCase()}: Using session cached data`);
    return cachedEntry.data;
  }
}
```

### 4. Added Debug Endpoint

**File**: `backend/src/main/java/com/storesight/backend/controller/AnalyticsController.java`

**New Endpoint**: `GET /api/analytics/cache/debug` (non-production only)

**Purpose**: Provides detailed cache information for troubleshooting

### 5. Enhanced Cache Utilities

**File**: `frontend/src/utils/cacheUtils.ts`

**New Function**: `checkRedisCacheStatus()`

**Purpose**: Allows frontend to check Redis cache status before making cache decisions

## Testing

### Test Script

**File**: `scripts/test-redis-cache.sh`

**Usage**:
```bash
# Set environment variables
export API_BASE_URL="http://localhost:8080"
export SHOP_DOMAIN="your-shop.myshopify.com"

# Run test
./scripts/test-redis-cache.sh
```

**What it tests**:
- Cache status endpoint
- Debug endpoint
- Revenue endpoint (Redis-first behavior)
- Products endpoint (Redis-first behavior)

### Manual Testing Steps

1. **First Session**:
   - Login to dashboard
   - Check browser console for cache logs
   - Verify API calls are made and data is cached

2. **New Browser Session**:
   - Open new incognito/private window
   - Login to same shop
   - Check browser console for "Redis cache available" messages
   - Verify Redis cache is used instead of API calls

3. **Cache Status Check**:
   - Visit `/api/analytics/cache/status` endpoint
   - Verify cache status shows which endpoints have cached data

## Expected Behavior After Fix

### New Browser Session Flow

1. **Session Detection**: Frontend detects new browser session (no sessionStorage cache)
2. **Redis Status Check**: Frontend checks Redis cache status via API
3. **Cache Decision**: If Redis has data, use Redis-first strategy; if not, expect cache miss
4. **API Call**: Backend always checks Redis first before making Shopify API calls
5. **Cache Update**: New data is cached in both Redis and sessionStorage

### Log Messages to Look For

**Successful Redis Cache Usage**:
```
🆕 New browser session detected: shop.myshopify.com (no session cache, checking Redis status)
✅ Redis cache available for shop.myshopify.com, will use Redis-first strategy
🔄 REVENUE: No session cache, checking Redis cache via backend...
Cache hit for revenue data for shop: shop.myshopify.com (session: abc123)
```

**Cache Miss (Expected for New Shops)**:
```
❌ No Redis cache available for shop.myshopify.com, will make fresh API calls
Cache miss for revenue data for shop: shop.myshopify.com (session: abc123) - making API call
Cached revenue data for shop: shop.myshopify.com
```

## Monitoring

### Cache Statistics

The system tracks cache performance metrics:

- **Cache Hits**: Number of successful Redis cache retrievals
- **Cache Misses**: Number of Redis cache misses
- **Cache Evictions**: Number of cache entries removed
- **Session Count**: Number of active sessions per shop

### Health Checks

Monitor these endpoints for cache health:

- `/api/analytics/cache/status` - Current cache status
- `/api/health/redis` - Redis connectivity and health
- `/api/admin/monitoring/cache` - Detailed cache metrics

## Performance Impact

### Before Fix
- New sessions: Always made API calls (slow)
- Cache utilization: Poor
- API call frequency: High

### After Fix
- New sessions: Check Redis first (fast if cache hit)
- Cache utilization: Optimal
- API call frequency: Reduced

## Troubleshooting

### Common Issues

1. **Redis Connection Issues**:
   - Check `/api/health/redis` endpoint
   - Verify Redis is running and accessible
   - Check circuit breaker status

2. **Cache Not Updating**:
   - Verify TTL settings (default: 120 minutes)
   - Check cache invalidation logic
   - Monitor cache statistics

3. **Session Registration Issues**:
   - Check session count in cache status
   - Verify session registration on API calls
   - Monitor session cleanup processes

### Debug Commands

```bash
# Check Redis cache status
curl -H "Cookie: shop=your-shop.myshopify.com" \
  "http://localhost:8080/api/analytics/cache/status"

# Get detailed cache debug info (non-prod only)
curl -H "Cookie: shop=your-shop.myshopify.com" \
  "http://localhost:8080/api/analytics/cache/debug"

# Run automated test
./scripts/test-redis-cache.sh
```

## Future Improvements

1. **Cache Warming**: Pre-populate cache for frequently accessed shops
2. **Predictive Caching**: Cache data based on user behavior patterns
3. **Cache Compression**: Compress large cache entries to save memory
4. **Cache Analytics**: More detailed analytics on cache performance
5. **Smart TTL**: Dynamic TTL based on data volatility and access patterns 