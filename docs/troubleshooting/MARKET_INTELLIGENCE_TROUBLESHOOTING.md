# Market Intelligence Troubleshooting Guide

## Issue: Market Intelligence Live Mode - Unable to Add Competitors and Discovery Fails

### Problem Description
- Users cannot add competitors in Live mode
- Clicking "Discover" shows "Starting Discovery Process"
- Sends 3 config calls and then shows "Request processing error. Please try again."

### Root Cause Analysis

#### 1. Discovery Service Configuration Issues
The Market Intelligence feature requires valid API credentials for search providers:
- **Scrapingdog API** (Primary - Most cost-effective)
- **Serper API** (Secondary - Fast fallback)  
- **SerpAPI** (Tertiary - Google Shopping results)

#### 2. Search Client Initialization Problems
The `MultiSourceSearchClient` requires at least one enabled search provider to function.

#### 3. Environment Variable Configuration
API keys must be properly configured in environment variables.

### Diagnostic Steps

#### Step 1: Check Discovery Configuration
```bash
# Test the discovery config endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://your-domain.com/api/competitors/discovery/config"
```

Expected response when working:
```json
{
  "enabled": true,
  "configured": true,
  "intervalHours": 24,
  "maxResultsPerProduct": 10,
  "searchProvider": "MultiSource (Scrapingdog, Serper, SerpAPI)",
  "searchClientEnabled": true,
  "message": "Discovery service ready"
}
```

#### Step 2: Check Environment Variables
Verify these environment variables are set:
```bash
# Required API Keys
SCRAPINGDOG_KEY=your_scrapingdog_key
SERPER_KEY=your_serper_key
SERPAPI_KEY=your_serpapi_key

# Discovery Configuration
DISCOVERY_ENABLED=true
DISCOVERY_MULTI_SOURCE_ENABLED=true
DISCOVERY_FALLBACK_ENABLED=true
```

#### Step 3: Check Backend Logs
Look for these log messages:
```
INFO  - Initialized MultiSourceSearchClient with 3 providers: Scrapingdog, Serper, SerpAPI
ERROR - No search providers are enabled! Discovery will not work.
```

### Solutions

#### Solution 1: Fix API Credentials

