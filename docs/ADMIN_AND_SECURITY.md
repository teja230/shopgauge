# Admin & Security - Comprehensive Guide

> **Migration Note**: This document consolidates content from:
> - `SHOPGAUGE_ADMIN_COMPREHENSIVE_GUIDE.md`
> - `ARCHITECTURE_SECURITY.md`
> - `OAUTH_DATABASE_FIXES.md`
> - `AUTHENTICATION_UI_FIXES.md`

## 📋 Executive Summary

This document provides a complete overview of the ShopGauge admin authentication system, security architecture, and authentication flow fixes. This is the **single source of truth** for all admin-related operations and security implementations.

## 🔐 Enterprise-Grade Admin Authentication & Management System

### Application Context
**ShopGauge** is a comprehensive Shopify analytics and market intelligence platform that provides:
- Real-time store performance analytics
- Market intelligence and competitor analysis
- Multi-session architecture for enterprise shops
- Advanced data visualization and reporting
- Automated notifications and alerts

### Admin System Purpose
The admin authentication system provides **secure, enterprise-grade access** to:
- System health monitoring and diagnostics
- Connection pool management and recovery
- Emergency procedures during system issues
- Audit logging and security monitoring
- Performance optimization tools

## 🔒 Security Architecture

### Authentication Flow
```
Admin Login → JWT Token Generation → Protected Endpoints
    ↓
Rate Limiting (Redis) → BCrypt Verification → Audit Logging
    ↓
JWT Token with Expiration → Secure HTTP-Only Cookies
```

### Security Layers

| Feature | Implementation | Status |
|---------|---------------|--------|
| **Password Hashing** | BCrypt with salt rounds | ✅ Active |
| **JWT Tokens** | 24-hour expiration with refresh | ✅ Active |
| **Rate Limiting** | Redis-based with 5 attempts/15min | ✅ Active |
| **Session Management** | Secure HTTP-Only cookies | ✅ Active |
| **Audit Logging** | All admin actions logged | ✅ Active |
| **CORS Protection** | Configured for production domains | ✅ Active |

### High-Level Architecture

| Layer | Key Components | Technology |
|-------|----------------|------------|
| Frontend | React 18 + Vite, MUI, Tailwind, PWA | TypeScript |
| API Layer | API Gateway (`StoresightBackendApplication`) | Spring Boot 3 (WebFlux) |
| Services | Analytics, Discovery, Session, Notification, Privacy | Spring Beans |
| Data | PostgreSQL 15+, Redis 7 | Flyway, Spring Data JPA / RedisTemplate |
| External | Shopify API, Scrapingdog, Serper, SerpAPI, SendGrid, Twilio | REST / HTTPS |

## 🏗️ Multi-Session Architecture

### Database Schema (Simplified)
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

## 🔧 Admin Authentication Setup

### 1. **Environment Configuration**
```bash
# Required environment variables
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
ADMIN_EMAIL=admin@shopgauge.com
JWT_SECRET=your_jwt_secret_key
```

