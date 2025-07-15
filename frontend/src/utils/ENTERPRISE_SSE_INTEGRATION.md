# Enterprise SSE Integration Guide

✅ **MIGRATION COMPLETED** - This guide shows the completed integration of the enterprise-grade SSE solution into your existing codebase, replacing the current SSE implementation with a production-ready version.

## ✅ Migration Completed

### 1. ✅ Replaced Existing SSE Usage

**Before (Old Implementation):**
```typescript
// In AuthContext.tsx
import { subscribeToSessionEvents } from '../utils/sessionUtils';

useEffect(() => {
  let unsubscribe: (() => void) | null = null;
  if (isAuthenticated && shop) {
    unsubscribe = subscribeToSessionEvents(shop, (data, event) => {
      if (data && data.event === 'session_invalidated') {
        // Handle session invalidation
      }
    });
  }
  return () => {
    if (unsubscribe) unsubscribe();
  };
}, [isAuthenticated, shop]);
```

**After (Enterprise Implementation):**
```typescript
// In AuthContext.tsx
import { useEnterpriseSse } from '../hooks/useEnterpriseSse';

// Inside your component
const { isConnected, isReconnecting, isPolling, isRateLimited } = useEnterpriseSse({
  autoConnect: true,
  enableNotifications: false, // We handle notifications manually
  enableDebug: import.meta.env.DEV
});
```

### 2. Update App.tsx

**Replace the existing SSE setup:**
```typescript
// Remove this from App.tsx
useEffect(() => {
  let unsubscribe: (() => void) | null = null;
  if (isAuthenticated && shop) {
    unsubscribe = subscribeToSessionEvents(shop, (data, event) => {
      // ... existing event handling
    });
  }
  return () => {
    if (unsubscribe) unsubscribe();
  };
}, [isAuthenticated, shop]);
```

**Add the new hook:**
```typescript
// In App.tsx
import { useEnterpriseSse } from './hooks/useEnterpriseSse';

const AppContent: React.FC = () => {
  // ... existing code ...

  // Replace existing SSE with enterprise version
  const { 
    isConnected, 
    isReconnecting, 
    isPolling, 
    isRateLimited,
    connectionState,
    metrics 
  } = useEnterpriseSse({
    autoConnect: true,
    enableNotifications: true,
    enableDebug: import.meta.env.DEV
  });

  // ... rest of component
};
```

## Advanced Integration

### 1. Custom Event Handling

If you need custom event handling beyond the defaults:

```typescript
import { createSessionSseHandler } from '../utils/enterpriseSseHandler';

const customSseHandler = createSessionSseHandler(shopDomain, {
  onMessage: (event) => {
    // Your custom event handling
    switch (event.type) {
      case 'custom_event':
        handleCustomEvent(event.data);
        break;
      case 'data_update':
        handleDataUpdate(event.data);
        break;
    }
  },
  
  onRateLimited: (until) => {
    // Custom rate limit handling
    showRateLimitWarning(until);
  },
  
  onPollingStart: () => {
    // Custom polling start handling
    updateUIForPollingMode();
  }
});

customSseHandler.connect();
```

### 2. Integration with Existing Session Management

The enterprise SSE handler integrates seamlessly with your existing session management:

```typescript
// In your session management component
import { useEnterpriseSse } from '../hooks/useEnterpriseSse';

const SessionManager: React.FC = () => {
  const { 
    sseHandler, 
    connectionState, 
    metrics,
    connect,
    disconnect,
    destroy 
  } = useEnterpriseSse({
    autoConnect: false, // Manual control
    enableNotifications: true
  });

  // Use with existing session logic
  useEffect(() => {
    if (sessionManager.isHeartbeatActive()) {
      connect(); // Start SSE when session is active
    }
  }, [connect]);

  return (
    <div>
      <div>Connection Status: {connectionState?.isConnected ? 'Connected' : 'Disconnected'}</div>
      <div>Messages Received: {metrics?.totalMessages || 0}</div>
      <div>Errors: {metrics?.totalErrors || 0}</div>
      <div>Rate Limits: {metrics?.totalRateLimits || 0}</div>
    </div>
  );
};
```

### 3. Admin Dashboard Integration

For admin pages that need SSE monitoring:

```typescript
// In AdminPage.tsx
import { useEnterpriseSse } from '../hooks/useEnterpriseSse';

const AdminPage: React.FC = () => {
  const { 
    connectionState, 
    metrics,
    resetMetrics 
  } = useEnterpriseSse({
    autoConnect: true,
    enableDebug: true,
    enableNotifications: false // Disable notifications for admin
  });

  return (
    <div>
      <h2>SSE Connection Status</h2>
      <div>
        <strong>Status:</strong> {connectionState?.isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div>
        <strong>Reconnecting:</strong> {connectionState?.isReconnecting ? 'Yes' : 'No'}
      </div>
      <div>
        <strong>Polling:</strong> {connectionState?.isPolling ? 'Yes' : 'No'}
      </div>
      <div>
        <strong>Rate Limited:</strong> {connectionState?.rateLimitedUntil ? 'Yes' : 'No'}
      </div>
      
      <h3>Metrics</h3>
      <div>Total Connections: {metrics?.totalConnections}</div>
      <div>Total Messages: {metrics?.totalMessages}</div>
      <div>Total Errors: {metrics?.totalErrors}</div>
      <div>Total Rate Limits: {metrics?.totalRateLimits}</div>
      <div>Uptime: {metrics?.uptimePercentage.toFixed(1)}%</div>
      
      <button onClick={resetMetrics}>Reset Metrics</button>
    </div>
  );
};
```

