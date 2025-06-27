# Environment Testing Guide

This guide explains how to test the OAuth flow and site functionality across different environments.

## Environment Profiles

### 1. Development (dev) - Local Testing
**Profile:** `dev` (default)
**Frontend:** `http://localhost:5173`
**Backend:** `http://localhost:8080`

**Setup:**
```bash
# No environment variable needed (dev is default)
# Or explicitly set:
export SPRING_PROFILES_ACTIVE=dev
```

**CORS Origins:** `http://localhost:5173`, `http://localhost:5174`, `http://127.0.0.1:5173`
**Features:**
- ✅ Debug endpoints enabled
- ✅ Detailed logging
- ✅ Higher rate limits (120 req/min)
- ✅ Localhost CORS allowed

**Testing OAuth:**
1. Start frontend: `cd frontend && npm run dev`
2. Start backend: `cd backend && ./gradlew bootRun`
3. Visit: `http://localhost:5173`
4. Test OAuth flow with localhost redirects

---

### 2. Staging (staging) - Pre-production Testing
**Profile:** `staging`
**Frontend:** `https://staging.shopgaugeai.com`
**Backend:** `https://api-staging.shopgaugeai.com`

**Setup:**
```bash
export SPRING_PROFILES_ACTIVE=staging
```

**CORS Origins:** `https://staging.shopgaugeai.com`, `https://www.staging.shopgaugeai.com`, `http://localhost:5173`
**Features:**
- ✅ Debug endpoints enabled (for testing)
- ✅ Moderate rate limits (100 req/min)
- ✅ Staging domain CORS allowed
- ✅ Localhost still allowed for testing

**Testing OAuth:**
1. Deploy to staging environment
2. Set `SPRING_PROFILES_ACTIVE=staging`
3. Configure Shopify app for staging domain
4. Test OAuth flow with staging redirects

---

### 3. Production (prod) - Live Environment
**Profile:** `prod`
**Frontend:** `https://www.shopgaugeai.com`
**Backend:** `https://api.shopgaugeai.com`

**Setup:**
```bash
export SPRING_PROFILES_ACTIVE=prod
```

**CORS Origins:** `https://www.shopgaugeai.com`, `https://shopgaugeai.com`
**Features:**
- ❌ Debug endpoints disabled
- ⚠️ Strict rate limits (60 req/min)
- 🔒 Production domain CORS only
- 🔒 Enhanced security features

**Testing OAuth:**
1. Deploy to production environment
2. Set `SPRING_PROFILES_ACTIVE=prod`
3. Configure Shopify app for production domain
4. Test OAuth flow with production redirects

---

## Shopify App Configuration

### Development
```javascript
// Shopify Partner Dashboard
App URL: http://localhost:5173
Allowed redirection URLs: 
- http://localhost:8080/api/auth/shopify/callback
- http://localhost:5173
```

### Staging
```javascript
// Shopify Partner Dashboard
App URL: https://staging.shopgaugeai.com
Allowed redirection URLs:
- https://api-staging.shopgaugeai.com/api/auth/shopify/callback
- https://staging.shopgaugeai.com
```

### Production
```javascript
// Shopify Partner Dashboard
App URL: https://www.shopgaugeai.com
Allowed redirection URLs:
- https://api.shopgaugeai.com/api/auth/shopify/callback
- https://www.shopgaugeai.com
```

---

## Environment Variables by Profile

### Development (dev)
```bash
SPRING_PROFILES_ACTIVE=dev
FRONTEND_URL=http://localhost:5173
SHOPIFY_REDIRECT_URI=http://localhost:8080/api/auth/shopify/callback
```

### Staging (staging)
```bash
SPRING_PROFILES_ACTIVE=staging
FRONTEND_URL=https://staging.shopgaugeai.com
SHOPIFY_REDIRECT_URI=https://api-staging.shopgaugeai.com/api/auth/shopify/callback
```

### Production (prod)
```bash
SPRING_PROFILES_ACTIVE=prod
FRONTEND_URL=https://www.shopgaugeai.com
SHOPIFY_REDIRECT_URI=https://api.shopgaugeai.com/api/auth/shopify/callback
```

---

## Testing Checklist

### OAuth Flow Testing
- [ ] Frontend loads without CORS errors
- [ ] "Connect Store" button works
- [ ] Redirects to Shopify OAuth
- [ ] OAuth callback processes successfully
- [ ] User is redirected back to frontend
- [ ] Dashboard loads with store data
- [ ] No infinite notification loops

### Security Testing
- [ ] Rate limiting works (test with rapid requests)
- [ ] Debug endpoints blocked in production
- [ ] Input validation blocks malicious requests
- [ ] CORS only allows configured origins
- [ ] Security headers are present

### Functionality Testing
- [ ] Dashboard metrics load
- [ ] Competitor discovery works
- [ ] Notifications system functions
- [ ] Admin features accessible
- [ ] Error handling works properly

---

## Troubleshooting

### CORS Errors
**Problem:** `Access to XMLHttpRequest has been blocked by CORS policy`

**Solutions:**
1. Check `SPRING_PROFILES_ACTIVE` is set correctly
2. Verify frontend URL is in allowed origins for the profile
3. Check `cors.allowed-origins` in application properties
4. Ensure backend is using the correct profile

### OAuth Redirect Errors
**Problem:** OAuth callback fails or redirects to wrong URL

**Solutions:**
1. Verify `SHOPIFY_REDIRECT_URI` matches profile
2. Check Shopify Partner Dashboard settings
3. Ensure `FRONTEND_URL` is correct for profile
4. Test with different Shopify stores

### Rate Limiting Issues
**Problem:** Getting 429 (Too Many Requests) errors

**Solutions:**
1. Check rate limit settings in profile properties
2. Verify `security.rate-limit.enabled` and `security.rate-limit.requests-per-minute`
3. Wait for rate limit window to reset
4. Consider increasing limits for testing environments

---

## Quick Commands

### Local Development
```bash
# Start backend with dev profile
cd backend && SPRING_PROFILES_ACTIVE=dev ./gradlew bootRun

# Start frontend
cd frontend && npm run dev

# Test OAuth flow
open http://localhost:5173
```

### Profile Testing
```bash
# Test with different profiles locally
SPRING_PROFILES_ACTIVE=dev ./gradlew bootRun
SPRING_PROFILES_ACTIVE=staging ./gradlew bootRun
SPRING_PROFILES_ACTIVE=prod ./gradlew bootRun
```

### Environment Verification
```bash
# Check current profile
curl http://localhost:8080/api/health

# Check CORS headers
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS http://localhost:8080/api/auth/shopify/me
``` 