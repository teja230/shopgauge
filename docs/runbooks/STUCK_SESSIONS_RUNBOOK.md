# Stuck Sessions Operational Runbook

## Overview

This runbook provides step-by-step procedures for identifying, diagnosing, and resolving stuck session issues in the ShopGauge application.

## Symptoms

- Users unable to log in or access their dashboard
- Session invalidation loops preventing proper logout
- High memory usage due to accumulated session data
- Redis locks that don't expire properly
- Authentication errors despite valid credentials

## Immediate Response (Emergency)

### 1. Emergency Session Cleanup

If the system is experiencing widespread session issues:

```bash
# Access the emergency admin endpoint
curl -X POST "https://your-domain/admin/emergency/cleanup-stuck-sessions" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Check System Health

```bash
# Check application health
curl -X GET "https://your-domain/health"

# Check session service health
curl -X GET "https://your-domain/admin/health/sessions" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Diagnostic Procedures

### 1. Identify Stuck Sessions

#### Check Session Metrics
```bash
# Get session statistics
curl -X GET "https://your-domain/admin/sessions/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Check Redis for Stuck Locks
```bash
# Connect to Redis
redis-cli

# List all session locks
KEYS "session:lock:*"

# Check lock expiration times
TTL "session:lock:SESSION_ID"

# List stuck session markers
KEYS "session:invalidating:*"
```

#### Check Database for Session State
```sql
-- Check for sessions in invalidating state
SELECT session_id, shop_domain, status, last_activity, invalidation_started
FROM shop_sessions 
WHERE status = 'INVALIDATING' 
  AND invalidation_started < NOW() - INTERVAL '5 minutes';

-- Check for orphaned sessions
SELECT s.session_id, s.shop_domain, s.last_activity
FROM shop_sessions s
LEFT JOIN shops sh ON s.shop_domain = sh.shop_domain
WHERE sh.shop_domain IS NULL;
```

### 2. Analyze Session Logs

#### Check Application Logs
```bash
# Search for session-related errors
grep -i "session.*error\|invalidation.*failed\|stuck.*session" /path/to/app.log

# Check for specific session ID issues
grep "SESSION_ID" /path/to/app.log | tail -50
```

#### Check Redis Logs
```bash
# Check Redis logs for connection issues
tail -f /var/log/redis/redis-server.log | grep -i error
```

## Resolution Procedures

### 1. Clear Specific Stuck Session

#### For Individual Session
```bash
# Clear stuck session via admin endpoint
curl -X DELETE "https://your-domain/admin/sessions/SESSION_ID/force-cleanup" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Manual Redis Cleanup
```bash
# Connect to Redis
redis-cli

# Remove session lock
DEL "session:lock:SESSION_ID"

# Remove invalidation marker
DEL "session:invalidating:SESSION_ID"

# Remove session data
DEL "session:data:SESSION_ID"
```

#### Database Cleanup
```sql
-- Update session status to invalid
UPDATE shop_sessions 
SET status = 'INVALID', 
    invalidation_completed = NOW()
WHERE session_id = 'SESSION_ID';

-- Or delete the session entirely
DELETE FROM shop_sessions WHERE session_id = 'SESSION_ID';
```

### 2. Bulk Cleanup for Multiple Sessions

#### Automated Cleanup
```bash
# Run bulk cleanup for sessions stuck longer than 10 minutes
curl -X POST "https://your-domain/admin/sessions/cleanup-bulk" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"olderThanMinutes": 10, "dryRun": false}'
```

#### Manual Bulk Redis Cleanup
```bash
# Redis script to clean all stuck sessions
redis-cli --eval cleanup_stuck_sessions.lua

# Or using Redis commands
redis-cli EVAL "
local keys = redis.call('KEYS', 'session:invalidating:*')
for i=1,#keys do
  local ttl = redis.call('TTL', keys[i])
  if ttl == -1 or ttl > 300 then
    redis.call('DEL', keys[i])
    redis.call('DEL', string.gsub(keys[i], 'invalidating', 'lock'))
  end
end
return #keys
" 0
```

### 3. Prevent Future Occurrences

#### Verify Configuration
```bash
# Check session timeout settings
curl -X GET "https://your-domain/admin/config/session" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Enable Monitoring
```bash
# Enable stuck session monitoring
curl -X POST "https://your-domain/admin/monitoring/enable" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metric": "stuck_sessions", "enabled": true}'
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Session Invalidation Duration**
   - Alert if > 30 seconds
   - Critical if > 2 minutes

2. **Stuck Session Count**
   - Alert if > 5 sessions
   - Critical if > 20 sessions

3. **Redis Lock Count**
   - Alert if locks without TTL exist
   - Critical if > 100 locks exist

### Alert Queries

```sql
-- Sessions stuck in invalidation for > 5 minutes
SELECT COUNT(*) as stuck_count
FROM shop_sessions 
WHERE status = 'INVALIDATING' 
  AND invalidation_started < NOW() - INTERVAL '5 minutes';

-- Sessions with high invalidation attempt count
SELECT session_id, invalidation_attempts
FROM shop_sessions 
WHERE invalidation_attempts > 3;
```

## Escalation Procedures

### Level 1: Automatic Resolution
- Scheduled cleanup tasks handle most stuck sessions
- Monitoring alerts notify of issues

### Level 2: Manual Intervention
- Use admin endpoints for targeted cleanup
- Review logs for root cause analysis

### Level 3: Emergency Response
- Emergency cleanup endpoints
- Manual Redis/database intervention
- System restart if necessary

### Level 4: Development Team
- Code changes required
- Architecture review needed
- Performance optimization required

## Post-Incident Actions

### 1. Root Cause Analysis
- Review logs for the incident period
- Identify patterns in stuck sessions
- Document findings and lessons learned

### 2. System Improvements
- Update monitoring thresholds
- Improve error handling
- Enhance cleanup procedures

### 3. Documentation Updates
- Update this runbook with new procedures
- Share learnings with the team
- Update monitoring dashboards

## Common Issues and Solutions

### Issue: Redis Connection Timeouts
**Symptoms**: Sessions get stuck during Redis operations
**Solution**: 
- Check Redis connection pool settings
- Verify network connectivity
- Implement circuit breaker pattern

### Issue: Database Lock Contention
**Symptoms**: Session updates fail due to database locks
**Solution**:
- Optimize database queries
- Implement retry logic with backoff
- Consider read replicas for session reads

### Issue: High Memory Usage
**Symptoms**: Application memory grows due to session accumulation
**Solution**:
- Increase cleanup frequency
- Implement memory-based cleanup triggers
- Monitor garbage collection patterns

## Contact Information

- **On-Call Engineer**: [Contact details]
- **Database Team**: [Contact details]
- **Infrastructure Team**: [Contact details]
- **Development Team**: [Contact details]

## References

- [Session Management Architecture](../SESSION_MANAGEMENT_ARCHITECTURE.md)
- [Redis Operations Guide](../REDIS_OPERATIONS.md)
- [Monitoring Dashboard](https://monitoring.your-domain/sessions)
- [Alert Configuration](../ALERT_CONFIGURATION.md)