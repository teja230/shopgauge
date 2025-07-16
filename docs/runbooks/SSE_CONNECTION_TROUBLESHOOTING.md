# SSE Connection Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting procedures for Server-Sent Events (SSE) connection issues in the ShopGauge application.

## Common Symptoms

- Real-time updates not appearing in the dashboard
- Connection timeouts or frequent reconnections
- High server resource usage due to SSE connections
- Users not receiving notifications or live data updates
- Browser console errors related to EventSource

## Quick Diagnostics

### 1. Check SSE Service Health

```bash
# Check SSE service status
curl -X GET "https://your-domain/admin/sse/health" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get SSE connection statistics
curl -X GET "https://your-domain/admin/sse/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. Verify Connection Limits

```bash
# Check current connection counts
curl -X GET "https://your-domain/admin/sse/connections" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check per-shop connection limits
curl -X GET "https://your-domain/admin/sse/connections/by-shop" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Detailed Troubleshooting

### Issue 1: SSE Connections Not Establishing

#### Symptoms
- EventSource fails to connect
- Browser shows connection errors
- No real-time updates received

#### Diagnostic Steps

1. **Check Browser Network Tab**
   - Look for failed SSE requests
   - Verify correct SSE endpoint URL
   - Check for CORS errors

2. **Verify Server-Side Connection**
   ```bash
   # Test SSE endpoint directly
   curl -N -H "Accept: text/event-stream" \
        -H "Authorization: Bearer USER_TOKEN" \
        "https://your-domain/api/sse/connect?shopDomain=SHOP_DOMAIN"
   ```

3. **Check Application Logs**
   ```bash
   # Search for SSE connection errors
   grep -i "sse.*error\|eventsource.*failed" /path/to/app.log
   
   # Check for authentication issues
   grep -i "sse.*auth\|unauthorized.*sse" /path/to/app.log
   ```

#### Resolution Steps

1. **Verify Authentication**
   ```bash
   # Check if user token is valid
   curl -X GET "https://your-domain/api/auth/validate" \
        -H "Authorization: Bearer USER_TOKEN"
   ```

2. **Check Connection Limits**
   ```bash
   # Verify shop hasn't exceeded connection limits
   curl -X GET "https://your-domain/admin/sse/connections/SHOP_DOMAIN" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Clear Dead Connections**
   ```bash
   # Force cleanup of dead connections
   curl -X POST "https://your-domain/admin/sse/cleanup-dead-connections" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

### Issue 2: High Connection Count / Resource Exhaustion

#### Symptoms
- Server running out of memory
- New connections being rejected
- Slow response times

#### Diagnostic Steps

1. **Check Connection Statistics**
   ```bash
   # Get detailed connection metrics
   curl -X GET "https://your-domain/admin/sse/metrics" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Identify Connection Patterns**
   ```bash
   # Check connections by shop
   curl -X GET "https://your-domain/admin/sse/connections/analysis" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Monitor Memory Usage**
   ```bash
   # Check JVM memory usage
   curl -X GET "https://your-domain/actuator/metrics/jvm.memory.used" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

#### Resolution Steps

1. **Emergency Connection Cleanup**
   ```bash
   # Close all idle connections
   curl -X POST "https://your-domain/admin/sse/cleanup-idle" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
        -d '{"idleTimeoutMinutes": 5}'
   ```

2. **Adjust Connection Limits**
   ```bash
   # Temporarily reduce connection limits
   curl -X PUT "https://your-domain/admin/sse/config/limits" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"maxConnectionsPerShop": 3, "maxTotalConnections": 30}'
   ```

3. **Force Garbage Collection**
   ```bash
   # Trigger JVM garbage collection
   curl -X POST "https://your-domain/admin/system/gc" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

### Issue 3: Events Not Being Delivered

#### Symptoms
- SSE connection established but no events received
- Partial event delivery
- Events delivered with significant delay

#### Diagnostic Steps

1. **Check Event Queue Status**
   ```bash
   # Check event batching statistics
   curl -X GET "https://your-domain/admin/sse/batching/stats" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Verify Event Generation**
   ```bash
   # Check if events are being generated
   curl -X GET "https://your-domain/admin/events/recent/SHOP_DOMAIN" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Test Event Broadcasting**
   ```bash
   # Send test event to specific shop
   curl -X POST "https://your-domain/admin/sse/test-event" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"shopDomain": "SHOP_DOMAIN", "eventType": "test", "data": {"message": "test"}}'
   ```

#### Resolution Steps