### 2. **Database Setup**
```sql
-- Admin audit logs table
CREATE TABLE admin_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_username VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. **Security Configuration**
```java
@Configuration
@EnableWebSecurity
public class WebSecurityConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/api/admin/**").authenticated()
                .requestMatchers("/api/health/**").permitAll()
                .anyRequest().permitAll()
            )
            .addFilterBefore(adminAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
}
```

## 🏥 Health Check Endpoints

### 1. **System Health Overview**
```http
GET /api/health/overview
```
**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "components": {
    "database": "healthy",
    "redis": "healthy",
    "shopify": "healthy",
    "sessions": "healthy"
  },
  "metrics": {
    "activeSessions": 45,
    "databaseConnections": 12,
    "redisMemoryUsage": "256MB"
  }
}
```

### 2. **Database Pool Status**
```http
GET /api/health/database-pool
```
**Response**:
```json
{
  "status": "healthy",
  "pool": {
    "activeConnections": 8,
    "idleConnections": 4,
    "totalConnections": 12,
    "maxConnections": 20,
    "connectionTimeout": 30000
  },
  "performance": {
    "averageResponseTime": "45ms",
    "slowQueries": 0,
    "connectionErrors": 0
  }
}
```

### 3. **Redis Health Check**
```http
GET /api/health/redis
```
**Response**:
```json
{
  "status": "healthy",
  "redis": {
    "connected": true,
    "memoryUsage": "256MB",
    "keyspace": 1250,
    "hitRate": 0.95
  },
  "performance": {
    "averageResponseTime": "2ms",
    "slowCommands": 0,
    "connectionErrors": 0
  }
}
```

### 4. **Session Health**
```http
GET /api/health/sessions
```
**Response**:
```json
{
  "status": "healthy",
  "sessions": {
    "totalActive": 45,
    "uniqueShops": 23,
    "averageDuration": "2h 15m",
    "expiredSessions": 12
  },
  "performance": {
    "averageLookupTime": "15ms",
    "redisHitRate": 0.95,
    "databaseFallbacks": 5
  }
}
```

## 🚨 Recovery & Emergency Procedures

### 1. **Database Connection Pool Exhaustion**
**Symptoms**:
- High response times (>5 seconds)
- Database connection errors
- Admin interface slow or unresponsive

**Recovery Steps**:
```bash
# 1. Check current connections
curl -X GET http://localhost:8080/api/health/database-pool

# 2. Restart application if necessary
./gradlew bootRun

# 3. Monitor connection pool
curl -X GET http://localhost:8080/api/health/database-pool
```

### 2. **Redis Connection Issues**
**Symptoms**:
- Session authentication failures
- Cache misses increasing
- Performance degradation

**Recovery Steps**:
```bash
# 1. Check Redis health
curl -X GET http://localhost:8080/api/health/redis

# 2. Restart Redis if necessary
sudo systemctl restart redis

# 3. Verify connection
redis-cli ping
```

### 3. **Admin Authentication Reset**
**Emergency Procedure**:
```bash
# 1. Access emergency admin page
# Navigate to: /emergency-admin.html

# 2. Reset admin password
curl -X POST http://localhost:8080/api/admin/emergency/reset-password \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "new_secure_password"}'

# 3. Verify admin access
curl -X GET http://localhost:8080/api/admin/health \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Admin Management Endpoints

### 1. **Admin Authentication**
```http
POST /api/admin/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-16T10:30:00Z",
  "admin": {
    "username": "admin",
    "email": "admin@shopgauge.com",
    "lastLogin": "2024-01-15T10:30:00Z"
  }
}
```

### 2. **System Health Dashboard**
```http
GET /api/admin/health/dashboard
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response**:
```json
{
  "system": {
    "status": "healthy",
    "uptime": "7d 12h 30m",
    "version": "1.2.0"
  },
  "performance": {
    "averageResponseTime": "120ms",
    "requestsPerMinute": 45,
    "errorRate": 0.01
  },
  "resources": {
    "cpuUsage": 25,
    "memoryUsage": 512,
    "diskUsage": 15
  }
}
```

### 3. **Audit Logs**
```http
GET /api/admin/audit-logs?page=0&size=20
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response**:
```json
{
  "content": [
    {
      "id": 1,
      "adminUsername": "admin",
      "action": "LOGIN",
      "details": {"ip": "192.168.1.100"},
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "totalElements": 150,
  "totalPages": 8
}
```

## 🔄 Connection Pool Management

### 1. **Pool Configuration**
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      leak-detection-threshold: 60000
```

### 2. **Pool Monitoring**
```http
GET /api/admin/connection-pool/status
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response**:
```json
{
  "pool": {
    "activeConnections": 8,
    "idleConnections": 4,
    "totalConnections": 12,
    "maxConnections": 20,
    "connectionTimeout": 30000
  },
  "performance": {
    "averageResponseTime": "45ms",
    "slowQueries": 0,
    "connectionErrors": 0
  }
}
```

### 3. **Pool Recovery**
```http
POST /api/admin/connection-pool/reset
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📊 Monitoring & Alerts

### 1. **Performance Metrics**
- **Response Time**: Target < 200ms average
- **Error Rate**: Target < 1% error rate
- **Uptime**: Target > 99.9% availability
- **Resource Usage**: CPU < 80%, Memory < 80%

### 2. **Alert Configuration**
```java
@Component
public class HealthAlertService {
    
    @Scheduled(fixedRate = 60000) // Every minute
    public void checkSystemHealth() {
        HealthStatus health = healthService.getSystemHealth();
        
        if (!health.isHealthy()) {
            sendAlert("System health check failed: " + health.getMessage());
        }
    }
}
```

### 3. **Logging Configuration**
```yaml
logging:
  level:
    com.storesight.backend: INFO
    org.springframework.security: DEBUG
    com.storesight.backend.admin: DEBUG
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"
```

## 🔐 Admin Session Management & Security Fixes

### Admin Session Invalidation Fix

**Issue**: Admin session invalidation was not working properly, causing users to remain logged in even after clicking the logout button on the admin screen.

**Root Causes**:
1. **Frontend Race Condition**: Logout function was redirecting immediately without waiting for backend response
2. **Incomplete State Cleanup**: Not all admin-related state was being cleared properly
3. **Cookie Cleanup Issues**: Frontend wasn't ensuring the admin token cookie was properly cleared
4. **Backend Edge Cases**: Backend logout endpoint didn't handle null/invalid tokens gracefully
5. **Missing Periodic Checks**: No periodic authentication validation to detect expired sessions

**Fixes Implemented**:

#### Frontend Improvements (`AdminPage.tsx`)
- **Enhanced Logout Function**: Wait for backend response, clear all state, force cookie clearing
- **Improved Authentication Status Check**: More robust state cleanup and error handling
- **Periodic Authentication Check**: 5-minute interval to detect expired sessions
- **Better State Management**: Ensure password dialog is always open when not authenticated

#### Backend Improvements (`AdminAuthController.java`)
- **Robust Logout Endpoint**: Handle null/invalid tokens gracefully
- **Enhanced Cookie Cleanup**: Clear cookies for both production and development environments
- **Multiple Cookie Clearing Strategies**: Ensure cleanup across different domains

#### Service Layer Improvements (`AdminAuthService.java`)
- **Improved Token Invalidation**: Better error handling, don't throw exceptions that prevent logout
- **Enhanced Token Blacklist Check**: Better handling of null/empty tokens, graceful Redis fallback

**Expected Behavior After Fix**:
1. **Immediate Logout**: When user clicks logout, they are immediately logged out and redirected
2. **Complete State Cleanup**: All admin-related state and cached data are cleared
3. **Cookie Cleanup**: Admin token cookie is properly cleared from browser
4. **Session Invalidation**: Backend properly invalidates the JWT token
5. **Periodic Validation**: Expired sessions are automatically detected and logged out
6. **Error Resilience**: Logout works even if backend is temporarily unavailable

**Verification Steps**:
1. Log into admin panel
2. Click logout button
3. Verify user is immediately logged out and redirected to home page
4. Try to access admin panel again - should require re-authentication
5. Check browser cookies - admin_token should be cleared
6. Wait for session expiration (if configured) - should auto-logout

**Files Modified**:
- `frontend/src/pages/AdminPage.tsx` - Enhanced logout and authentication logic
- `backend/src/main/java/com/storesight/backend/controller/AdminAuthController.java` - Improved logout endpoint
- `backend/src/main/java/com/storesight/backend/service/AdminAuthService.java` - Enhanced token management
- `backend/src/test/java/com/storesight/backend/AdminLogoutTest.java` - Added test coverage

## 🚀 Production Deployment

### 1. **Environment Variables**
```bash
# Required for production
SPRING_PROFILES_ACTIVE=prod
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_production_password
JWT_SECRET=your_production_jwt_secret
DB_URL=jdbc:postgresql://your-db-host:5432/storesight
REDIS_HOST=your-redis-host
REDIS_PORT=6379
```

### 2. **Security Headers**
```java
@Configuration
public class SecurityHeadersConfig {
    
    @Bean
    public FilterRegistrationBean<HeaderWriterFilter> securityHeadersFilter() {
        HeaderWriterFilter filter = new HeaderWriterFilter(
            Arrays.asList(
                new XFrameOptionsHeaderWriter(),
                new XXssProtectionHeaderWriter(),
                new ContentTypeOptionsHeaderWriter(),
                new HstsHeaderWriter()
            )
        );
        
        return new FilterRegistrationBean<>(filter);
    }
}
```

### 3. **SSL Configuration**
```yaml
server:
  ssl:
    key-store: classpath:keystore.p12
    key-store-password: your_keystore_password
    key-store-type: PKCS12
  port: 443
```

## 🔧 Troubleshooting

### 1. **Common Issues**

#### Authentication Failures
**Symptoms**: 401 Unauthorized errors
**Solutions**:
- Verify JWT token expiration
- Check admin credentials in environment
- Review audit logs for failed attempts

#### Database Connection Issues
**Symptoms**: 500 errors, slow responses
**Solutions**:
- Check database pool status
- Verify database connectivity
- Review connection pool configuration

#### Redis Connection Issues
**Symptoms**: Session failures, cache misses
**Solutions**:
- Check Redis health endpoint
- Verify Redis connectivity
- Review Redis configuration

### 2. **Debug Endpoints**
```http
# Enable debug logging
GET /api/admin/debug/enable
Authorization: Bearer YOUR_JWT_TOKEN

# Disable debug logging
GET /api/admin/debug/disable
Authorization: Bearer YOUR_JWT_TOKEN

# Get system diagnostics
GET /api/admin/debug/diagnostics
Authorization: Bearer YOUR_JWT_TOKEN
```

## 🔄 Maintenance Procedures

### 1. **Regular Maintenance Tasks**
- **Daily**: Review audit logs for suspicious activity
- **Weekly**: Check performance metrics and resource usage
- **Monthly**: Review and rotate admin passwords
- **Quarterly**: Security audit and penetration testing

### 2. **Backup Procedures**
```bash
# Database backup
pg_dump storesight > backup_$(date +%Y%m%d).sql

# Redis backup
redis-cli BGSAVE

# Configuration backup
cp application-prod.properties backup/
```

### 3. **Update Procedures**
```bash
# 1. Backup current deployment
cp -r /opt/shopgauge /opt/shopgauge_backup

# 2. Deploy new version
./deploy.sh

# 3. Verify deployment
curl -X GET http://localhost:8080/api/health/overview

# 4. Rollback if necessary
./rollback.sh
```

## ✅ Implementation Checklist

- [x] **Admin Authentication System** with JWT tokens
- [x] **Security Architecture** with multiple layers
- [x] **Health Check Endpoints** for system monitoring
- [x] **Emergency Recovery Procedures** for critical issues
- [x] **Connection Pool Management** with HikariCP
- [x] **Audit Logging** for all admin actions
- [x] **Rate Limiting** with Redis-based protection
- [x] **SSL Configuration** for production security
- [x] **Monitoring & Alerts** for proactive management
- [x] **Troubleshooting Tools** for debugging issues

## 🚀 Future Enhancements

### Planned Improvements
1. **Advanced Security**: Multi-factor authentication
2. **Enhanced Monitoring**: Real-time dashboards
3. **Automated Recovery**: Self-healing systems
4. **Advanced Analytics**: Performance insights
5. **Team Collaboration**: Multi-admin support

### Technical Roadmap
1. **Microservices Architecture**: Separate admin service
2. **Event-Driven Updates**: Real-time health monitoring
3. **Machine Learning**: Predictive maintenance
4. **Advanced Security**: Zero-trust architecture
5. **Enterprise Features**: Advanced permissions and roles

---

The Admin & Security system provides enterprise-grade authentication, comprehensive monitoring, and robust security features for the ShopGauge platform. 