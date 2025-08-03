# Render Database Connection Fix

## 🚨 **Issue Summary**

The backend is failing to start in production due to database connectivity issues:

```
Caused by: java.net.UnknownHostException: ***REDACTED_DB_HOST***
```

## 🔍 **Root Cause Analysis**

The error indicates that the PostgreSQL database host `***REDACTED_DB_HOST***` is not reachable. This is typically caused by:

1. **Database Service Down**: The Render database service is not running
2. **DNS Resolution Failure**: The hostname cannot be resolved
3. **Environment Variables Missing**: Database connection variables are not set
4. **Network Configuration**: Firewall or network issues

## 🛠️ **Immediate Fix Steps**

### **Step 1: Check Render Dashboard**

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Navigate to Services**: Look for your services
3. **Check Database Status**: Find `storesight-db` service
4. **Verify Status**: Should show "Live" status

### **Step 2: Restart Database Service**

If the database is not running:

1. **Click on `storesight-db`** service
2. **Click "Manual Deploy"** or "Restart"
3. **Wait for deployment** to complete
4. **Verify status** shows "Live"

### **Step 3: Check Environment Variables**

1. **Go to `storesight-backend`** service
2. **Click "Environment"** tab
3. **Verify these variables exist**:
   - `DB_URL` - Should contain the database connection string
   - `DB_USER` - Database username
   - `DB_PASS` - Database password
   - `SPRING_PROFILES_ACTIVE` - Should be "prod"

### **Step 4: Restart Backend Service**

After fixing the database:

1. **Go to `storesight-backend`** service
2. **Click "Manual Deploy"** or "Restart"
3. **Monitor logs** for successful startup

## 🔧 **Advanced Troubleshooting**

### **Check Database Connection String**

The `DB_URL` should look like:
```
postgresql://username:password@host:port/database
```

Example:
```
postgresql://storesight_user:password@***REDACTED_DB_HOST***:5432/storesight
```

### **Verify Database Credentials**

1. **Check `DB_USER`**: Should match the database username
2. **Check `DB_PASS`**: Should be the correct password
3. **Test Connection**: Use the connection string in a database client

### **Network Configuration**

1. **Check IP Allow List**: Ensure database allows connections from backend
2. **Verify Region**: Both services should be in the same region (Oregon)
3. **Check Firewall**: No firewall rules blocking connections

## 📋 **Diagnostic Commands**

### **Run Diagnostic Script**

```bash
# Run the diagnostic script
./scripts/check-render-db.sh
```

### **Check Environment Variables**

```bash
# Check if DB_URL is set
echo $DB_URL

# Check database host
echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p'

# Test DNS resolution
nslookup ***REDACTED_DB_HOST***
```

## 🚀 **Prevention Measures**

### **Database Monitoring**

1. **Enable Health Checks**: Ensure database has health check endpoint
2. **Set Up Alerts**: Configure alerts for database downtime
3. **Regular Backups**: Ensure database backups are configured

### **Connection Pool Optimization**

The current configuration in `application-prod.properties`:

```properties
# Optimized for 2x512MB instances
spring.datasource.hikari.maximum-pool-size=6
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.connection-timeout=10000
```

### **Retry Configuration**

Add retry logic for database connections:

```properties
# Database retry settings
spring.datasource.hikari.connection-test-query=SELECT 1
spring.datasource.hikari.validation-timeout=2000
spring.datasource.hikari.leak-detection-threshold=20000
```

## 🔗 **Useful Links**

- **Render Dashboard**: https://dashboard.render.com
- **Database Service**: https://dashboard.render.com/web/svc/storesight-db
- **Backend Service**: https://dashboard.render.com/web/svc/storesight-backend
- **Render Documentation**: https://render.com/docs

## 📞 **Support**

If the issue persists:

1. **Check Render Status**: https://status.render.com
2. **Review Render Logs**: Check service logs for detailed error messages
3. **Contact Render Support**: If it's a Render infrastructure issue

## ✅ **Verification Checklist**

- [ ] Database service shows "Live" status
- [ ] Environment variables are correctly set
- [ ] Backend service starts successfully
- [ ] Health check endpoint responds
- [ ] Login functionality works
- [ ] API endpoints are accessible

## 🎯 **Expected Outcome**

After following these steps, the backend should start successfully and the login functionality should work properly. The database connection error should be resolved. 