## Migration Checklist

### Phase 1: Basic Integration
- [ ] Replace `subscribeToSessionEvents` with `useEnterpriseSse` hook
- [ ] Update AuthContext to use the new hook
- [ ] Test basic connectivity and event handling
- [ ] Verify session invalidation still works

### Phase 2: Advanced Features
- [ ] Enable rate limiting and polling fallback
- [ ] Add connection status monitoring
- [ ] Implement metrics tracking
- [ ] Test error recovery scenarios

### Phase 3: Production Optimization
- [ ] Configure appropriate timeouts and retry limits
- [ ] Enable debug logging in development
- [ ] Test with network interruptions
- [ ] Monitor performance and memory usage

## Configuration Options

### Default Configuration
```typescript
const defaultConfig = {
  autoConnect: true,           // Auto-connect when authenticated
  enableNotifications: true,   // Show user notifications
  enableDebug: false,          // Enable debug logging
  pollingFallbackEnabled: true, // Enable polling when rate-limited
  pollingInterval: 5000,       // Poll every 5 seconds
  maxReconnectAttempts: 10,    // Max 10 reconnection attempts
  heartbeatInterval: 30000     // Heartbeat every 30 seconds
};
```

### Production Configuration
```typescript
const productionConfig = {
  autoConnect: true,
  enableNotifications: true,
  enableDebug: false,
  pollingFallbackEnabled: true,
  pollingInterval: 10000,      // Slower polling in production
  maxReconnectAttempts: 5,     // Fewer retries in production
  heartbeatInterval: 60000     // Slower heartbeat in production
};
```

### Development Configuration
```typescript
const developmentConfig = {
  autoConnect: true,
  enableNotifications: true,
  enableDebug: true,           // Enable debug in development
  pollingFallbackEnabled: true,
  pollingInterval: 2000,       // Faster polling for testing
  maxReconnectAttempts: 15,    // More retries for testing
  heartbeatInterval: 15000     // Faster heartbeat for testing
};
```

## Error Handling

The enterprise SSE handler provides comprehensive error handling:

### Automatic Error Recovery
- Network timeouts
- Connection failures
- Server errors
- Rate limiting
- Authentication failures

### User Notifications
- Connection status changes
- Error messages
- Rate limit warnings
- Reconnection progress

### Debug Information
- Detailed error logging
- Connection state tracking
- Performance metrics
- Event history

## Performance Considerations

### Memory Management
- Automatic cleanup on unmount
- Event queue size limits
- Proper event listener removal
- Garbage collection optimization

### Network Optimization
- Exponential backoff for reconnections
- Server-controlled reconnect delays
- Polling fallback for rate limits
- Connection health monitoring

### Resource Usage
- Configurable heartbeat intervals
- Efficient event processing
- Minimal DOM updates
- Optimized state management

## Testing

### Unit Tests
```typescript
import { renderHook } from '@testing-library/react';
import { useEnterpriseSse } from '../hooks/useEnterpriseSse';

test('should connect when authenticated', () => {
  const { result } = renderHook(() => useEnterpriseSse({
    autoConnect: true
  }));
  
  expect(result.current.isConnected).toBe(true);
});
```

### Integration Tests
```typescript
test('should handle rate limiting', async () => {
  // Mock rate limit response
  // Verify polling fallback starts
  // Verify automatic recovery
});
```

### E2E Tests
```typescript
test('should maintain connection during network interruptions', async () => {
  // Simulate network disconnection
  // Verify automatic reconnection
  // Verify no data loss
});
```

## Monitoring and Debugging

### Debug Mode
Enable debug mode for detailed logging:
```typescript
const { sseHandler } = useEnterpriseSse({
  enableDebug: true
});
```

### Metrics Tracking
Monitor connection health:
```typescript
const { metrics } = useEnterpriseSse();

console.log('SSE Metrics:', {
  uptime: metrics?.uptimePercentage,
  messages: metrics?.totalMessages,
  errors: metrics?.totalErrors,
  rateLimits: metrics?.totalRateLimits
});
```

### Connection State
Track connection status:
```typescript
const { connectionState } = useEnterpriseSse();

console.log('Connection State:', {
  isConnected: connectionState?.isConnected,
  isReconnecting: connectionState?.isReconnecting,
  isPolling: connectionState?.isPolling,
  reconnectAttempts: connectionState?.reconnectAttempts
});
```

## Troubleshooting

### Common Issues

1. **Connection not establishing**
   - Check authentication state
   - Verify SSE endpoint URL
   - Check network connectivity
   - Review server logs

2. **Frequent reconnections**
   - Check server stability
   - Review timeout settings
   - Monitor network quality
   - Check for rate limiting

3. **Memory leaks**
   - Ensure proper cleanup in useEffect
   - Check for circular references
   - Monitor event listener count
   - Review component lifecycle

4. **Rate limiting issues**
   - Verify polling fallback is enabled
   - Check polling interval settings
   - Monitor server rate limits
   - Review client request patterns

### Debug Commands
```typescript
// Get connection state
console.log(sseHandler?.getState());

// Get metrics
console.log(sseHandler?.getMetrics());

// Check if rate limited
console.log(sseHandler?.isRateLimited());

// Manual reconnection
sseHandler?.connect();
```

This enterprise SSE solution provides a robust, production-ready replacement for your current SSE implementation with comprehensive error handling, automatic recovery, and monitoring capabilities. 