1. **Clear Event Queues**
   ```bash
   # Clear stuck event batches
   curl -X POST "https://your-domain/admin/sse/clear-queues" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Restart Event Processing**
   ```bash
   # Restart event batching service
   curl -X POST "https://your-domain/admin/sse/restart-batching" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Check Redis Connectivity**
   ```bash
   # Verify Redis pub/sub is working
   curl -X GET "https://your-domain/admin/redis/pubsub/health" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

### Issue 4: Memory Leaks in SSE Service

#### Symptoms
- Gradual memory increase over time
- OutOfMemoryError exceptions
- Slow garbage collection

#### Diagnostic Steps

1. **Memory Analysis**
   ```bash
   # Get heap dump for analysis
   curl -X POST "https://your-domain/admin/system/heap-dump" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   
   # Check memory usage trends
   curl -X GET "https://your-domain/admin/metrics/memory/trend" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Connection Leak Detection**
   ```bash
   # Check for connections without proper cleanup
   curl -X GET "https://your-domain/admin/sse/connections/orphaned" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

#### Resolution Steps

1. **Force Connection Cleanup**
   ```bash
   # Clean up all connections for memory recovery
   curl -X POST "https://your-domain/admin/sse/emergency-cleanup" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Restart SSE Service**
   ```bash
   # Restart just the SSE service component
   curl -X POST "https://your-domain/admin/sse/restart" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

## Browser-Side Troubleshooting

### Client-Side Diagnostics

1. **Check EventSource State**
   ```javascript
   // In browser console
   console.log('EventSource readyState:', eventSource.readyState);
   // 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
   ```

2. **Monitor Connection Events**
   ```javascript
   // Add event listeners for debugging
   eventSource.addEventListener('open', () => console.log('SSE Connected'));
   eventSource.addEventListener('error', (e) => console.error('SSE Error:', e));
   eventSource.addEventListener('message', (e) => console.log('SSE Message:', e.data));
   ```

3. **Check Network Connectivity**
   ```javascript
   // Test basic connectivity
   fetch('/api/health')
     .then(response => console.log('API accessible:', response.ok))
     .catch(error => console.error('API not accessible:', error));
   ```

### Client-Side Solutions

1. **Implement Reconnection Logic**
   ```javascript
   function createSSEConnection() {
     const eventSource = new EventSource('/api/sse/connect');
     
     eventSource.onerror = function(event) {
       console.log('SSE connection error, reconnecting in 5 seconds...');
       setTimeout(() => {
         eventSource.close();
         createSSEConnection();
       }, 5000);
     };
   }
   ```

2. **Handle Connection Limits**
   ```javascript
   // Close existing connections before creating new ones
   if (window.sseConnection) {
     window.sseConnection.close();
   }
   window.sseConnection = new EventSource('/api/sse/connect');
   ```

## Monitoring and Prevention

### Key Metrics to Monitor

1. **Connection Metrics**
   - Active connection count
   - Connection establishment rate
   - Connection failure rate
   - Average connection duration

2. **Event Metrics**
   - Event generation rate
   - Event delivery latency
   - Event queue size
   - Batch processing time

3. **Resource Metrics**
   - Memory usage by SSE service
   - CPU usage during event processing
   - Network bandwidth utilization

### Automated Monitoring Setup

```bash
# Enable SSE monitoring
curl -X POST "https://your-domain/admin/monitoring/sse/enable" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "connectionThreshold": 40,
       "memoryThreshold": "80%",
       "eventLatencyThreshold": 5000,
       "alertEmail": "ops@yourcompany.com"
     }'
```

### Preventive Measures

1. **Connection Limits**
   - Set appropriate per-shop limits (5 connections)
   - Set global connection limits (50 total)
   - Implement connection queuing for excess requests

2. **Resource Management**
   - Regular cleanup of dead connections
   - Memory monitoring and alerts
   - Automatic connection recycling

3. **Event Optimization**
   - Batch similar events together
   - Implement event deduplication
   - Use appropriate event priorities

## Performance Optimization

### Server-Side Optimizations

1. **Connection Pooling**
   ```bash
   # Optimize connection pool settings
   curl -X PUT "https://your-domain/admin/sse/config/pool" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "corePoolSize": 10,
          "maxPoolSize": 50,
          "keepAliveTime": 60,
          "queueCapacity": 100
        }'
   ```

2. **Event Batching Configuration**
   ```bash
   # Optimize batching parameters
   curl -X PUT "https://your-domain/admin/sse/config/batching" \
        -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "maxBatchSize": 10,
          "batchTimeoutMs": 1000,
          "maxQueueSize": 1000
        }'
   ```

### Client-Side Optimizations

1. **Connection Management**
   - Implement connection sharing across tabs
   - Use visibility API to pause connections when tab is hidden
   - Implement exponential backoff for reconnections

2. **Event Handling**
   - Debounce rapid event updates
   - Implement event filtering on client side
   - Use requestAnimationFrame for UI updates

## Emergency Procedures

### Complete SSE Service Restart

```bash
# 1. Gracefully close all connections
curl -X POST "https://your-domain/admin/sse/shutdown-graceful" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 2. Wait for connections to close (30 seconds)
sleep 30

# 3. Force cleanup any remaining connections
curl -X POST "https://your-domain/admin/sse/force-cleanup" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 4. Restart SSE service
curl -X POST "https://your-domain/admin/sse/restart" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 5. Verify service is healthy
curl -X GET "https://your-domain/admin/sse/health" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Fallback to Polling

If SSE is completely unavailable:

```bash
# Enable polling fallback mode
curl -X POST "https://your-domain/admin/config/fallback-mode" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"mode": "polling", "intervalMs": 5000}'
```

## Contact Information

- **On-Call Engineer**: [Contact details]
- **Frontend Team**: [Contact details]  
- **Backend Team**: [Contact details]
- **Infrastructure Team**: [Contact details]

## References

- [SSE Service Architecture](../SSE_SERVICE_ARCHITECTURE.md)
- [Event Batching Design](../EVENT_BATCHING_DESIGN.md)
- [Performance Monitoring](https://monitoring.your-domain/sse)
- [SSE Client Implementation](../frontend/SSE_CLIENT_GUIDE.md)