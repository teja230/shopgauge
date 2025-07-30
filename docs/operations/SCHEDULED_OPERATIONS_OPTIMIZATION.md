# Scheduled Operations Optimization

## Overview

This document explains the optimization of scheduled operations that previously all ran at 2:00 AM, causing resource conflicts and potential performance issues.

## Problem Analysis

### Original 2:00 AM Operations (All Conflicting)

1. **DataRetentionService.performDailyCleanup()** - `2:00 AM`
   - Cleans up old audit logs, cost data, privacy requests
   - Database-intensive operations with DELETE queries

2. **NotificationService.scheduledCleanup()** - `2:00 AM`
   - Cleans up old notifications
   - Database operations with bulk deletes

3. **ShopService.cleanupOldInactiveSessionsScheduled()** - `2:00 AM & 2:00 PM`
   - Cleans up inactive sessions
   - Database and Redis operations

4. **DatabaseMonitoringService.scheduledMaintenance()** - `2:00 AM`
   - Performs database maintenance (ANALYZE, materialized view refresh)
   - Database-intensive operations

5. **DataPrivacyService.scheduledAuditLogCleanup()** - `2:00 AM`
   - Cleans up old audit logs
   - Database operations

### Identified Issues

1. **Resource Contention**: All 5 services performing database operations simultaneously
2. **Lock Conflicts**: Multiple DELETE operations on overlapping tables
3. **Performance Impact**: Database connection pool exhaustion
4. **Error Propagation**: One service failure could affect others
5. **Monitoring Difficulty**: Hard to identify which operation caused issues

## Solution: Staggered Schedule

### Optimized Schedule

| Service | Original Time | New Time | Purpose | Duration |
|---------|---------------|----------|---------|----------|
| **ShopService** | 2:00 AM | **2:05 AM** | Session cleanup | ~2-3 min |
| **DataRetentionService** | 2:00 AM | **2:15 AM** | Data retention cleanup | ~5-8 min |
| **NotificationService** | 2:00 AM | **2:30 AM** | Notification cleanup | ~2-3 min |
| **DatabaseMonitoringService** | 2:00 AM | **2:45 AM** | DB maintenance | ~3-5 min |
| **DataPrivacyService** | 2:00 AM | **3:00 AM** | Audit log cleanup | ~2-4 min |

### Benefits of Staggered Schedule

1. **Reduced Resource Contention**: Operations are spread over 55 minutes instead of simultaneous
2. **Better Error Isolation**: Each operation runs independently
3. **Improved Monitoring**: Clear separation of operation logs
4. **Enhanced Reliability**: Less likely to cause cascading failures
5. **Better Performance**: Database connection pool can handle operations sequentially

## Technical Details

### Why 2:00 AM is Optimal

- **Low Traffic**: Minimal user activity during this time
- **Business Hours**: 2 AM is outside business hours for most users
- **System Resources**: Server resources are typically available
- **Backup Window**: Aligns with typical database backup schedules

### Why Daily Frequency is Necessary

1. **Data Hygiene**: Prevents database bloat from old records
2. **Performance**: Keeps tables optimized for queries
3. **Compliance**: Ensures data retention policies are enforced
4. **Cost Management**: Prevents excessive storage costs
5. **Security**: Removes old session data and audit logs

### Operation Dependencies

```
2:05 AM - Session Cleanup (ShopService)
    ↓ (10 min gap)
2:15 AM - Data Retention (DataRetentionService)
    ↓ (15 min gap)
2:30 AM - Notification Cleanup (NotificationService)
    ↓ (15 min gap)
2:45 AM - Database Maintenance (DatabaseMonitoringService)
    ↓ (15 min gap)
3:00 AM - Audit Log Cleanup (DataPrivacyService)
```

## Monitoring and Alerts

### Success Metrics

- **Operation Duration**: Each operation should complete within expected time
- **Error Rate**: < 1% failure rate for all operations
- **Database Performance**: No significant impact on query performance
- **Resource Usage**: CPU/Memory usage should return to baseline after each operation

### Alerting Rules

1. **Operation Failure**: Alert if any scheduled operation fails
2. **Duration Exceeded**: Alert if operation takes longer than expected
3. **Database Impact**: Alert if database performance degrades significantly
4. **Resource Exhaustion**: Alert if system resources are critically low

## Configuration

### Environment Variables

```properties
# Data Retention Configuration
data.retention.enabled=true
data.retention.price-snapshots.days=90
data.retention.soft-deleted.days=30

# Notification Cleanup Configuration
notifications.cleanup.enabled=true
notifications.cleanup.retention-days=30

# Session Management Configuration
session.cleanup.enabled=true
session.cleanup.retention-days=2

# Database Maintenance Configuration
database.maintenance.enabled=true
database.maintenance.analyze-tables=true
```

### Disabling Operations

Individual operations can be disabled via feature flags:

```properties
# Disable specific operations if needed
data.retention.enabled=false
notifications.cleanup.enabled=false
session.cleanup.enabled=false
database.maintenance.enabled=false
```

## Troubleshooting

### Common Issues

1. **Operation Timeout**: Increase timeout values for long-running operations
2. **Database Locks**: Check for long-running transactions blocking cleanup
3. **Memory Issues**: Monitor heap usage during bulk delete operations
4. **Connection Pool Exhaustion**: Increase pool size if needed

### Debug Commands

```sql
-- Check for long-running transactions
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%';

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;
```

## Future Optimizations

### Potential Improvements

1. **Parallel Processing**: Run independent operations in parallel
2. **Batch Processing**: Increase batch sizes for better performance
3. **Incremental Cleanup**: Clean up data incrementally throughout the day
4. **Smart Scheduling**: Use machine learning to optimize cleanup schedules
5. **Distributed Cleanup**: Spread operations across multiple database connections

### Monitoring Enhancements

1. **Real-time Dashboards**: Live monitoring of cleanup operations
2. **Predictive Alerts**: Alert before operations fail
3. **Performance Metrics**: Track operation efficiency over time
4. **Cost Analysis**: Monitor storage cost savings from cleanup

## Conclusion

The staggered schedule optimization resolves the resource contention issues while maintaining the necessary daily cleanup operations. The 55-minute window from 2:05 AM to 3:00 AM ensures all operations complete successfully without interfering with each other.

This approach provides:
- ✅ **Reliability**: Reduced chance of operation failures
- ✅ **Performance**: Better database performance during cleanup
- ✅ **Monitoring**: Clear separation of operation logs
- ✅ **Maintainability**: Easier to debug and optimize individual operations
- ✅ **Scalability**: Framework for future optimizations 