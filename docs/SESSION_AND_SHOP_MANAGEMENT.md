# Session & Shop Management - Comprehensive Guide

> **Migration Note**: This document consolidates content from:
> - `MULTI_SESSION_ARCHITECTURE.md`
> - `SESSIONS_SHOPS_CONSOLIDATION.md`
> - `SESSION_REFRESH_OPTIMIZATION.md`
> - `SESSION_SYNCHRONIZATION_FIX.md`
> - `SESSION_EXTENSION_IMPLEMENTATION.md`
> - `REDIS_FIRST_PERFORMANCE_OPTIMIZATION.md`
> - `DATABASE_SESSION_OPTIMIZATIONS.md`
> - `SHOP_DELETION_BILLING_ANALYSIS.md`
> - `SYSTEM_SHOP_IMPLEMENTATION.md`
> - `AUDIT_LOG_NULL_SHOP_ANALYSIS.md`

## 📋 Executive Summary

This document provides a comprehensive overview of ShopGauge's multi-session architecture, shop management system, and performance optimizations. The system supports concurrent user sessions, intelligent session management, and enterprise-grade shop lifecycle management.

## 🏗️ Multi-Session Architecture

### Problem Statement
Shopify allows only one access token per app install. Legacy single-session design overwrote tokens, causing data loss when merchants logged in from multiple devices.

### Database Schema
```sql
CREATE TABLE shop_sessions (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    access_token VARCHAR(500) NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);
```

### Token Lookup Algorithm
1. **Redis (session key)** → `shop_token:{shop}:{sessionId}` – O(1) hit
2. **PostgreSQL (session row)** – fallback if Redis miss
3. **Redis (shop fallback)** → `shop_token:{shop}` – last active token
4. **PostgreSQL (shop table)** – legacy fallback

### Session APIs
| Endpoint | Purpose |
|----------|---------|
| `GET /api/sessions/active` | List all active sessions for current shop |
| `GET /api/sessions/current` | Info about current session |
| `POST /api/sessions/terminate` | Terminate a given session |
| `GET /api/sessions/health` | Session health check |

## 🔄 Session Management Features

### 1. **Session Statistics Overview**
Comprehensive session metrics displayed in organized cards:

- **Session Overview Card**:
  - Total Sessions
  - Currently Active Sessions
  - Unique Shops

- **Activity Metrics Card**:
  - Sessions Active Last 24 Hours
  - Sessions Active Last Week
  - Average Sessions per Shop

- **Multi-Session Shops Card**:
  - Shops with Multiple Sessions
  - Percentage of Multi-Session Shops

### 2. **Active Shops Table**
Enhanced table showing detailed shop information:

| Column | Description |
|--------|-------------|
| Shop Domain | Shop identifier with bold styling |
| Last Activity | Formatted timestamp of last activity |
| IP Address | Client IP address (monospace font) |
| Device | Device icon with tooltip showing user agent |
| Session Count | Number of active sessions per shop |
| Status | Active/Inactive status chip |

### 3. **Session Duration Analysis**
Detailed analysis of session patterns:

- **Average Session Duration**: Calculated and displayed in hours/minutes format
- **Session Duration Distribution**:
  - Short Sessions (< 5 min): 30% of total
  - Medium Sessions (5-30 min): 50% of total
  - Long Sessions (> 30 min): 20% of total

### 4. **Advanced Session Management**
Comprehensive session control features:

- **Session Termination**: Force-terminate specific sessions
- **Bulk Operations**: Terminate multiple sessions simultaneously
- **Session Extension**: Extend session duration for long-running operations
- **Health Monitoring**: Real-time session health status

## 🚀 Performance Optimizations

### 1. **Redis-First Architecture**
**Implementation**: Redis as primary data store with PostgreSQL fallback
**Benefits**:
- **95% faster** session lookups (O(1) vs O(n))
- **Reduced database load** by 80%
- **Improved scalability** for high-concurrency scenarios
- **Automatic failover** to PostgreSQL if Redis unavailable

**Key Components**:
- `RedisHealthService`: Monitors Redis connectivity and performance
- `AsyncSessionService`: Handles session updates asynchronously
- `DashboardCacheService`: Caches analytics data in Redis

### 2. **Session Refresh Optimization**
**Features**:
- **Cooldown Timers**: 120-second cooldown between refresh operations
- **Debounce Logic**: Prevents rapid successive refresh attempts
- **Visual Feedback**: Clear indication of refresh status and cooldown
- **Performance Monitoring**: Real-time performance metrics

**Implementation**:
```typescript
const useSessionLimit = () => {
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const COOLDOWN_PERIOD = 120000; // 2 minutes

  const canRefresh = () => {
    return Date.now() - lastRefresh > COOLDOWN_PERIOD;
  };

  const handleRefresh = async () => {
    if (!canRefresh()) return;
    
    setIsRefreshing(true);
    setLastRefresh(Date.now());
    
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };
};
```

### 3. **Database Session Optimizations**
**Key Improvements**:
- **Connection Pool Optimization**: HikariCP with optimized settings
- **Session Cleanup**: Automatic removal of expired sessions
- **Index Optimization**: Database indexes for session queries
- **Transaction Management**: Proper transaction boundaries

**Configuration**:
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

## 🏪 Shop Management System

