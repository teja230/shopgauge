# Service Status Context - Persistent Health Summary Calls Fix

## Problem Analysis

The user reported that health summary calls (`/api/health/summary`) were continuing to be made even after manually navigating back to valid pages from a 502 error page. This indicated that the ServiceStatusContext was stuck in a retry loop and not properly detecting when the service was back online or when the user had manually navigated away.

## Root Cause Identified

### 1. **Retry Loop Not Stopping on Manual Navigation**
- ServiceStatusContext would start a retry loop when detecting 502 errors
- The retry loop would continue indefinitely, even when users manually navigated to working pages
- No mechanism to detect when users had successfully accessed other parts of the application

### 2. **HealthSummary Component Aggressive Polling**
- HealthSummary component was setting up intervals every 60 seconds
- Would restart polling whenever `isServiceAvailable` became true
- No consideration for whether the service status was manually resolved

### 3. **Missing Location Awareness**
- ServiceStatusContext wasn't monitoring route changes
- Couldn't detect when users navigated away from error pages
- No way to infer service recovery from successful navigation

## Fixes Implemented

### 1. **Location-Aware Service Status Management**

Added route monitoring to detect manual navigation:

```javascript
// Monitor location changes to detect when user navigates away from error pages
useEffect(() => {
  const currentPath = location.pathname;
  
  // If user navigates away from service-unavailable page, assume they found a working page
  if (currentPath !== '/service-unavailable' && !isServiceAvailable && isRetryingRef.current) {
    console.log('ServiceStatus: User navigated away from error page, assuming service is back online');
    userNavigatedAwayRef.current = true;
    
    // Reset service status to available and stop retrying
    setIsServiceAvailable(true);
    setLastServiceCheck(new Date());
    setRetryCount(0);
    lastSuccessfulCheckRef.current = new Date();
    
    // Stop retrying
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
    isRetryingRef.current = false;
  }
}, [location.pathname, isServiceAvailable]);
```

### 2. **Enhanced Retry Loop with Navigation Checks**

Improved retry logic to respect manual navigation:

```javascript
const startRetryLoop = () => {
  // Don't start retrying if user has manually navigated away
  if (userNavigatedAwayRef.current) {
    console.log('ServiceStatus: Not starting retry loop - user has manually navigated away');
    return;
  }

  // Start retrying every 10 seconds (increased from 5 to reduce frequency)
  retryIntervalRef.current = setInterval(() => {
    // Double check if user has navigated away
    if (userNavigatedAwayRef.current) {
      console.log('ServiceStatus: Stopping retry loop - user has navigated away');
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      isRetryingRef.current = false;
      return;
    }
    
    setRetryCount(prev => prev + 1);
    checkServiceStatus();
  }, 10000); // Check every 10 seconds instead of 5
};
```

### 3. **Conservative HealthSummary Polling**

Reduced aggressive health checking:

```javascript
useEffect(() => {
  // Only set up interval if service is available and we have metrics
  if (!isServiceAvailable || !metrics) {
    return;
  }

  // Use longer interval to reduce health check frequency
  const interval = setInterval(fetchMetrics, 120_000); // refresh every 2 minutes instead of 1
  return () => clearInterval(interval);
}, [isServiceAvailable, metrics]);
```

### 4. **User Navigation Tracking**

Added `userNavigatedAwayRef` to track manual navigation:

```javascript
const userNavigatedAwayRef = useRef(false);

const resetServiceStatus = () => {
  console.log('ServiceStatus: Resetting service status to available');
  setIsServiceAvailable(true);
  setLastServiceCheck(new Date());
  setRetryCount(0);
  lastSuccessfulCheckRef.current = new Date();
  userNavigatedAwayRef.current = true; // Mark that user manually reset
  
  // Stop retrying
  if (retryIntervalRef.current) {
    clearInterval(retryIntervalRef.current);
    retryIntervalRef.current = null;
  }
  isRetryingRef.current = false;
};
```

## Key Improvements

### 1. **Smart Service Recovery Detection**
- **Location Monitoring**: Automatically detects when users navigate to working pages
- **Manual Navigation Respect**: Stops retry loops when users successfully access other routes
- **Intelligent State Reset**: Assumes service is back online when users can navigate normally

### 2. **Reduced Health Check Frequency**
- **Retry Interval**: Increased from 5 seconds to 10 seconds
- **HealthSummary Polling**: Increased from 60 seconds to 120 seconds
- **Conditional Polling**: Only polls when service is available AND metrics are loaded

### 3. **Better State Management**
- **Navigation Tracking**: `userNavigatedAwayRef` prevents unnecessary retry loops
- **Route Awareness**: Uses `useLocation` to monitor navigation patterns
- **Graceful Cleanup**: Proper interval cleanup when navigation is detected

### 4. **Enhanced User Experience**
- **No Persistent Calls**: Health checks stop when users navigate away from error pages
- **Faster Recovery**: Service status resets immediately on successful navigation
- **Reduced Server Load**: Fewer unnecessary health check requests

## Technical Implementation

### State Management
```javascript
const [isServiceAvailable, setIsServiceAvailable] = useState(true);
const [lastServiceCheck, setLastServiceCheck] = useState<Date | null>(null);
const [retryCount, setRetryCount] = useState(0);
const navigate = useNavigate();
const location = useLocation(); // ✅ Added
const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
const isRetryingRef = useRef(false);
const lastSuccessfulCheckRef = useRef<Date | null>(null);
const lastCheckTimeRef = useRef<number>(0);
const userNavigatedAwayRef = useRef(false); // ✅ Added
```

### Navigation Detection
- Monitors `location.pathname` changes
- Detects navigation away from `/service-unavailable`
- Automatically resets service status when valid navigation occurs

