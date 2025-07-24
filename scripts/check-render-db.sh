#!/bin/bash

echo "🔍 Render Database Connection Diagnostic"
echo "========================================"

# Check if we're in a Render environment
if [ -n "$RENDER" ]; then
    echo "✅ Running in Render environment"
else
    echo "⚠️  Not running in Render environment"
fi

echo ""
echo "📊 Environment Variables Check:"
echo "==============================="

# Database variables
echo "DB_URL: ${DB_URL:-'NOT SET'}"
echo "DB_USER: ${DB_USER:-'NOT SET'}"
echo "DB_PASS: ${DB_PASS:0:10}..." # Only show first 10 chars for security

# Extract host from DB_URL if available
if [ -n "$DB_URL" ]; then
    DB_HOST=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    echo "Extracted DB_HOST: $DB_HOST"
    
    # Test DNS resolution
    echo ""
    echo "🌐 DNS Resolution Test:"
    echo "======================"
    if nslookup "$DB_HOST" >/dev/null 2>&1; then
        echo "✅ DNS resolution successful for $DB_HOST"
    else
        echo "❌ DNS resolution failed for $DB_HOST"
        echo "This is likely the root cause of the connection issue"
    fi
else
    echo "❌ DB_URL not set - this is the problem!"
fi

echo ""
echo "🔧 Render Service Status:"
echo "========================"
echo "Check these in your Render Dashboard:"
echo "1. Database service (storesight-db) should be 'Live'"
echo "2. Backend service (storesight-backend) should be 'Live'"
echo "3. Redis service (storesight-redis) should be 'Live'"

echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Go to https://dashboard.render.com"
echo "2. Check if storesight-db is running"
echo "3. If not, restart the database service"
echo "4. Check the database connection string in environment variables"
echo "5. Restart the backend service after fixing database"

echo ""
echo "🔗 Useful Links:"
echo "================"
echo "Render Dashboard: https://dashboard.render.com"
echo "Database Service: https://dashboard.render.com/web/svc/storesight-db"
echo "Backend Service: https://dashboard.render.com/web/svc/storesight-backend" 