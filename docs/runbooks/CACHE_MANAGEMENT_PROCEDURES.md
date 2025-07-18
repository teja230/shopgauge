# Cache Management and Cleanup Procedures

## Overview

This runbook provides comprehensive procedures for managing the dashboard cache system, including Redis cache operations, session-aware caching, and cleanup procedures.

## Cache Architecture Overview

The ShopGauge application uses a multi-level caching strategy:

1. **Redis Distributed Cache**: Primary cache for shared data
2. **Session-Aware Cache**: Tracks active sessions per shop
3. **Fallback Cache**: In-memory cache when Redis is unavailable
4. **Database Cache**: Query result caching

## Common Cache Issues

### Symptoms of Cache Problems
- Slow dashboard loading times
- Stale data being displayed
- High memory usage
- Redis connection errors
- Cache hit ratio below 70%

## Quick Health Checks

### 1. Cache Service Health

```bash
# Check overall cache health
curl -X GET "https://your-domain/admin/cache/health" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get cache statistics
curl -X GET "https://your-domain/admin/cache/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. Redis Health Check

```bash
# Check Redis connectivity
curl -X GET "https://your-domain/admin/redis/health" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Redis direct connection test
redis-cli ping
```

### 3. Cache Performance Metrics

```bash
# Get cache hit/miss ratios
curl -X GET "https://your-domain/admin/cache/metrics" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get memory usage statistics
curl -X GET "https://your-domain/admin/cache/memory" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Cache Management Procedures

### 1. Cache Invalidation

#### Invalidate Specific Shop Cache
```bash
# Invalidate all cache for a specific shop
curl -X DELETE "https://your-domain/admin/cache/shop/SHOP_DOMAIN" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Invalidate specific cache key
curl -X DELETE "https://your-domain/admin/cache/key/CACHE_KEY" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Invalidate Cache by Pattern
```bash
# Invalidate dashboard cache for all shops
curl -X DELETE "https://your-domain/admin/cache/pattern/dashboard:*" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Invalidate analytics cache
curl -X DELETE "https://your-domain/admin/cache/pattern/analytics:*" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Session-Based Cache Invalidation
```bash
# Check active sessions for a shop
curl -X GET "https://your-domain/admin/cache/sessions/SHOP_DOMAIN" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Force invalidate cache when session ends
curl -X POST "https://your-domain/admin/cache/invalidate-on-session-end" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shopDomain": "SHOP_DOMAIN", "sessionId": "SESSION_ID"}'
```

### 2. Cache Warming

#### Warm Cache for Specific Shop
```bash
# Pre-populate cache for a shop
curl -X POST "https://your-domain/admin/cache/warm/SHOP_DOMAIN" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cacheTypes": ["dashboard", "analytics", "competitors"]}'
```

#### Bulk Cache Warming
```bash
# Warm cache for all active shops
curl -X POST "https://your-domain/admin/cache/warm/bulk" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"activeOnly": true, "maxConcurrent": 5}'
```

### 3. Cache Cleanup Procedures

#### Automatic Cleanup
```bash
# Trigger automatic cleanup of expired entries
curl -X POST "https://your-domain/admin/cache/cleanup/expired" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Cleanup orphaned cache entries (no active sessions)
curl -X POST "https://your-domain/admin/cache/cleanup/orphaned" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Manual Cleanup
```bash
# Clean cache entries older than specified time
curl -X POST "https://your-domain/admin/cache/cleanup/age" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"olderThanHours": 24, "dryRun": false}'

# Clean cache by size (remove largest entries first)
curl -X POST "https://your-domain/admin/cache/cleanup/size" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetSizeReductionMB": 100, "dryRun": false}'
```

## Redis-Specific Procedures

### 1. Redis Memory Management

#### Check Redis Memory Usage
```bash
# Connect to Redis and check memory
redis-cli info memory

# Get memory usage by key pattern
redis-cli --eval memory_usage.lua 0 "cache:*"
```

#### Redis Memory Cleanup
```bash
# Remove expired keys
redis-cli EVAL "
local keys = redis.call('KEYS', 'cache:*')
local expired = 0
for i=1,#keys do
  local ttl = redis.call('TTL', keys[i])
  if ttl == -2 then
    redis.call('DEL', keys[i])
    expired = expired + 1
  end
end
return expired
" 0

# Set memory policy for automatic eviction
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### 2. Redis Connection Issues

#### Diagnose Connection Problems
```bash
# Check Redis connection pool
curl -X GET "https://your-domain/admin/redis/pool/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Test Redis connectivity
redis-cli ping
redis-cli info clients
```

#### Fix Connection Issues
```bash
# Reset Redis connection pool
curl -X POST "https://your-domain/admin/redis/pool/reset" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Restart Redis connections
curl -X POST "https://your-domain/admin/redis/reconnect" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Troubleshooting Common Issues

### Issue 1: High Cache Miss Rate

#### Symptoms
- Cache hit ratio below 70%
- Slow dashboard loading
- High database load

#### Diagnostic Steps
```bash
# Analyze cache patterns
curl -X GET "https://your-domain/admin/cache/analysis/patterns" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check cache TTL settings
curl -X GET "https://your-domain/admin/cache/config/ttl" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Resolution
```bash
# Adjust cache TTL settings
curl -X PUT "https://your-domain/admin/cache/config/ttl" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard": 300,
    "analytics": 600,
    "competitors": 1800
  }'

# Implement cache warming strategy
curl -X POST "https://your-domain/admin/cache/strategy/warming" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "scheduleMinutes": 30}'
```

### Issue 2: Memory Exhaustion

#### Symptoms
- OutOfMemoryError exceptions
- Redis memory warnings
- Slow cache operations

