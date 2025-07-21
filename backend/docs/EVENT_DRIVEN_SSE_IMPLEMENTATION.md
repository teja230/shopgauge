# Event-Driven SSE Implementation

## Overview

This document describes the implementation of Event-Driven Server-Sent Events (SSE) configuration for the Storesight backend. The implementation focuses on resource efficiency by removing heartbeat mechanisms and optimizing connection management.

## Configuration Changes

### Main Application Properties

The following SSE configuration changes have been implemented in `application.properties`:

```properties
# SSE Configuration - EVENT-DRIVEN IMPLEMENTATION
storesight.sse.max-connections-per-shop=${SSE_MAX_CONNECTIONS_PER_SHOP:3}
storesight.sse.max-connections-global=${SSE_MAX_CONNECTIONS_GLOBAL:30}
storesight.sse.connection-timeout=${SSE_CONNECTION_TIMEOUT:PT10M}
storesight.sse.heartbeat-interval=${SSE_HEARTBEAT_INTERVAL:PT0S}
storesight.sse.cleanup-interval=${SSE_CLEANUP_INTERVAL:PT10M}
```

### Key Changes

1. **Heartbeat Disabled**: `storesight.sse.heartbeat-interval=PT0S`
   - Removes periodic heartbeat messages to reduce network overhead
   - Eliminates unnecessary CPU usage from heartbeat processing

2. **Increased Connection Timeout**: `storesight.sse.connection-timeout=PT10M`
   - Extends connection timeout from 5 minutes to 10 minutes
   - Provides more stable connections for event-driven scenarios

3. **Increased Cleanup Interval**: `storesight.sse.cleanup-interval=PT10M`
   - Extends cleanup interval from 15 minutes to 10 minutes
   - Balances resource cleanup with reduced overhead

### Test Configuration

Test environments use more conservative values appropriate for testing:

```properties
# SSE Configuration for tests - EVENT-DRIVEN
storesight.sse.max-connections-per-shop=5
storesight.sse.max-connections-global=50
storesight.sse.connection-timeout=PT5M
storesight.sse.heartbeat-interval=PT0S
storesight.sse.cleanup-interval=PT5M
```

## Implementation Details

### Scheduling Configuration

The `SchedulingConfiguration` class has been updated to handle disabled heartbeats:

```java
public long getHeartbeatIntervalMs() {
  long interval = config.getSse().getHeartbeatInterval().toMillis();
  // If heartbeat is disabled (PT0S), return a very large value to effectively disable scheduling
  return interval == 0 ? Long.MAX_VALUE : interval;
}
```

### SSE Service Updates

The `SseService` has been modified to skip heartbeat processing when disabled:

```java
@Scheduled(fixedRateString = "#{@schedulingConfiguration.getHeartbeatIntervalMs()}")
public void sendHeartbeats() {
  // Skip heartbeat if it's disabled (PT0S)
  if (!isHeartbeatEnabled()) {
    return;
  }
  // ... rest of heartbeat logic
}

private boolean isHeartbeatEnabled() {
  return getHeartbeatIntervalMs() > 0;
}
```

### Configuration Validation

The `ConfigurationValidator` has been updated to handle disabled heartbeats:

```java
// Validate cleanup intervals
if (sse.getHeartbeatInterval().toMillis() > 0 && sse.getCleanupInterval().compareTo(sse.getHeartbeatInterval()) < 0) {
  warnings.add("SSE cleanup interval should be longer than heartbeat interval");
}
```

## Expected Benefits

### Resource Efficiency

- **CPU Usage**: Reduced CPU overhead from heartbeat processing
- **Network Traffic**: Eliminated periodic heartbeat messages
- **Memory Usage**: Reduced memory pressure from heartbeat tracking

### Connection Stability

- **Longer Timeouts**: More stable connections with extended timeouts
- **Reduced Interruptions**: Fewer connection drops from timeout issues
- **Better Performance**: Improved throughput for event-driven scenarios

### Operational Benefits

- **Simplified Monitoring**: Fewer heartbeat-related metrics to track
- **Reduced Log Noise**: Fewer heartbeat-related log entries
- **Cost Optimization**: Lower resource usage translates to reduced infrastructure costs

## Testing

A comprehensive test suite has been implemented to verify the Event-Driven SSE configuration:

- `EventDrivenSseConfigurationTest`: Validates configuration handling
- Integration tests updated with Event-Driven settings
- Configuration validation tests updated

## Migration Notes

### From Previous Configuration

The Event-Driven SSE implementation is backward compatible. Existing connections will continue to work, but will benefit from:

- No more heartbeat interruptions
- Longer connection timeouts
- More efficient resource usage

### Environment Variables

The following environment variables can be used to override the Event-Driven configuration:

```bash
# Event-Driven SSE Configuration
SSE_HEARTBEAT_INTERVAL=PT0S
SSE_CONNECTION_TIMEOUT=PT10M
SSE_CLEANUP_INTERVAL=PT10M
```

### Monitoring Considerations

With heartbeats disabled, monitoring should focus on:

- Connection health through other mechanisms (timeout-based cleanup)
- Event delivery success rates
- Connection pool utilization
- Error rates and connection failures

## Future Enhancements

Potential future improvements for the Event-Driven SSE implementation:

1. **Adaptive Timeouts**: Dynamic timeout adjustment based on connection patterns
2. **Event-Driven Cleanup**: Cleanup triggered by events rather than fixed intervals
3. **Connection Pooling**: Enhanced connection pooling for better resource utilization
4. **Metrics Enhancement**: Improved metrics for event-driven scenarios

## Conclusion

The Event-Driven SSE implementation provides significant resource efficiency improvements while maintaining connection stability and reliability. The removal of heartbeat mechanisms reduces overhead while the extended timeouts provide better connection stability for event-driven use cases. 