# 🔍 Troubleshooting Guide

Welcome to the ShopGauge Troubleshooting Guide. This section contains issue resolution, fixes, and debugging guides for common problems.

## 📋 Contents

### 🔄 Session Management Issues

- **[Session Invalidation Fix](SESSION_INVALIDATION_FIX.md)** - Resolving session invalidation problems
- **[Session Invalidation Loop Fix](SESSION_INVALIDATION_LOOP_FIX.md)** - Breaking infinite invalidation loops
- **[Session Management Refresh Fix](SESSION_MANAGEMENT_REFRESH_FIX.md)** - Fixing session refresh issues

### 📡 Real-time Communication Issues

- **[SSE Refresh Loop Fix](SSE_REFRESH_LOOP_FIX.md)** - Server-sent events refresh loop resolution
- **[SSE Frontend-Backend Compatibility](SSE_FRONTEND_BACKEND_COMPATIBILITY.md)** - Integration compatibility issues

### 🧠 Market Intelligence Issues

- **[Market Intelligence Troubleshooting](MARKET_INTELLIGENCE_TROUBLESHOOTING.md)** - Comprehensive Market Intelligence fixes and diagnostics

### 🚀 Application Startup Issues

- **[Startup Optimization Fix](STARTUP_OPTIMIZATION_FIX.md)** - Resolution for resource contention and performance issues during application startup

### 🖥️ Admin Interface Issues

- **[Admin Tabs Refresh Fix](ADMIN_TABS_REFRESH_FIX.md)** - Admin interface tab refresh problems
- **[Transaction Monitoring Refresh Fix](TRANSACTION_MONITORING_REFRESH_FIX.md)** - Transaction monitoring refresh issues

---

## 🎯 Common Issues & Quick Fixes

### Session-Related Problems

| Issue | Symptoms | Quick Fix |
|-------|----------|-----------|
| **Session Loops** | Infinite refresh, high CPU usage | Check session invalidation logic |
| **Session Leaks** | Memory growth, slow performance | Review session cleanup procedures |
| **Authentication Failures** | Login issues, token errors | Verify JWT configuration and Redis connectivity |

### Real-time Communication Problems

| Issue | Symptoms | Quick Fix |
|-------|----------|-----------|
| **SSE Disconnections** | Missing real-time updates | Check network connectivity and SSE configuration |
| **Event Loop Issues** | High CPU, unresponsive UI | Review event handling and cleanup |
| **Connection Timeouts** | Intermittent disconnections | Adjust timeout settings and retry logic |

### Performance Issues

| Issue | Symptoms | Quick Fix |
|-------|----------|-----------|
| **Slow API Responses** | High response times | Check database queries and Redis cache |
| **Memory Leaks** | Increasing memory usage | Review session cleanup and object disposal |
| **Database Locks** | Slow queries, timeouts | Check for long-running transactions |

### Market Intelligence Issues

| Issue | Symptoms | Quick Fix |
|-------|----------|-----------|
| **Session Validation Warnings** | "Session validation failed but token exists" | Check session recovery service and authentication filter |
| **Database Cache Errors** | "Incorrect result size: expected 1, actual 0" | Check QueryResultCacheService configuration |
| **API /:splat Errors** | "No static resource api/:splat" | Verify render.yaml redirect rules |
| **Suggestions Not Displaying** | Market Intelligence shows count but no content | Check session recovery and API routing |

### Application Startup Issues

| Issue | Symptoms | Quick Fix |
|-------|----------|-----------|
| **High CPU Usage During Startup** | "Critical CPU usage detected: 100.00%" | Check startup optimization service and monitoring delays |
| **Slow Startup Time** | "Started in 73+ seconds" | Verify startup delay configurations |
| **System Health Failures** | "System health check failed with status: UNHEALTHY" | Check monitoring service startup delays |
| **Resource Contention** | High disk usage, session lock failures | Enable startup optimization and staggered monitoring |

---

## 🚀 Troubleshooting Process

### 1. **Identify the Issue**
- Review error logs and monitoring alerts
- Reproduce the issue in a controlled environment
- Gather relevant system metrics and user reports

### 2. **Diagnose the Root Cause**
- Check application logs for error patterns
- Review system metrics for performance anomalies
- Analyze database and cache performance

### 3. **Apply the Fix**
- Implement the appropriate solution from this guide
- Test the fix in a staging environment
- Deploy to production with monitoring

### 4. **Verify Resolution**
- Monitor system behavior after the fix
- Confirm the issue is resolved
- Update documentation and procedures

---

## 🛠️ Debugging Tools

### Application Logs
```bash
# View application logs
tail -f backend/app.log

# Search for specific errors
grep -i "error" backend/app.log | tail -20
```

### Health Checks
```bash
# Check application health
curl https://api.shopgaugeai.com/health

# Check detailed health status
curl https://api.shopgaugeai.com/actuator/health

# Check Market Intelligence health
curl https://api.shopgaugeai.com/api/admin/market-intelligence/health
```

### Database Queries
```sql
-- Check active sessions
SELECT COUNT(*) FROM shop_sessions WHERE is_active = true;

-- Check for stuck sessions
SELECT * FROM shop_sessions WHERE last_accessed_at < NOW() - INTERVAL '1 hour';
```

### Redis Cache
```bash
# Check Redis connectivity
redis-cli ping

# Monitor Redis commands
redis-cli monitor
```

### Market Intelligence Health Checks
```bash
# Check Market Intelligence health
curl https://api.shopgaugeai.com/api/admin/market-intelligence/health

# Check discovery configuration
curl https://api.shopgaugeai.com/api/competitors/discovery/config

# Check for session validation issues in logs
grep -i "session validation failed" backend/app.log
```

---

## 🎯 Target Audience

- **Developers** - Debugging application issues and implementing fixes
- **DevOps Engineers** - Resolving infrastructure and deployment issues
- **Support Teams** - Troubleshooting user-reported problems
- **Site Reliability Engineers** - Incident response and system recovery

## 📞 Escalation Process

1. **Level 1**: Check this troubleshooting guide and runbooks
2. **Level 2**: Review system logs and metrics for patterns
3. **Level 3**: Engage development team for code-level investigation
4. **Level 4**: Contact external service providers if needed

---

*For operational procedures, see the [Operations Guide](../operations/)*  
*For system architecture, see the [Architecture Guide](../architecture/)*