1. **Get API Keys**:
   - [Scrapingdog](https://www.scrapingdog.com/) - $0.001 per search
   - [Serper](https://serper.dev/) - $0.001 per search  
   - [SerpAPI](https://serpapi.com/) - $0.015 per search

2. **Update Environment Variables**:
   ```bash
   # Add to your .env file or environment
   SCRAPINGDOG_KEY=your_actual_key_here
   SERPER_KEY=your_actual_key_here
   SERPAPI_KEY=your_actual_key_here
   ```

3. **Restart Backend Service**:
   ```bash
   # Restart your backend application
   sudo systemctl restart storesight-backend
   # or
   docker-compose restart backend
   ```

#### Solution 2: Verify Search Client Initialization

Check if search clients are properly initialized:

```java
// In your backend logs, look for:
"Initialized MultiSourceSearchClient with X providers: [provider names]"
```

If you see "No search providers are enabled", check:
- API keys are valid and not expired
- Network connectivity to search provider APIs
- Rate limits haven't been exceeded

#### Solution 3: Test Individual Providers

Test each provider individually:

```bash
# Test Scrapingdog
curl -X POST "https://api.scrapingdog.com/google" \
     -H "Content-Type: application/json" \
     -d '{"api_key":"YOUR_KEY","q":"test search"}'

# Test Serper  
curl -X POST "https://google.serper.dev/search" \
     -H "X-API-KEY: YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"q":"test search"}'

# Test SerpAPI
curl "https://serpapi.com/search.json?engine=google_shopping&q=test&api_key=YOUR_KEY"
```

#### Solution 4: Check Database Connectivity

Ensure the backend can connect to the database:

```bash
# Test database connection
psql "postgresql://username:password@host:port/database" -c "SELECT 1;"
```

#### Solution 5: Verify Redis Connection

Check Redis connectivity for caching:

```bash
# Test Redis connection
redis-cli -h your-redis-host -p 6379 ping
```

### Frontend Debugging

#### Check Browser Console
Open browser developer tools and look for:
- Network requests to `/api/competitors/discovery/config`
- Error responses with status codes
- JavaScript errors in the console

#### Common Frontend Errors
1. **401 Unauthorized**: Authentication token expired
2. **500 Internal Server Error**: Backend service issues
3. **503 Service Unavailable**: Discovery service not configured

### Production Deployment Checklist

#### Environment Variables
```bash
# Required for Market Intelligence
SCRAPINGDOG_KEY=valid_key
SERPER_KEY=valid_key  
SERPAPI_KEY=valid_key
DISCOVERY_ENABLED=true
DISCOVERY_MULTI_SOURCE_ENABLED=true
DISCOVERY_FALLBACK_ENABLED=true

# Database and Redis
DB_URL=jdbc:postgresql://host:port/database
DB_USER=username
DB_PASS=password
REDIS_HOST=redis-host
REDIS_PORT=6379
```

#### Service Health Checks
```bash
# Check backend health
curl "https://your-domain.com/actuator/health"

# Check discovery service specifically
curl "https://your-domain.com/api/admin/market-intelligence/health"
```

### Monitoring and Alerts

#### Key Metrics to Monitor
- Discovery API response times
- Search provider success rates
- API cost tracking
- Error rates for discovery endpoints

#### Alert Thresholds
- Discovery service unavailable for >5 minutes
- Search provider error rate >10%
- API cost exceeding daily budget

### Cost Optimization

#### Provider Priority (Lowest Cost First)
1. **Scrapingdog**: $0.001 per search
2. **Serper**: $0.001 per search  
3. **SerpAPI**: $0.015 per search

#### Budget Management
```bash
# Set daily budget limits
COST_OPTIMIZATION_DAILY_BUDGET=5.00
COST_OPTIMIZATION_MONTHLY_BUDGET=100.00
```

### Support Information

When contacting support, provide:
1. Backend logs showing discovery service initialization
2. Response from `/api/competitors/discovery/config` endpoint
3. Environment variable configuration (without actual keys)
4. Browser console errors
5. Network request/response details

### Quick Fix Commands

```bash
# Restart backend with proper environment
source .env && ./gradlew bootRun --args='--spring.profiles.active=prod'

# Check discovery service status
curl -H "Authorization: Bearer $TOKEN" \
     "https://your-domain.com/api/competitors/discovery/config"

# Test search providers
curl -X POST "https://api.scrapingdog.com/google" \
     -H "Content-Type: application/json" \
     -d '{"api_key":"$SCRAPINGDOG_KEY","q":"test"}'
```

---

## Recent Fixes and Enhancements

### Session Validation Issues (Fixed)

**Problem**: Sessions were being marked as invalid but the system was still allowing access, creating inconsistent behavior.

**Solution**: 
- Enhanced session validation logic in `ShopifyAuthenticationFilter`
- Added `SessionRecoveryService` for automatic session recovery
- Improved error handling for session validation failures

**Files Modified**:
- `backend/src/main/java/com/storesight/backend/config/ShopifyAuthenticationFilter.java`
- `backend/src/main/java/com/storesight/backend/service/SessionRecoveryService.java`

### Database Cache Issues (Fixed)

**Problem**: QueryResultCacheService was using `queryForObject()` which expects exactly one result, but empty tables returned 0 results.

**Solution**:
- Changed to `queryForList()` to handle empty tables gracefully
- Added proper error handling for database cache availability checks
- Improved fallback mechanisms for cache failures

**Files Modified**:
- `backend/src/main/java/com/storesight/backend/service/QueryResultCacheService.java`

### API /:splat Error (Fixed)

**Problem**: Frontend was making malformed requests to `/api/:splat` instead of proper API endpoints.

**Solution**:
- Fixed redirect configuration in `render.yaml`
- Enhanced error handling and logging

**Files Modified**:
- `render.yaml`
- `frontend/src/api.ts`

### Manual Diagnostic Steps

To diagnose Market Intelligence issues manually:

```bash
# Check backend health
curl https://api.shopgaugeai.com/actuator/health

# Check Market Intelligence health
curl https://api.shopgaugeai.com/api/admin/market-intelligence/health

# Check database connectivity (if local)
psql -h localhost -U postgres -d storesight -c "SELECT 1;"

# Check Redis connectivity (if local)
redis-cli ping
```

### Expected Behavior After Fixes

1. **No more session validation warnings** in logs
2. **Database cache working properly** without "Incorrect result size" errors
3. **No more `/api/:splat` errors** in backend logs
4. **Market Intelligence suggestions displaying correctly**
5. **Proper API routing** to backend endpoints 