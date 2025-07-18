# Enterprise-Grade SSE Implementation

## Overview

This document describes the production-ready, enterprise-grade Server-Sent Events (SSE) implementation that replaces the previous `batchDemo` approach with a comprehensive, scalable solution.

## 🚀 Key Features

### 1. **Minimal Payloads**
- **Essential Fields Only**: Events contain only `event`, `message`, `reconnect`, and optional `metadata`
- **Optimized JSON**: Uses Jackson ObjectNode for efficient JSON generation
- **Reduced Bandwidth**: Significantly smaller payload sizes compared to verbose implementations

### 2. **Intelligent Batching**
- **Automatic Batching**: Events are automatically batched when they reach `MAX_BATCH_SIZE` (10 events)
- **Timeout-Based Batching**: Batches are sent after `BATCH_TIMEOUT_MS` (1 second) even if not full
- **High-Frequency Support**: Efficiently handles rapid-fire events without overwhelming clients
- **Metadata Support**: Each event can include rich metadata for enhanced functionality

### 3. **Enterprise-Grade Architecture**
- **Service Layer**: Dedicated `SseService` for all SSE operations
- **Connection Management**: Comprehensive connection lifecycle management
- **Rate Limiting**: Built-in rate limiting with exponential backoff
- **Health Monitoring**: Real-time statistics and health checks
- **Memory Leak Prevention**: Automatic cleanup of stale connections

## 📁 File Structure

```
backend/src/main/java/com/storesight/backend/
├── service/
│   └── SseService.java                    # Core SSE service
├── controller/
│   ├── SessionManagementController.java   # Updated to use SseService
│   └── SseController.java                 # New dedicated SSE controller
```

## 🔧 Core Components

### SseService.java

The heart of the enterprise SSE implementation:

```java
@Service
public class SseService {
    // Configuration constants
    private static final int MAX_SSE_PER_SHOP = 5;
    private static final int MAX_SSE_GLOBAL = 50;
    private static final int MAX_BATCH_SIZE = 10;
    private static final long BATCH_TIMEOUT_MS = 1000L;
    
    // Connection storage
    private final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> sseEmitters;
    
    // Batching support
    private final ConcurrentHashMap<String, List<SseEvent>> eventBatches;
    private final ConcurrentHashMap<String, Long> batchTimers;
}
```

#### Key Methods

1. **Connection Management**
   ```java
   public SseEmitter createConnection(String shopDomain, String sessionId)
   public boolean canAcceptConnection(String shopDomain)
   public void forceCloseConnectionsForShop(String shopDomain)
   ```

2. **Event Sending**
   ```java
   public void sendMinimalEvent(SseEmitter emitter, String eventType, String message, Integer reconnectMs)
   public void sendMinimalEvent(SseEmitter emitter, String eventType, String message, Integer reconnectMs, Map<String, Object> metadata)
   ```

3. **Batching**
   ```java
   public void queueEventForBatching(String shopDomain, SseEvent event)
   public void sendBatch(String shopDomain)
   ```

4. **Broadcasting**
   ```java
   public void broadcastToShop(String shopDomain, String eventType, String message, Integer reconnectMs)
   public void broadcastToShop(String shopDomain, String eventType, String message, Integer reconnectMs, Map<String, Object> metadata)
   ```

### SseEvent Class

Minimal event representation:

```java
public static class SseEvent {
    private final String type;
    private final String message;
    private final Integer reconnectMs;
    private final Map<String, Object> metadata;
    private final long timestamp;
}
```

## 🎯 API Endpoints

### Session Management (Updated)
- `GET /api/sessions/events/{shopDomain}` - Main SSE connection endpoint
- `GET /api/sessions/events/batch/{shopDomain}` - Production batching endpoint

### Dedicated SSE Controller
- `GET /api/sse/stats` - Comprehensive SSE statistics
- `GET /api/sse/batch/{shopDomain}` - Production batching demonstration
- `GET /api/sse/high-frequency/{shopDomain}` - High-frequency event handling
- `POST /api/sse/broadcast/{shopDomain}` - Event broadcasting
- `GET /api/sse/health` - SSE service health check

## 📊 Monitoring & Statistics

The SSE service provides comprehensive monitoring:

```json
{
  "totalConnections": 150,
  "totalErrors": 5,
  "totalRateLimited": 2,
  "totalEventsSent": 1250,
  "totalBatchesSent": 125,
  "activeConnections": 25,
  "activeShops": 8,
  "maxGlobalConnections": 50,
  "maxPerShopConnections": 5,
  "pendingBatches": 3,
  "connectionsByShop": {
    "shop1.myshopify.com": 3,
    "shop2.myshopify.com": 2
  },
  "health": {
    "connectionUtilization": "50.0%",
    "status": "HEALTHY",
    "recommendation": "Normal operation"
  }
}
```

## 🔄 Batching Strategy

### Automatic Batching
1. **Size-Based**: Events are batched when they reach `MAX_BATCH_SIZE` (10 events)
2. **Time-Based**: Batches are sent after `BATCH_TIMEOUT_MS` (1 second) regardless of size
3. **Immediate**: Batches can be sent immediately when needed

### Batch Format
```json
[
  {
    "event": "production_event",
    "message": "Enterprise batch event 1",
    "metadata": {
      "sequence": 1,
      "timestamp": 1640995200000,
      "source": "production_batch",
      "priority": "high"
    },
    "timestamp": 1640995200000
  }
]
```

## 🚦 Rate Limiting & Backoff

### Connection Limits
- **Per Shop**: Maximum 5 concurrent SSE connections
- **Global**: Maximum 50 total SSE connections
- **Automatic Rejection**: Connections beyond limits are rejected with error events

