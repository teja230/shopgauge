# Dashboard Loading Fixes

## Issues Identified

1. **Authentication Race Condition**: Dashboard tries to load data before authentication is fully established
2. **Cache Invalidation Problems**: Cache prevents fresh data loading after OAuth
3. **Missing Authentication Checks**: Data loading doesn't verify authentication state
4. **Refresh Logic Issues**: Refresh button doesn't properly trigger data reloads

## Root Causes

### 1. Authentication State Race Condition
- Dashboard component loads before `AuthContext` has finished checking authentication
- Data loading effects run before `isAuthenticated` is properly set
- No proper handling of `authLoading` state

### 2. Cache Management Issues
- Cache not properly cleared when shop changes
- Cache prevents fresh data loading after OAuth re-authentication
- Cross-shop data mixing possible

### 3. API Call Dependencies
- Some API calls fail silently without proper error handling
- No retry logic for failed requests
- Missing authentication headers in some requests

## Fixes Implemented

### 1. Authentication State Handling
```typescript
// Add proper authentication checks
useEffect(() => {
  if (isAuthenticated && shop) {
    console.log('Dashboard: Authentication confirmed, shop:', shop);
    setLoading(false);
    setError(null);
  } else if (!isAuthenticated && shop === null) {
    console.log('Dashboard: Not authenticated, redirecting to home');
    setLoading(false);
    navigate('/');
  }
}, [isAuthenticated, shop, navigate]);
```

### 2. Improved Data Loading Logic
```typescript
// Fix main data loading effect
useEffect(() => {
  if (isAuthenticated && shop && shop.trim() !== '' && isInitialLoad) {
    setIsInitialLoad(false);
    // Load data only when authenticated
    loadAllData();
  } else if (!isAuthenticated && shop) {
    // Redirect if not authenticated
    navigate('/');
  }
}, [isAuthenticated, shop, isInitialLoad, navigate, ...fetchFunctions]);
```

### 3. Cache Management Improvements
```typescript
// Clear cache when shop changes
useEffect(() => {
  if (shop) {
    console.log('Dashboard: Shop changed, clearing cache for:', shop);
    const freshCache = invalidateCache();
    setCache(freshCache);
    setLastGlobalUpdate(null);
    setIsInitialLoad(true);
  }
}, [shop]);
```

### 4. Enhanced Error Handling
```typescript
// Add proper error handling for API calls
const fetchRevenueData = useCallback(async (forceRefresh = false) => {
  setCardLoading(prev => ({ ...prev, revenue: true }));
  setCardErrors(prev => ({ ...prev, revenue: null }));
  
  try {
    const data = await getCachedOrFetch('revenue', async () => {
      const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/revenue'));
      return await response.json();
    }, forceRefresh);
    
    // Handle authentication errors
    if (data.error_code === 'INSUFFICIENT_PERMISSIONS') {
      setCardErrors(prev => ({ ...prev, revenue: 'Permission denied – please re-authenticate' }));
      return;
    }
    
    // Update insights state
    setInsights(prev => ({
      ...prev!,
      totalRevenue: data.totalRevenue || 0,
      timeseries: data.timeseries || []
    }));
  } catch (error) {
    console.error('Revenue fetch failed:', error);
    setCardErrors(prev => ({ ...prev, revenue: 'Failed to load revenue data' }));
  } finally {
    setCardLoading(prev => ({ ...prev, revenue: false }));
  }
}, [retryWithBackoff, getCachedOrFetch]);
```

## Testing Steps

1. **Initial Load Test**
   - Clear browser cache and session storage
   - Navigate to dashboard
   - Verify data loads properly after authentication

2. **OAuth Flow Test**
   - Disconnect shop
   - Re-authenticate via OAuth
   - Verify dashboard loads fresh data

3. **Refresh Test**
   - Click refresh button
   - Verify all data reloads properly
   - Check cache is cleared and fresh data fetched

4. **Error Recovery Test**
   - Simulate network errors
   - Verify proper error handling and retry logic

## Expected Behavior After Fixes

1. **Proper Loading Sequence**
   - Authentication check completes first
   - Dashboard only loads data when authenticated
   - Loading states properly managed

2. **Cache Management**
   - Cache cleared on shop changes
   - Fresh data loaded after OAuth
   - No cross-shop data mixing

3. **Error Handling**
   - Proper error messages displayed
   - Retry logic for failed requests
   - Graceful degradation for partial failures

4. **Refresh Functionality**
   - Refresh button clears cache
   - All data reloaded properly
   - Loading states reset correctly 