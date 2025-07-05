# Database Connection Fix

## Problem
Production database connections were timing out after 30 seconds:
```
StoresightHikariCP - Connection is not available, request timed out after 30000ms.
```

## Solution
Updated database connection pool configuration for production:

### Key Changes
1. **Increased connection timeout**: 30s → 60s
2. **Reduced pool size**: 50 → 10 connections (prevents overwhelming remote database)
3. **Added connection retry logic**: 3 retry attempts with 5s delays
4. **Enhanced monitoring**: Real-time database metrics endpoint

### Files Modified
- `backend/src/main/resources/application.properties` - Made connection pool configurable via environment variables
- `backend/src/main/resources/application-prod.properties` - Production-specific database settings
- `backend/src/main/java/com/storesight/backend/config/DatabaseConfig.java` - Added retry logic and production detection
- `backend/src/main/java/com/storesight/backend/service/DatabaseMonitoringService.java` - Database health monitoring
- `backend/src/main/java/com/storesight/backend/controller/HealthController.java` - Added database metrics endpoint

## Environment Variables
Set these in your production environment:
```bash
SPRING_PROFILES_ACTIVE=prod
DB_POOL_SIZE=10
```

## Monitoring
Check database health at: `/api/health/database-metrics`

## Deployment
Simply deploy the updated code. The changes will automatically apply when `SPRING_PROFILES_ACTIVE=prod` is set. 