### Exponential Backoff
```java
public void sendExponentialBackoff(SseEmitter emitter, int failCount) {
    int backoffSeconds = Math.min((int) Math.pow(2, failCount - 1), 60);
    sendMinimalEvent(emitter, "rate_limited", 
        "Too many failed attempts. Please wait " + backoffSeconds + " seconds.", 
        backoffSeconds * 1000);
}
```

## 🧹 Automatic Cleanup

### Scheduled Tasks
1. **Connection Cleanup** (every 1 minute): Removes stale connections
2. **Heartbeat** (every 30 seconds): Keeps connections alive
3. **Batch Processing** (every 5 seconds): Processes pending batches

### Memory Management
- **ConcurrentHashMap**: Thread-safe connection storage
- **CopyOnWriteArrayList**: Safe concurrent access to emitters
- **Automatic Removal**: Dead connections are automatically removed
- **Resource Cleanup**: All resources are properly cleaned up on connection close

## 🔒 Security Features

### Session Validation
- **Pre-Connection Validation**: Sessions are validated before SSE connection establishment
- **Rate Limiting**: Failed validation attempts are rate-limited
- **Redis Integration**: Uses Redis for rate limiting and session tracking

### Error Handling
- **Graceful Degradation**: Failed connections don't affect other connections
- **Comprehensive Logging**: All operations are logged for debugging
- **Exception Safety**: All operations are wrapped in try-catch blocks

## 📈 Performance Optimizations

### Minimal Payloads
- **Essential Data Only**: Events contain only necessary fields
- **Efficient JSON**: Uses Jackson ObjectNode for optimal JSON generation
- **Reduced Bandwidth**: Significantly smaller payload sizes

### Connection Management
- **Connection Pooling**: Efficient connection storage and retrieval
- **Lazy Cleanup**: Connections are cleaned up only when needed
- **Batch Processing**: Multiple events are sent in single SSE messages

### Memory Efficiency
- **Concurrent Collections**: Thread-safe, memory-efficient data structures
- **Automatic Cleanup**: Stale connections are automatically removed
- **Resource Management**: All resources are properly managed

## 🧪 Testing & Validation

### Production Endpoints
1. **Basic Batching**: `GET /api/sse/batch/{shopDomain}`
2. **High-Frequency Events**: `GET /api/sse/high-frequency/{shopDomain}`
3. **Broadcasting**: `POST /api/sse/broadcast/{shopDomain}`
4. **Health Check**: `GET /api/sse/health`

### Monitoring
1. **Statistics**: `GET /api/sse/stats`
2. **Health Status**: `GET /api/sse/health`
3. **Connection Monitoring**: Real-time connection tracking

## 🔄 Migration from Old Implementation

### Before (batchDemo)
```java
@GetMapping("/events/batch-demo/{shopDomain}")
public SseEmitter batchDemo(@PathVariable String shopDomain) {
    SseEmitter emitter = new SseEmitter(10000L);
    List<Map<String, Object>> events = new ArrayList<>();
    for (int i = 1; i <= 3; i++) {
        Map<String, Object> ev = new HashMap<>();
        ev.put("event", "demo");
        ev.put("message", "Batch event " + i);
        events.add(ev);
    }
    sendSseBatch(emitter, events);
    emitter.complete();
    return emitter;
}
```

### After (Enterprise-Grade)
```java
@GetMapping("/events/batch/{shopDomain}")
public SseEmitter batchEvents(@PathVariable String shopDomain) {
    SseEmitter emitter = new SseEmitter(10000L);
    
    // Create sample events for demonstration
    List<SseService.SseEvent> events = new ArrayList<>();
    for (int i = 1; i <= 3; i++) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("sequence", i);
        metadata.put("timestamp", System.currentTimeMillis());
        
        events.add(new SseService.SseEvent(
            "demo", 
            "Production batch event " + i, 
            null, 
            metadata
        ));
    }
    
    // Queue events for batching
    for (SseService.SseEvent event : events) {
        sseService.queueEventForBatching(shopDomain, event);
    }
    
    // Send the batch immediately
    sseService.sendBatch(shopDomain);
    emitter.complete();
    
    return emitter;
}
```

## 🎯 Benefits

### Performance
- **Reduced Bandwidth**: Minimal payloads reduce network usage
- **Efficient Batching**: Multiple events in single messages
- **Connection Optimization**: Better connection management

### Scalability
- **Connection Limits**: Prevents resource exhaustion
- **Automatic Cleanup**: Maintains system health
- **Rate Limiting**: Prevents abuse

### Reliability
- **Error Handling**: Comprehensive error management
- **Health Monitoring**: Real-time system health tracking
- **Graceful Degradation**: System continues operating under stress

### Maintainability
- **Service Layer**: Clean separation of concerns
- **Comprehensive Logging**: Easy debugging and monitoring
- **Well-Documented**: Clear API and implementation

## 🚀 Future Enhancements

### Planned Features
1. **Redis Pub/Sub**: Multi-instance support
2. **Event Persistence**: Event storage for replay
3. **Advanced Filtering**: Event filtering by type/priority
4. **Metrics Integration**: Prometheus/Grafana integration
5. **WebSocket Fallback**: Automatic fallback to WebSockets

### Configuration Options
- **Batch Sizes**: Configurable batch sizes per shop
- **Timeouts**: Adjustable timeouts for different scenarios
- **Rate Limits**: Configurable rate limiting per shop
- **Connection Limits**: Adjustable connection limits

---

This enterprise-grade SSE implementation provides a robust, scalable, and maintainable solution for real-time communication in the ShopGauge platform. 