#### Diagnostic Steps
```bash
# Check memory usage breakdown
curl -X GET "https://your-domain/admin/cache/memory/breakdown" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Identify largest cache entries
curl -X GET "https://your-domain/admin/cache/entries/largest" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Resolution
```bash
# Emergency memory cleanup
curl -X POST "https://your-domain/admin/cache/emergency/cleanup" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Implement size limits
curl -X PUT "https://your-domain/admin/cache/config/limits" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxEntrySizeMB": 10,
    "maxTotalSizeMB": 500,
    "evictionPolicy": "LRU"
  }'
```

### Issue 3: Stale Data

#### Symptoms
- Users seeing outdated information
- Cache not invalidating properly
- Inconsistent data across sessions

#### Diagnostic Steps
```bash
# Check cache invalidation logs
curl -X GET "https://your-domain/admin/cache/logs/invalidation" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Verify session tracking
curl -X GET "https://your-domain/admin/cache/sessions/tracking" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Resolution
```bash
# Force cache refresh for affected shops
curl -X POST "https://your-domain/admin/cache/refresh/force" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shopDomains": ["shop1.com", "shop2.com"]}'

# Reset session tracking
curl -X POST "https://your-domain/admin/cache/sessions/reset" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Cache Performance**
   - Hit ratio (target: >80%)
   - Miss ratio (target: <20%)
   - Average response time (target: <50ms)

2. **Memory Usage**
   - Redis memory usage (alert: >80%)
   - JVM heap usage (alert: >75%)
   - Cache entry count (alert: >10,000)

3. **Error Rates**
   - Cache operation failures (alert: >1%)
   - Redis connection errors (alert: >0.1%)
   - Timeout errors (alert: >0.5%)

### Monitoring Setup

```bash
# Enable cache monitoring
curl -X POST "https://your-domain/admin/monitoring/cache/enable" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hitRatioThreshold": 0.8,
    "memoryThreshold": 0.8,
    "errorRateThreshold": 0.01,
    "alertEmail": "ops@yourcompany.com"
  }'
```

### Custom Alerts

```bash
# Set up custom cache alerts
curl -X POST "https://your-domain/admin/alerts/cache/custom" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cache Memory High",
    "condition": "cache.memory.usage > 0.85",
    "severity": "warning",
    "cooldownMinutes": 15
  }'
```

## Performance Optimization

### 1. Cache Configuration Tuning

```bash
# Optimize cache settings based on usage patterns
curl -X PUT "https://your-domain/admin/cache/config/optimize" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "analysisWindowHours": 24,
    "autoTune": true,
    "preserveCustomSettings": true
  }'
```

### 2. Redis Configuration

```bash
# Optimize Redis settings
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET timeout 300
redis-cli CONFIG SET tcp-keepalive 60
```

### 3. Connection Pool Optimization

```bash
# Tune connection pool settings
curl -X PUT "https://your-domain/admin/redis/pool/config" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxTotal": 20,
    "maxIdle": 10,
    "minIdle": 5,
    "testOnBorrow": true,
    "testWhileIdle": true
  }'
```

## Backup and Recovery

### 1. Cache Backup

```bash
# Create cache snapshot
curl -X POST "https://your-domain/admin/cache/backup/create" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"includeExpired": false, "compress": true}'

# List available backups
curl -X GET "https://your-domain/admin/cache/backup/list" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. Cache Recovery

```bash
# Restore from backup
curl -X POST "https://your-domain/admin/cache/backup/restore" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"backupId": "backup-20250715-1630", "clearExisting": true}'
```

## Emergency Procedures

### Complete Cache Reset

```bash
# 1. Stop cache operations
curl -X POST "https://your-domain/admin/cache/maintenance/start" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 2. Create backup (optional)
curl -X POST "https://your-domain/admin/cache/backup/emergency" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 3. Clear all cache
curl -X DELETE "https://your-domain/admin/cache/all" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 4. Reset Redis
redis-cli FLUSHDB

# 5. Restart cache service
curl -X POST "https://your-domain/admin/cache/restart" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 6. Resume operations
curl -X POST "https://your-domain/admin/cache/maintenance/end" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 7. Warm critical caches
curl -X POST "https://your-domain/admin/cache/warm/critical" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Fallback to Database

```bash
# Enable database fallback mode
curl -X POST "https://your-domain/admin/cache/fallback/enable" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "database", "duration": "1h"}'
```

## Maintenance Procedures

### Regular Maintenance Tasks

1. **Daily Tasks**
   ```bash
   # Clean expired entries
   curl -X POST "https://your-domain/admin/cache/maintenance/daily" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Weekly Tasks**
   ```bash
   # Optimize cache configuration
   curl -X POST "https://your-domain/admin/cache/maintenance/weekly" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Monthly Tasks**
   ```bash
   # Full cache analysis and optimization
   curl -X POST "https://your-domain/admin/cache/maintenance/monthly" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

### Scheduled Maintenance

```bash
# Schedule automatic maintenance
curl -X POST "https://your-domain/admin/cache/schedule/maintenance" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "daily": {"time": "02:00", "enabled": true},
    "weekly": {"day": "sunday", "time": "03:00", "enabled": true},
    "monthly": {"day": 1, "time": "04:00", "enabled": true}
  }'
```

## Contact Information

- **On-Call Engineer**: [Contact details]
- **Database Team**: [Contact details]
- **Infrastructure Team**: [Contact details]
- **Development Team**: [Contact details]

## References

- [Cache Architecture Design](../CACHE_ARCHITECTURE.md)
- [Redis Operations Guide](../REDIS_OPERATIONS.md)
- [Performance Monitoring](https://monitoring.your-domain/cache)
- [Cache Configuration Reference](../CACHE_CONFIGURATION.md)