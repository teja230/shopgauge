# Admin Endpoints Reference

## Overview

This document provides comprehensive documentation for all administrative endpoints in the ShopGauge application. These endpoints are used for system monitoring, session management, cache operations, and emergency procedures.

## Authentication

All admin endpoints require authentication using a Bearer token:

```bash
curl -X GET "https://your-domain/admin/endpoint" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Admin tokens are generated through the admin authentication system and have elevated privileges.

## Session Management Endpoints

### Session Statistics

#### GET /admin/sessions/stats
Get comprehensive session statistics.

**Response:**
```json
{
  "totalActiveSessions": 45,
  "sessionsPerShop": {
    "shop1.myshopify.com": 3,
    "shop2.myshopify.com": 2
  },
  "stuckSessions": 1,
  "invalidatingSessions": 2,
  "averageSessionDuration": "2h 15m",
  "sessionCreationRate": "5/hour"
}
```

#### GET /admin/sessions/health
Check session service health status.

**Response:**
```json
{
  "status": "healthy",
  "redisConnected": true,
  "databaseConnected": true,
  "stuckSessionCount": 0,
  "lastCleanupTime": "2025-07-15T16:30:00Z"
}
```

### Session Operations

#### DELETE /admin/sessions/{sessionId}/force-cleanup
Force cleanup of a specific stuck session.

**Parameters:**
- `sessionId` (path): The session ID to cleanup

**Response:**
```json
{
  "success": true,
  "message": "Session cleaned up successfully",
  "sessionId": "session-123",
  "cleanupActions": ["redis_lock_removed", "database_updated", "cache_invalidated"]
}
```

#### POST /admin/sessions/cleanup-bulk
Perform bulk cleanup of stuck sessions.

**Request Body:**
```json
{
  "olderThanMinutes": 10,
  "dryRun": false,
  "maxSessions": 50
}
```

**Response:**
```json
{
  "cleanedSessions": 5,
  "skippedSessions": 2,
  "errors": [],
  "executionTimeMs": 1250
}
```

#### POST /admin/emergency/cleanup-stuck-sessions
Emergency cleanup of all stuck sessions.

**Response:**
```json
{
  "success": true,
  "cleanedSessions": 12,
  "message": "Emergency cleanup completed",
  "timestamp": "2025-07-15T16:30:00Z"
}
```

## SSE (Server-Sent Events) Endpoints

### SSE Health and Statistics

#### GET /admin/sse/health
Check SSE service health.

**Response:**
```json
{
  "status": "healthy",
  "activeConnections": 23,
  "connectionLimitsOk": true,
  "eventQueueSize": 45,
  "lastEventProcessed": "2025-07-15T16:29:55Z"
}
```

#### GET /admin/sse/stats
Get detailed SSE statistics.

**Response:**
```json
{
  "totalConnections": 23,
  "connectionsPerShop": {
    "shop1.myshopify.com": 3,
    "shop2.myshopify.com": 2
  },
  "eventMetrics": {
    "eventsPerSecond": 12.5,
    "averageBatchSize": 3.2,
    "eventQueueSize": 45
  },
  "performanceMetrics": {
    "averageEventLatency": 150,
    "connectionEstablishmentTime": 45
  }
}
```

#### GET /admin/sse/connections
List all active SSE connections.

**Response:**
```json
{
  "connections": [
    {
      "connectionId": "conn-123",
      "shopDomain": "shop1.myshopify.com",
      "sessionId": "session-456",
      "createdAt": "2025-07-15T15:30:00Z",
      "lastActivity": "2025-07-15T16:29:00Z",
      "status": "active"
    }
  ],
  "totalCount": 23
}
```

#### GET /admin/sse/connections/by-shop
Get connections grouped by shop.

**Response:**
```json
{
  "connectionsByShop": {
    "shop1.myshopify.com": {
      "count": 3,
      "connections": ["conn-123", "conn-124", "conn-125"]
    },
    "shop2.myshopify.com": {
      "count": 2,
      "connections": ["conn-126", "conn-127"]
    }
  }
}
```

### SSE Operations

#### POST /admin/sse/cleanup-dead-connections
Remove dead or inactive SSE connections.

**Response:**
```json
{
  "removedConnections": 5,
  "activeConnections": 18,
  "message": "Dead connections cleaned up successfully"
}
```

#### POST /admin/sse/cleanup-idle
Clean up idle connections based on timeout.

**Request Body:**
```json
{
  "idleTimeoutMinutes": 5
}
```

**Response:**
```json
{
  "removedConnections": 3,
  "remainingConnections": 20,
  "idleThreshold": "5 minutes"
}
```

#### POST /admin/sse/test-event
Send a test event to verify SSE functionality.

**Request Body:**
```json
{
  "shopDomain": "shop1.myshopify.com",
  "eventType": "test",
  "data": {
    "message": "Test event",
    "timestamp": "2025-07-15T16:30:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "eventSent": true,
  "recipientConnections": 3,
  "message": "Test event sent successfully"
}
```

#### PUT /admin/sse/config/limits
Update SSE connection limits.

**Request Body:**
```json
{
  "maxConnectionsPerShop": 5,
  "maxTotalConnections": 50,
  "connectionTimeoutMinutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "previousLimits": {
    "maxConnectionsPerShop": 5,
    "maxTotalConnections": 50
  },
  "newLimits": {
    "maxConnectionsPerShop": 3,
    "maxTotalConnections": 30
  }
}
```

## Cache Management Endpoints

### Cache Health and Statistics

#### GET /admin/cache/health
Check cache service health.

**Response:**
```json
{
  "status": "healthy",
  "redisConnected": true,
  "cacheHitRatio": 0.85,
  "totalEntries": 1250,
  "memoryUsageMB": 245
}
```

#### GET /admin/cache/stats
Get detailed cache statistics.

**Response:**
```json
{
  "hitRatio": 0.85,
  "missRatio": 0.15,
  "totalHits": 8500,
  "totalMisses": 1500,
  "totalEntries": 1250,
  "memoryUsage": {
    "totalMB": 245,
    "availableMB": 755,
    "usagePercentage": 24.5
  },
  "performanceMetrics": {
    "averageGetTime": 12,
    "averageSetTime": 8
  }
}
```

#### GET /admin/cache/metrics
Get cache performance metrics.

**Response:**
```json
{
  "operationsPerSecond": {
    "gets": 125.5,
    "sets": 45.2,
    "deletes": 5.1
  },
  "responseTimePercentiles": {
    "p50": 10,
    "p95": 25,
    "p99": 45
  },
  "errorRates": {
    "getErrors": 0.001,
    "setErrors": 0.002,
    "connectionErrors": 0.0005
  }
}
```

### Cache Operations

#### DELETE /admin/cache/shop/{shopDomain}
Invalidate all cache entries for a specific shop.

**Parameters:**
- `shopDomain` (path): The shop domain to invalidate

**Response:**
```json
{
  "success": true,
  "invalidatedEntries": 25,
  "shopDomain": "shop1.myshopify.com",
  "message": "Shop cache invalidated successfully"
}
```

#### DELETE /admin/cache/key/{cacheKey}
Invalidate a specific cache key.

**Parameters:**
- `cacheKey` (path): The cache key to invalidate

**Response:**
```json
{
  "success": true,
  "keyInvalidated": "dashboard:shop1.myshopify.com:analytics",
  "message": "Cache key invalidated successfully"
}
```

#### DELETE /admin/cache/pattern/{pattern}
Invalidate cache entries matching a pattern.

**Parameters:**
- `pattern` (path): The pattern to match (e.g., "dashboard:*")

**Response:**
```json
{
  "success": true,
  "invalidatedEntries": 45,
  "pattern": "dashboard:*",
  "message": "Pattern-based cache invalidation completed"
}
```

#### POST /admin/cache/warm/{shopDomain}
Pre-populate cache for a specific shop.

**Parameters:**
- `shopDomain` (path): The shop domain to warm

**Request Body:**
```json
{
  "cacheTypes": ["dashboard", "analytics", "competitors"],
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "warmedEntries": 15,
  "shopDomain": "shop1.myshopify.com",
  "cacheTypes": ["dashboard", "analytics", "competitors"],
  "executionTimeMs": 2500
}
```

#### POST /admin/cache/cleanup/expired
Clean up expired cache entries.

**Response:**
```json
{
  "success": true,
  "removedEntries": 125,
  "freedMemoryMB": 45,
  "executionTimeMs": 1200
}
```

## Database and Connection Pool Endpoints

### Connection Pool Management

#### GET /admin/connection-pool/stats
Get database connection pool statistics.

**Response:**
```json
{
  "activeConnections": 8,
  "idleConnections": 12,
  "totalConnections": 20,
  "maxConnections": 50,
  "connectionUtilization": 0.4,
  "averageConnectionTime": 150,
  "connectionLeaks": 0
}
```

#### GET /admin/connection-pool/health
Check connection pool health.

**Response:**
```json
{
  "status": "healthy",
  "poolUtilization": 0.4,
  "connectionLeaks": false,
  "databaseReachable": true,
  "lastHealthCheck": "2025-07-15T16:30:00Z"
}
```

#### POST /admin/connection-pool/reset
Reset the database connection pool.

**Response:**
```json
{
  "success": true,
  "message": "Connection pool reset successfully",
  "newPoolSize": 20,
  "resetTime": "2025-07-15T16:30:00Z"
}
```

### Query Optimization

#### GET /admin/database/slow-queries
Get information about slow database queries.

**Response:**
```json
{
  "slowQueries": [
    {
      "query": "SELECT * FROM shops WHERE...",
      "averageExecutionTime": 2500,
      "executionCount": 45,
      "lastExecuted": "2025-07-15T16:25:00Z"
    }
  ],
  "totalSlowQueries": 3,
  "thresholdMs": 1000
}
```

#### POST /admin/database/optimize-queries
Trigger query optimization analysis.

**Response:**
```json
{
  "success": true,
  "analyzedQueries": 25,
  "optimizationSuggestions": 5,
  "message": "Query optimization analysis completed"
}
```

## System Health and Monitoring Endpoints

### Overall System Health

#### GET /admin/health/comprehensive
Get comprehensive system health status.

**Response:**
```json
{
  "overallStatus": "healthy",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "sessions": "healthy",
    "sse": "healthy",
    "cache": "healthy"
  },
  "metrics": {
    "memoryUsage": 0.65,
    "cpuUsage": 0.45,
    "diskUsage": 0.30
  },
  "lastChecked": "2025-07-15T16:30:00Z"
}
```

#### GET /admin/metrics/system
Get system performance metrics.

**Response:**
```json
{
  "jvm": {
    "heapUsed": 512,
    "heapMax": 1024,
    "nonHeapUsed": 128,
    "gcCollections": 45,
    "gcTime": 1250
  },
  "system": {
    "cpuUsage": 0.45,
    "loadAverage": 1.2,
    "availableProcessors": 4
  },
  "application": {
    "uptime": "5d 12h 30m",
    "requestsPerSecond": 25.5,
    "errorRate": 0.002
  }
}
```

### Emergency Operations

#### POST /admin/system/gc
Trigger garbage collection.

**Response:**
```json
{
  "success": true,
  "gcTriggered": true,
  "memoryBefore": 512,
  "memoryAfter": 384,
  "freedMemoryMB": 128,
  "gcTimeMs": 250
}
```

#### POST /admin/system/heap-dump
Generate heap dump for memory analysis.

**Response:**
```json
{
  "success": true,
  "heapDumpPath": "/tmp/heapdump-20250715-1630.hprof",
  "heapDumpSize": "245MB",
  "generationTime": "2025-07-15T16:30:00Z"
}
```

## Security and Audit Endpoints

### Audit Logging

#### GET /admin/audit/logs
Get audit log entries.

**Query Parameters:**
- `startDate` (optional): Start date for log entries
- `endDate` (optional): End date for log entries
- `action` (optional): Filter by action type
- `limit` (optional): Maximum number of entries (default: 100)

**Response:**
```json
{
  "auditLogs": [
    {
      "id": 123,
      "timestamp": "2025-07-15T16:30:00Z",
      "action": "SESSION_CLEANUP",
      "adminUser": "admin@company.com",
      "details": "Cleaned up 5 stuck sessions",
      "ipAddress": "192.168.1.100"
    }
  ],
  "totalCount": 1250,
  "page": 1,
  "pageSize": 100
}
```

#### POST /admin/audit/log
Create a manual audit log entry.

**Request Body:**
```json
{
  "action": "MANUAL_INTERVENTION",
  "details": "Manual cache cleanup performed",
  "severity": "INFO"
}
```

**Response:**
```json
{
  "success": true,
  "auditLogId": 124,
  "message": "Audit log entry created successfully"
}
```

### Security Operations

#### GET /admin/security/sessions/suspicious
Get suspicious session activity.

**Response:**
```json
{
  "suspiciousSessions": [
    {
      "sessionId": "session-123",
      "shopDomain": "shop1.myshopify.com",
      "suspiciousActivity": "Multiple IP addresses",
      "riskLevel": "medium",
      "lastActivity": "2025-07-15T16:25:00Z"
    }
  ],
  "totalCount": 2
}
```

#### POST /admin/security/sessions/{sessionId}/terminate
Terminate a suspicious session.

**Parameters:**
- `sessionId` (path): The session ID to terminate

**Response:**
```json
{
  "success": true,
  "sessionId": "session-123",
  "terminationReason": "Security violation",
  "message": "Session terminated successfully"
}
```

## Configuration Management Endpoints

### Application Configuration

#### GET /admin/config/current
Get current application configuration.

**Response:**
```json
{
  "session": {
    "timeoutMinutes": 30,
    "maxConcurrentSessions": 5,
    "cleanupIntervalMinutes": 5
  },
  "sse": {
    "maxConnectionsPerShop": 5,
    "maxTotalConnections": 50,
    "batchTimeoutMs": 1000
  },
  "cache": {
    "defaultTtlMinutes": 15,
    "maxEntrySizeMB": 10,
    "maxTotalSizeMB": 500
  }
}
```

#### PUT /admin/config/update
Update application configuration.

**Request Body:**
```json
{
  "session": {
    "timeoutMinutes": 45,
    "cleanupIntervalMinutes": 3
  },
  "cache": {
    "defaultTtlMinutes": 20
  }
}
```

**Response:**
```json
{
  "success": true,
  "updatedSettings": ["session.timeoutMinutes", "session.cleanupIntervalMinutes", "cache.defaultTtlMinutes"],
  "message": "Configuration updated successfully",
  "restartRequired": false
}
```

### Feature Flags

#### GET /admin/features/flags
Get current feature flag status.

**Response:**
```json
{
  "featureFlags": {
    "enhancedSessionManagement": true,
    "advancedCaching": true,
    "sseOptimizations": true,
    "experimentalFeatures": false
  }
}
```

#### PUT /admin/features/flags/{flagName}
Update a specific feature flag.

**Parameters:**
- `flagName` (path): The feature flag name

**Request Body:**
```json
{
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "flagName": "experimentalFeatures",
  "previousValue": false,
  "newValue": true,
  "message": "Feature flag updated successfully"
}
```

## Error Responses

All admin endpoints use standardized error responses:

```json
{
  "error": {
    "code": "ADMIN_OPERATION_FAILED",
    "message": "The requested admin operation could not be completed",
    "details": "Specific error details here",
    "timestamp": "2025-07-15T16:30:00Z",
    "requestId": "req-123456",
    "retryable": false
  }
}
```

### Common Error Codes

- `ADMIN_AUTH_REQUIRED`: Admin authentication required
- `ADMIN_INSUFFICIENT_PRIVILEGES`: Insufficient admin privileges
- `ADMIN_OPERATION_FAILED`: General admin operation failure
- `ADMIN_RESOURCE_NOT_FOUND`: Requested resource not found
- `ADMIN_INVALID_REQUEST`: Invalid request parameters
- `ADMIN_SERVICE_UNAVAILABLE`: Required service unavailable

## Rate Limiting

Admin endpoints are subject to rate limiting:

- **General endpoints**: 100 requests per minute
- **Emergency endpoints**: 10 requests per minute
- **Bulk operations**: 5 requests per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642262400
```