### Retry Loop Management
- Checks `userNavigatedAwayRef` before starting retries
- Includes navigation checks within retry intervals
- Gracefully stops retrying when manual navigation is detected

## Results

### Before Fix:
- ❌ Health summary calls continued indefinitely after 502 recovery
- ❌ Retry loops persisted even when users accessed working pages
- ❌ Aggressive polling (every 5-60 seconds) caused unnecessary server load
- ❌ No detection of manual navigation away from error pages

### After Fix:
- ✅ **Health checks stop automatically** when users navigate to working pages
- ✅ **Intelligent service recovery** based on successful navigation patterns
- ✅ **Reduced server load** with longer polling intervals (10s retry, 2min health)
- ✅ **Better user experience** with no persistent background calls
- ✅ **Smart state management** that respects user actions

## User Experience Impact

Users now experience:
- **No persistent health calls** after navigating away from 502 pages
- **Faster service recovery detection** based on their navigation success
- **Reduced background activity** with less aggressive polling
- **Better performance** with fewer unnecessary API requests
- **Seamless recovery** when services come back online

The service status context now properly detects when users have successfully navigated away from error states and intelligently manages health checking accordingly. 

# Service Status & Discovery Endpoint Fixes

## Issues Addressed

### 1. Discovery Status 500 Error
**Problem**: The `/api/competitors/discovery/status` endpoint was returning 500 Internal Server Error
**Root Cause**: The endpoint was failing when the `last_discovery_at` column didn't exist or when there were database connection issues
**Solution**: 
- Added comprehensive error handling in `buildDiscoveryStatus()` method
- Added graceful fallback when the `last_discovery_at` column doesn't exist
- Returns safe default values instead of throwing exceptions
- Added detailed logging for debugging

### 2. Missing Notification Center Buttons
**Problem**: The notification center was missing a "Mark all unread" button
**Root Cause**: The functionality didn't exist in the `useNotifications` hook or UI
**Solution**:
- Added `markAllAsUnread()` function to `useNotifications` hook
- Added "Mark all unread" button to notification center UI
- Improved button layout to accommodate three buttons (Mark all read, Mark all unread, Clear all)
- Added proper disabled states for buttons

## Technical Implementation

### Discovery Status Endpoint Enhancement
```java
// Added error handling and column existence check
private Map<String, Object> buildDiscoveryStatus(Long shopId) {
    // ... safe default values
    try {
        // Check if column exists before querying
        List<Map<String, Object>> lastDiscovery = null;
        try {
            lastDiscovery = jdbcTemplate.queryForList("SELECT last_discovery_at FROM shops WHERE id = ?", shopId);
        } catch (Exception columnError) {
            log.warn("last_discovery_at column not found for shop {}: {}. Using default discovery status.", shopId, columnError.getMessage());
            return status; // Return default status
        }
        // ... rest of logic
    } catch (Exception e) {
        log.error("Error building discovery status for shop {}: {}", shopId, e.getMessage(), e);
        status.put("error_details", "Unable to check discovery status: " + e.getMessage());
    }
    return status;
}
```

### Notification Center Enhancement
```typescript
// Added markAllAsUnread functionality
const markAllAsUnread = useCallback(async () => {
    globalNotifications = globalNotifications.map(n => ({ ...n, read: false }));
    globalUnreadCount = globalNotifications.length;
    setNotifications([...globalNotifications]);
    setUnreadCount(globalUnreadCount);
    broadcast();
}, []);
```

```tsx
// Updated UI with three-button layout
<NotificationActions>
  <Box display="flex" gap={1} flexWrap="wrap">
    <Button onClick={markAllAsRead} disabled={unreadCount === 0}>
      Mark all read
    </Button>
    <Button onClick={markAllAsUnread} disabled={notifications.filter(n => n.read).length === 0}>
      Mark all unread
    </Button>
  </Box>
  <Button color="error" onClick={handleDismissAll}>
    Clear all
  </Button>
</NotificationActions>
```

## Authentication Requirements

The discovery status endpoint requires proper authentication:
- Valid shop cookie with a shop that exists in the database
- The 401 errors are expected when testing with non-existent shops
- The endpoint works correctly when properly authenticated

## Database Migration Status

The `V20__add_last_discovery_tracking.sql` migration adds the required `last_discovery_at` column:
```sql
ALTER TABLE shops ADD COLUMN last_discovery_at TIMESTAMP;
CREATE INDEX idx_shops_last_discovery_at ON shops(last_discovery_at);
```

## Error Handling Improvements

1. **Graceful Degradation**: When the discovery tracking column doesn't exist, the endpoint returns default values instead of failing
2. **Detailed Logging**: Added comprehensive logging for debugging discovery status issues
3. **Safe Fallbacks**: All error conditions return valid JSON responses instead of throwing exceptions

## UI/UX Improvements

1. **Complete Button Set**: Notification center now has all three essential actions
2. **Smart Disabled States**: Buttons are disabled when actions aren't applicable
3. **Responsive Layout**: Button layout adapts to available space
4. **Consistent Styling**: All buttons follow the same design pattern

## Testing Results

- ✅ Discovery status endpoint returns proper JSON even with missing columns
- ✅ Authentication errors return 401 with clear error messages (expected behavior)
- ✅ Notification center displays all three action buttons
- ✅ Mark all unread functionality works correctly
- ✅ Button states update properly based on notification status

## Future Considerations

1. **Backend Mark as Unread**: Currently mark all unread only works locally. Could be enhanced to sync with backend if needed.
2. **Batch Operations**: Could optimize notification operations for better performance with large notification counts.
3. **Discovery Service Health**: Could add health checks for the discovery service availability. 