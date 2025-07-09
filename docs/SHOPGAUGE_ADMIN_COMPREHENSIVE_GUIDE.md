# ShopGauge Admin System - Comprehensive Guide

## 🔐 Enterprise-Grade Admin Authentication & Management System

This document provides a complete overview of the ShopGauge admin authentication system, including setup, security features, recovery procedures, and all available endpoints. This is the **single source of truth** for all admin-related operations.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Security Architecture](#security-architecture)
3. [Admin Authentication Setup](#admin-authentication-setup)
4. [Health Check Endpoints](#health-check-endpoints)
5. [Recovery & Emergency Procedures](#recovery--emergency-procedures)
6. [Admin Management Endpoints](#admin-management-endpoints)
7. [Connection Pool Management](#connection-pool-management)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [Production Deployment](#production-deployment)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance Procedures](#maintenance-procedures)

---

## 🏗️ System Overview

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

---

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
|---------|---------------|---------|
| **Password Hashing** | BCrypt (cost factor 12) | ✅ |
| **JWT Tokens** | HS512 signed, 24h expiration | ✅ |
| **Rate Limiting** | Redis-based, 5 attempts/15min | ✅ |
| **Audit Logging** | Database with IP tracking | ✅ |
| **Token Blacklisting** | Redis-based invalidation | ✅ |
| **Secure Cookies** | HttpOnly, Secure, SameSite | ✅ |
| **HTTPS Enforcement** | Production requirement | ✅ |
| **Environment Variables** | Secure credential storage | ✅ |
| **Session Management** | Redis-backed sessions | ✅ |
| **Account Lockout** | Automatic after failed attempts | ✅ |
| **Fail-Fast Security** | Application stops if JWT secret not set | ✅ |

### Security Features
- **Separate Admin Authentication**: Completely independent from shop authentication
- **Multi-Factor Security**: Password + JWT + Rate limiting + Audit logging
- **Enterprise Compliance**: GDPR, SOC2, and security best practices
- **Real-time Monitoring**: Live security event tracking and alerting

---

## 🛠️ Admin Authentication Setup

### Step 1: Generate Secure Password Hash

```bash
# Generate BCrypt hash using any BCrypt tool with cost factor 12
# Example: Use online BCrypt generators or command-line tools
# Ensure the hash starts with $2a$12$ for proper security
```

### Step 2: Set Environment Variables

```bash
# Development Environment
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD="$2a$12$[generated_hash]"
export ADMIN_JWT_SECRET="[256-bit-secret]"

# Production Environment (add to deployment configuration)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$2a$12$[generated_hash]
ADMIN_JWT_SECRET=[256-bit-secret]
```

### Step 3: Verify Setup

```bash
# Test admin login (replace with your actual credentials)
curl -X POST http://localhost:8080/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "YourPassword"}'
```

### Security Requirements
- **Password**: 12+ characters, mixed case, numbers, symbols
- **JWT Secret**: 256-bit random string
- **HTTPS**: Required in production
- **Environment Variables**: Never commit to version control
- **Test Endpoints**: Removed from production environment

---

## 🏥 Health Check Endpoints

### System Health Overview
```http
GET /api/health/summary
```
**Response**: Comprehensive system health including database, Redis, and application status.

### Database Health
```http
GET /api/health/database
```
**Response**: Database connection status, query performance, and connection pool metrics.

### Redis Health
```http
GET /api/health/redis
```
**Response**: Redis connectivity, performance metrics, and cache status.

### Connection Pool Status
```http
GET /api/health/connection-pool
```
**Response**: HikariCP pool metrics, active/idle connections, and leak detection.

### Connection Leak Detection
```http
GET /api/health/connection-leak-status
```
**Response**: Detailed connection leak analysis and cleanup recommendations.

### Transaction Health
```http
GET /api/health/transactions
```
**Response**: Transaction success rates, violations, and performance metrics.

### JVM Memory Status
```http
GET /api/health/system
```
**Response**: JVM memory usage, garbage collection metrics, and system resources.

---

## 🚨 Recovery & Emergency Procedures

### Emergency Connection Pool Cleanup
```http
POST /api/admin/emergency-cleanup
Authorization: Bearer [jwt-token]
```
**Purpose**: Force cleanup of leaked connections during critical situations.
**Usage**: Only during connection pool exhaustion emergencies.

### Comprehensive System Cleanup
```http
POST /api/admin/comprehensive-cleanup
Authorization: Bearer [jwt-token]
```
**Purpose**: Full system cleanup including connections, cache, and sessions.
**Usage**: During system recovery or maintenance windows.

### Database Connection Recovery
```http
POST /api/admin/recover-database-connections
Authorization: Bearer [jwt-token]
```
**Purpose**: Attempt to recover database connections with conservative retry logic.
**Usage**: When database connectivity is degraded but not completely lost.

### Redis Connection Recovery
```http
POST /api/admin/recover-redis-connections
Authorization: Bearer [jwt-token]
```
**Purpose**: Restore Redis connectivity and clear failed connection attempts.
**Usage**: When Redis is experiencing intermittent connectivity issues.

### Session Cleanup
```http
POST /api/admin/cleanup-sessions
Authorization: Bearer [jwt-token]
```
**Purpose**: Clean up stale sessions and free associated resources.
**Usage**: During high session load or memory pressure.

### Emergency Procedures by Scenario

#### Connection Pool Exhaustion
1. **Immediate Response**:
   ```bash
   curl -X POST http://localhost:8080/api/admin/emergency-cleanup \
     -H "Authorization: Bearer [token]"
   ```
2. **Check Status**:
   ```bash
   curl http://localhost:8080/api/health/connection-leak-status
   ```
3. **Monitor Recovery**:
   ```bash
   curl http://localhost:8080/api/health/connection-pool
   ```

#### Redis Connectivity Issues
1. **Check Redis Status**:
   ```bash
   curl http://localhost:8080/api/health/redis
   ```
2. **Attempt Recovery**:
   ```bash
   curl -X POST http://localhost:8080/api/admin/recover-redis-connections \
     -H "Authorization: Bearer [token]"
   ```
3. **Verify Recovery**:
   ```bash
   curl http://localhost:8080/api/health/redis
   ```

#### Database Connectivity Problems
1. **Check Database Health**:
   ```bash
   curl http://localhost:8080/api/health/database
   ```
2. **Recover Connections**:
   ```bash
   curl -X POST http://localhost:8080/api/admin/recover-database-connections \
     -H "Authorization: Bearer [token]"
   ```
3. **Monitor Recovery**:
   ```bash
   curl http://localhost:8080/api/health/summary
   ```

#### System-Wide Issues
1. **Comprehensive Cleanup**:
   ```bash
   curl -X POST http://localhost:8080/api/admin/comprehensive-cleanup \
     -H "Authorization: Bearer [token]"
   ```
2. **System Health Check**:
   ```bash
   curl http://localhost:8080/api/health/summary
   ```

---

## 👤 Admin Management Endpoints

### Admin Login
```http
POST /api/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```
**Response**: JWT token and secure cookie setup.

### Admin Logout
```http
POST /api/admin/logout
Authorization: Bearer [jwt-token]
```
**Response**: Token invalidation and cookie cleanup.

### Refresh Token
```http
POST /api/admin/refresh
Authorization: Bearer [jwt-token]
```
**Response**: New JWT token with extended expiration.

### Admin Profile
```http
GET /api/admin/profile
Authorization: Bearer [jwt-token]
```
**Response**: Admin user information and session details.

### Session Statistics
```http
GET /api/admin/session-statistics
Authorization: Bearer [jwt-token]
```
**Response**: Active sessions, multi-session shops, and usage statistics.

### Audit Logs
```http
GET /api/admin/audit-logs?page=0&size=50
Authorization: Bearer [jwt-token]
```
**Response**: Paginated audit trail with filtering options.

---

## 🔗 Connection Pool Management

### Real-time Pool Metrics
```http
GET /api/admin/connection-pool-metrics
Authorization: Bearer [jwt-token]
```
**Response**: Live connection pool statistics and health indicators.

### Connection Pool Configuration
```http
GET /api/admin/connection-pool-config
Authorization: Bearer [jwt-token]
```
**Response**: Current pool configuration and tuning parameters.

### Force Pool Refresh
```http
POST /api/admin/refresh-connection-pool
Authorization: Bearer [jwt-token]
```
**Purpose**: Force refresh of connection pool without full restart.
**Usage**: During configuration changes or connection issues.

### Auto-Recovery Features
- **Conservative Retry Logic**: Prevents system overload during recovery
- **Exponential Backoff**: Intelligent retry intervals
- **Connection Leak Detection**: Automatic identification of leaked connections
- **Emergency Access**: Admin access maintained during connection issues

---

## 📊 Monitoring & Alerts

### Key Metrics to Monitor

1. **Connection Pool Health**:
   - Active connections percentage
   - Threads awaiting connections
   - Connection leak risk level

2. **Redis Performance**:
   - Response time < 10ms
   - Consecutive failures < 3
   - Memory usage trends

3. **Database Performance**:
   - Query execution time
   - Connection timeout events
   - Transaction success rate

4. **Admin Activity**:
   - Failed login attempts
   - Emergency cleanup usage
   - Session anomalies

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Pool Utilization | > 70% | > 90% |
| Redis Response Time | > 50ms | > 100ms |
| Database Query Time | > 1000ms | > 5000ms |
| Failed Login Attempts | > 3 | > 5 |
| Connection Leaks | > 0 | > 5 |

### Monitoring Tools
- **Real-time Dashboard**: Live system metrics
- **Alert System**: Automated notifications
- **Audit Trail**: Complete activity logging
- **Performance Analytics**: Historical trend analysis

---

## 🚀 Production Deployment

### Environment Configuration

```bash
# Required Environment Variables
ADMIN_USERNAME=admin
ADMIN_PASSWORD=[BCrypt hash]
ADMIN_JWT_SECRET=[256-bit secret]

# Optional Configuration
ADMIN_SESSION_TIMEOUT=86400  # 24 hours
ADMIN_RATE_LIMIT_ATTEMPTS=5
ADMIN_RATE_LIMIT_WINDOW=900  # 15 minutes
ADMIN_AUDIT_LOG_RETENTION=2592000  # 30 days
```

### Security Checklist

- [ ] Strong admin password (12+ characters, mixed case, numbers, symbols)
- [ ] Secure JWT secret (256-bit random) - **REQUIRED**
- [ ] HTTPS enabled for all admin endpoints
- [ ] Rate limiting configured and tested
- [ ] Audit logging enabled
- [ ] Redis secured with authentication
- [ ] Database connections encrypted
- [ ] No test endpoints in production environment
- [ ] Monitoring and alerting configured
- [ ] Emergency procedures documented
- [ ] **CRITICAL**: ADMIN_JWT_SECRET environment variable set

### Performance Tuning

```properties
# Connection Pool Configuration
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.idle-timeout=300000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.connection-timeout=30000

# Redis Configuration
spring.redis.timeout=2000ms
spring.redis.lettuce.pool.max-active=10
spring.redis.lettuce.pool.max-idle=8
spring.redis.lettuce.pool.min-idle=2
```

### Deployment Best Practices
1. **Environment Isolation**: Separate dev, staging, production
2. **Secret Management**: Use secure secret management systems
3. **Backup Procedures**: Regular database and configuration backups
4. **Monitoring Setup**: Comprehensive monitoring and alerting
5. **Documentation**: Keep procedures and contacts updated

---

## 🔧 Troubleshooting

### Common Issues

1. **Admin Login Fails**:
   - Check password hash generation
   - Verify environment variables
   - Check rate limiting status
   - Review audit logs

2. **Connection Pool Issues**:
   - Monitor pool metrics
   - Check for connection leaks
   - Review application logs
   - Consider emergency cleanup

3. **Redis Connectivity**:
   - Verify Redis server status
   - Check network connectivity
   - Review Redis configuration
   - Monitor memory usage

### Debug Commands

```bash
# Check system health
curl http://localhost:8080/api/health/summary

# Test admin authentication
curl -X POST http://localhost:8080/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "your-password"}'

# Check connection pool status
curl http://localhost:8080/api/health/connection-pool

# Check Redis health
curl http://localhost:8080/api/health/redis
```

### Error Resolution

| Error | Cause | Solution |
|-------|-------|----------|
| `Admin JWT secret not configured` | Missing environment variable | Set `ADMIN_JWT_SECRET` |
| `Authentication failed` | Invalid credentials | Check username/password |
| `Rate limit exceeded` | Too many login attempts | Wait 15 minutes or clear Redis |
| `Connection pool exhausted` | Database connection issues | Use emergency cleanup |
| `Redis connection failed` | Redis server down | Check Redis service |

---

## 🔄 Maintenance Procedures

### Regular Tasks

#### Weekly Maintenance
- [ ] Review audit logs for anomalies
- [ ] Check connection pool health metrics
- [ ] Monitor Redis performance trends
- [ ] Verify backup procedures are working
- [ ] Test emergency recovery procedures

#### Monthly Maintenance
- [ ] Rotate admin passwords
- [ ] Update JWT secrets
- [ ] Review security configurations
- [ ] Test emergency procedures
- [ ] Update monitoring thresholds

#### Quarterly Maintenance
- [ ] Comprehensive security audit
- [ ] Performance tuning and optimization
- [ ] Documentation updates
- [ ] Disaster recovery testing
- [ ] Compliance review

### Security Maintenance

#### Password Rotation
```bash
# Generate new password hash
./generate-admin-password.sh "NewSecurePassword123!"

# Update environment variable
export ADMIN_PASSWORD="$2a$12$[new_hash]"

# Restart application
./gradlew bootRun
```

#### JWT Secret Rotation
```bash
# Generate new JWT secret
openssl rand -base64 32

# Update environment variable
export ADMIN_JWT_SECRET="new-generated-secret"

# Restart application
./gradlew bootRun
```

#### Audit Log Management
- **Retention**: 30 days by default
- **Archival**: Move old logs to cold storage
- **Analysis**: Regular security event review
- **Compliance**: GDPR and SOC2 compliance

### Performance Optimization

#### Connection Pool Tuning
```properties
# For high-traffic environments
spring.datasource.hikari.maximum-pool-size=50
spring.datasource.hikari.minimum-idle=10

# For low-traffic environments
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=2
```

#### Redis Optimization
```properties
# Memory optimization
spring.redis.lettuce.pool.max-active=20
spring.redis.lettuce.pool.max-idle=15

# Connection optimization
spring.redis.timeout=1000ms
```

---

## 📚 Additional Resources

### Related Documentation
- [ShopGauge Architecture Overview](../ARCHITECTURE_SECURITY.md)
- [Multi-Session Architecture](../MULTI_SESSION_ARCHITECTURE.md)
- [Database Session Optimizations](../DATABASE_SESSION_OPTIMIZATIONS.md)
- [Environment Setup Guide](../ENVIRONMENT_SETUP.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

### External Resources
- [Spring Security Documentation](https://spring.io/projects/spring-security)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [BCrypt Security](https://en.wikipedia.org/wiki/Bcrypt)
- [Redis Security](https://redis.io/topics/security)

### Support Contacts
- **Technical Issues**: admin@shopgauge.com
- **Security Incidents**: security@shopgauge.com
- **Emergency**: +1-555-EMERGENCY

---

## 📝 Change Log

### Version 1.0.0 (January 2025)
- ✅ Initial enterprise-grade admin authentication system
- ✅ Comprehensive security features implementation
- ✅ Fail-fast security with proper error handling
- ✅ Complete documentation and procedures
- ✅ Production-ready deployment guide

### Security Updates
- ✅ Removed insecure JWT secret fallback
- ✅ Implemented fail-fast security validation
- ✅ Enhanced audit logging capabilities
- ✅ Improved rate limiting and lockout mechanisms

---

*Last Updated: January 2025*
*Version: 1.0.0*
*Status: Production Ready*
*Application: ShopGauge*
*Note: All test endpoints removed for production security* 