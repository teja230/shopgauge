# Demo Mode Redirect Issues - Fixed

## Problem Analysis

The user reported redirect issues with the demo mode functionality where:
1. Clicking "Demo" button would take users to Live mode unintentionally
2. Re-enabling demo mode would still have issues
3. State was not being maintained consistently
4. **NEW**: Demo mode toggle was showing brief Live mode flash before switching to Demo
5. **NEW**: Health endpoint `/api/health/summary` was returning 401 Unauthorized errors

## Root Cause Identified

The main issues were:

### 1. Race Condition in `toggleDemoMode`
- When switching from Demo to Live mode, the function called `fetchData(true)` immediately
- `fetchData` had logic that could override user's explicit choice based on data availability
- This created a race condition where user preference was being overridden

### 2. Conflicting State Management
In `fetchData` function, the demo mode logic was:
```javascript
if (competitorsData.length === 0 && suggestionCountData.newSuggestions === 0) {
  setIsDemoMode(true); // This could override user's explicit Live mode choice
}
```

### 3. Async State Updates
The original `toggleDemoMode` function used:
```javascript
fetchData(true).then(() => {
  if (userDisabledDemo) {
    setIsDemoMode(false); // Too late - state might have been overridden
  }
});
```

### 4. **NEW**: State Update Flickering
- Multiple separate `setState` calls caused UI flickering
- `setTimeout` delay was too long (100ms) causing visible state changes
- `fetchData` was called even when switching to Demo mode (unnecessary)

### 5. **NEW**: Health Endpoint Authentication
- `/api/health/summary` endpoint required authentication but shouldn't
- Missing from `permitAll()` list in Spring Security configuration
- Causing 401 errors on service status checks

## Fixes Implemented

### 1. Improved Toggle Function (Latest Version)
```javascript
const toggleDemoMode = useCallback(() => {
  if (isDemoMode) {
    // User explicitly switching from Demo to Live mode
    // Set all state changes together to prevent flickering
    setUserDisabledDemo(true);
    setIsDemoMode(false);
    setCompetitors([]);
    setSuggestionCount(0);
    
    // Load real data after a brief delay (reduced to 50ms)
    setTimeout(() => {
      fetchData(true);
    }, 50);
    
  } else {
    // User explicitly switching from Live to Demo mode
    // Set all state changes together immediately - no API calls needed
    setUserDisabledDemo(false);
    setIsDemoMode(true);
    setCompetitors(DEMO_COMPETITORS);
    setSuggestionCount(DEMO_SUGGESTIONS.length);
    
    // No fetchData call needed for demo mode - everything is already set
  }
}, [isDemoMode, notifications, fetchData, shop]);
```

### 2. Enhanced fetchData Logic (Latest Version)
```javascript
// Handle demo mode logic - respect user preference above all
if (userDisabledDemo) {
  // User explicitly disabled demo - stay in live mode regardless of data
  // Only update mode if we're not already in live mode to prevent unnecessary renders
  if (isDemoMode) {
    setIsDemoMode(false);
  }
} else if (!forceRefresh && !isDemoMode && (competitorsData.length === 0 && suggestionCountData.newSuggestions === 0)) {
  // Only auto-enable demo if:
  // 1. This is not a forced refresh (prevents overriding user toggle actions)
  // 2. We're not already in demo mode (prevents unnecessary state changes)
  // 3. We have no data
  setIsDemoMode(true);
  setCompetitors(DEMO_COMPETITORS);
  setSuggestionCount(DEMO_SUGGESTIONS.length);
} else if ((competitorsData.length > 0 || suggestionCountData.newSuggestions > 0) && !userDisabledDemo) {
  // Has data and user hasn't explicitly chosen demo - use live mode
  if (isDemoMode) {
    setIsDemoMode(false);
  }
}
```

### 3. **NEW**: Health Endpoint Authentication Fix
```java
// WebSecurityConfig.java
.authorizeHttpRequests(
    auth ->
        auth.requestMatchers(
                "/api/auth/shopify/**", 
                "/actuator/**", 
                "/health/**",      // Added
                "/api/health/**",  // Added
                "/")
            .permitAll()
            .anyRequest()
            .authenticated())
```

### 4. Enhanced Error Handling
- Improved error handling in `handleAdd` function to prevent JSON errors from causing redirects
- Better user-friendly error messages
- Automatic product syncing for PRODUCTS_SYNC_NEEDED errors

### 5. Added Comprehensive Debugging
- Console logs to track state changes
- User preference persistence logging
- fetchData behavior tracking

## Key Improvements

1. **Race Condition Eliminated**: Using `setTimeout` to delay `fetchData` after toggle
2. **User Preference Respected**: `forceRefresh` flag prevents overriding user choices
3. **Immediate State Updates**: UI updates immediately without waiting for API calls
4. **Persistent Preferences**: LocalStorage properly manages user choices per shop
5. **Better Error Handling**: No more raw JSON errors or unwanted redirects
6. **⭐ NEW: Flickering Eliminated**: Grouped state changes prevent UI flickering
7. **⭐ NEW: Faster Response**: Reduced setTimeout from 100ms to 50ms
8. **⭐ NEW: No Unnecessary API Calls**: Demo mode toggle doesn't call fetchData
9. **⭐ NEW: Health Endpoint Fixed**: 401 errors resolved for service monitoring

## Testing

The fixes ensure:
- ✅ Clicking "Demo" button correctly switches between Demo/Live modes
- ✅ User preferences are maintained across page refreshes
- ✅ No race conditions between state updates and API calls
- ✅ Proper error handling without redirects
- ✅ Comprehensive debugging for future troubleshooting
- ✅ **NEW**: No flickering or brief mode flashes during toggle
- ✅ **NEW**: Health endpoints work without authentication
- ✅ **NEW**: Faster and smoother user experience

## User Experience

Users can now:
- **Seamlessly toggle** between Demo and Live modes without flickering
- **Trust that their choice will be respected** - no unexpected mode switches
- **See immediate feedback** when switching modes (no delays or flashes)
- **Have their preference remembered** per shop
- **Get helpful error messages** instead of raw JSON responses
- **⭐ NEW**: Experience instant Demo mode activation (no API delays)
- **⭐ NEW**: See proper service status monitoring without errors

## Technical Details

### State Management Improvements
- **Grouped setState calls**: Prevents React from showing intermediate states
- **Conditional updates**: Only update state when actually needed
- **Optimized timing**: 50ms delay for Live mode, instant for Demo mode

### Authentication Improvements
- **Health endpoints**: Now properly excluded from authentication requirements
- **Service monitoring**: Works correctly without session cookies
- **Error reduction**: Eliminates 401 errors in service status checks

The demo mode now works reliably without any redirect issues, flickering, or authentication problems! 