## Security Considerations

1. **Authentication**: All endpoints require valid admin tokens
2. **Authorization**: Role-based access control for sensitive operations
3. **Audit Logging**: All admin operations are logged
4. **IP Restrictions**: Admin access can be restricted by IP address
5. **Rate Limiting**: Prevents abuse of admin endpoints

## Usage Examples

### Emergency Session Cleanup
```bash
# Check for stuck sessions
curl -X GET "https://your-domain/admin/sessions/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Clean up stuck sessions
curl -X POST "https://your-domain/admin/emergency/cleanup-stuck-sessions" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Verify cleanup
curl -X GET "https://your-domain/admin/sessions/health" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Cache Performance Optimization
```bash
# Check cache performance
curl -X GET "https://your-domain/admin/cache/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Clean expired entries
curl -X POST "https://your-domain/admin/cache/cleanup/expired" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Warm important caches
curl -X POST "https://your-domain/admin/cache/warm/shop1.myshopify.com" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cacheTypes": ["dashboard", "analytics"]}'
```

### SSE Connection Management
```bash
# Check SSE health
curl -X GET "https://your-domain/admin/sse/health" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Clean dead connections
curl -X POST "https://your-domain/admin/sse/cleanup-dead-connections" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Send test event
curl -X POST "https://your-domain/admin/sse/test-event" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shopDomain": "shop1.myshopify.com", "eventType": "test", "data": {"message": "test"}}'
```