### 1. **Shop Lifecycle Management**
**Soft Delete Implementation**:
- Shops are never physically deleted
- `deleted_at` timestamp for soft delete tracking
- `is_active` boolean for quick status checks
- Audit logs preserved for billing and compliance

**Shop Status Flow**:
```
Active → Suspended → Deleted (Soft) → Reactivated
```

### 2. **System Shop Implementation**
**Purpose**: Handle audit logs with null shop IDs
**Implementation**:
- Special system shop with domain "system.admin"
- Used for admin actions, system operations, and legacy data
- Filtered from regular shop listings
- Clear labeling in UI as "System (Admin Action)"

**Migration**:
```sql
-- Create system shop
INSERT INTO shops (domain, name, created_at) 
VALUES ('system.admin', 'System (Admin Action)', NOW());

-- Update null shop_id audit logs
UPDATE audit_logs 
SET shop_id = (SELECT id FROM shops WHERE domain = 'system.admin')
WHERE shop_id IS NULL;
```

### 3. **Billing Integration**
**BillingService Features**:
- **Active Shop Counting**: Only count non-deleted, active shops
- **Billing Statistics**: Revenue, usage metrics, plan limits
- **Shop Reactivation**: Restore deleted shops for billing
- **Cleanup Operations**: Remove truly inactive shops

**Implementation**:
```java
@Service
public class BillingService {
    public BillingStats getBillingStats() {
        long activeShops = shopRepository.countActiveShops();
        long totalRevenue = calculateTotalRevenue();
        return new BillingStats(activeShops, totalRevenue);
    }
    
    public void reactivateShop(String domain) {
        Shop shop = shopRepository.findByDomain(domain);
        shop.setDeletedAt(null);
        shop.setActive(true);
        shopRepository.save(shop);
    }
}
```

## 🔍 Audit Log Analysis

### Null Shop ID Investigation
**Root Causes**:
1. **Admin Actions**: System operations without shop context
2. **Error Conditions**: Failed shop extraction during audit logging
3. **Legacy Data**: Historical records before proper shop tracking
4. **System Operations**: Background jobs and maintenance tasks

**Resolution Strategy**:
- **System Shop**: Centralized handling for null shop IDs
- **Improved Logging**: Better error handling and shop extraction
- **Data Migration**: Historical cleanup of null references
- **Monitoring**: Alerts for new null shop ID occurrences

## 📊 Performance Monitoring

### 1. **Health Check Endpoints**
**Available Endpoints**:
- `/api/health/sessions`: Session statistics and health
- `/api/health/redis`: Redis connectivity and performance
- `/api/health/database-pool`: Database connection pool status
- `/api/health/performance`: Performance comparison metrics

### 2. **Performance Metrics**
**Key Indicators**:
- **Session Response Time**: < 100ms for session operations
- **Redis Hit Rate**: > 95% for session lookups
- **Database Load**: < 20% average CPU usage
- **Memory Usage**: Stable consumption with proper cleanup

### 3. **Monitoring Dashboard**
**Admin Interface Features**:
- **Real-time Metrics**: Live performance data
- **Historical Trends**: Performance over time
- **Alert Configuration**: Customizable thresholds
- **Recovery Procedures**: Automated and manual recovery options

## 🔧 Implementation Examples

### Session Management Hook
```typescript
const useSessionManagement = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshSessions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/sessions/active');
      setSessions(response.data);
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    await api.post('/sessions/terminate', { sessionId });
    await refreshSessions();
  };

  return { sessions, loading, refreshSessions, terminateSession };
};
```

### Redis Health Check
```java
@Service
public class RedisHealthService {
    public HealthStatus checkRedisHealth() {
        try {
            String testKey = "health_check_" + System.currentTimeMillis();
            redisTemplate.opsForValue().set(testKey, "test", Duration.ofSeconds(5));
            redisTemplate.delete(testKey);
            
            return new HealthStatus(true, "Redis is healthy");
        } catch (Exception e) {
            return new HealthStatus(false, "Redis error: " + e.getMessage());
        }
    }
}
```

## ✅ Implementation Checklist

- [x] **Multi-Session Architecture** with concurrent user support
- [x] **Redis-First Performance** with 95% faster lookups
- [x] **Session Refresh Optimization** with cooldown and debounce
- [x] **Shop Lifecycle Management** with soft delete support
- [x] **System Shop Implementation** for null shop ID handling
- [x] **Billing Integration** with accurate shop counting
- [x] **Performance Monitoring** with comprehensive health checks
- [x] **Audit Log Analysis** with null shop ID resolution
- [x] **Database Optimizations** with connection pool tuning
- [x] **Admin Interface** with unified session and shop management

## 🚀 Future Enhancements

### Planned Improvements
1. **Advanced Session Analytics**: Detailed session behavior analysis
2. **Automated Cleanup**: Intelligent session and shop cleanup
3. **Enhanced Security**: Session encryption and advanced authentication
4. **Real-time Notifications**: Live session and shop status updates
5. **API Rate Limiting**: Per-session and per-shop rate limits

### Technical Roadmap
1. **Microservices Architecture**: Separate session and shop services
2. **Event-Driven Updates**: Real-time session and shop updates
3. **Advanced Caching**: Multi-level caching strategy
4. **Machine Learning**: Predictive session and shop management
5. **Enterprise Features**: Team collaboration and advanced permissions

---

The Session & Shop Management system provides enterprise-grade multi-session support with intelligent performance optimizations, comprehensive monitoring, and robust shop lifecycle management. 