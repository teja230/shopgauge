#!/bin/bash

# Market Intelligence Diagnostic Script
# This script helps diagnose issues with the Market Intelligence feature

set -e

echo "🔍 Market Intelligence Diagnostic Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check if .env file exists
if [ -f "config/.env" ]; then
    print_status "INFO" "Loading environment from config/.env"
    source config/.env
else
    print_status "ERROR" "config/.env file not found"
    exit 1
fi

echo ""
echo "📋 Environment Variables Check"
echo "-----------------------------"

# Check required API keys
check_env_var() {
    local var_name=$1
    local value=${!var_name}
    local dummy_key="dummy_$(echo $var_name | tr '[:upper:]' '[:lower:]')_key"
    if [ -n "$value" ] && [ "$value" != "$dummy_key" ]; then
        print_status "OK" "$var_name is set"
    else
        print_status "ERROR" "$var_name is not set or is dummy value"
    fi
}

check_env_var "SCRAPINGDOG_KEY"
check_env_var "SERPER_KEY"
check_env_var "SERPAPI_KEY"

echo ""
echo "🔧 Discovery Configuration"
echo "-------------------------"

# Check discovery configuration
check_discovery_config() {
    local var_name=$1
    local value=${!var_name}
    if [ "$value" = "true" ]; then
        print_status "OK" "$var_name is enabled"
    else
        print_status "WARN" "$var_name is disabled"
    fi
}

check_discovery_config "DISCOVERY_ENABLED"
check_discovery_config "DISCOVERY_MULTI_SOURCE_ENABLED"
check_discovery_config "DISCOVERY_FALLBACK_ENABLED"

echo ""
echo "🗄️  Database Configuration"
echo "-------------------------"

# Check database configuration
if [ -n "$DB_URL" ]; then
    print_status "OK" "DB_URL is set"
    echo "   URL: $DB_URL"
else
    print_status "ERROR" "DB_URL is not set"
fi

if [ -n "$DB_USER" ]; then
    print_status "OK" "DB_USER is set"
else
    print_status "ERROR" "DB_USER is not set"
fi

if [ -n "$DB_PASS" ]; then
    print_status "OK" "DB_PASS is set"
else
    print_status "ERROR" "DB_PASS is not set"
fi

echo ""
echo "🔴 Redis Configuration"
echo "---------------------"

# Check Redis configuration
if [ -n "$REDIS_HOST" ]; then
    print_status "OK" "REDIS_HOST is set: $REDIS_HOST"
else
    print_status "WARN" "REDIS_HOST is not set, using localhost"
fi

if [ -n "$REDIS_PORT" ]; then
    print_status "OK" "REDIS_PORT is set: $REDIS_PORT"
else
    print_status "WARN" "REDIS_PORT is not set, using 6379"
fi

echo ""
echo "🌐 Network Connectivity Test"
echo "---------------------------"

# Test API connectivity
test_api_connectivity() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    
    print_status "INFO" "Testing $name connectivity..."
    
    if curl -s --connect-timeout 5 --max-time 10 -X "$method" "$url" > /dev/null 2>&1; then
        print_status "OK" "$name is reachable"
    else
        print_status "ERROR" "$name is not reachable"
    fi
}

# Test search provider APIs
test_api_connectivity "Scrapingdog API" "https://api.scrapingdog.com/google"
test_api_connectivity "Serper API" "https://google.serper.dev/search"
test_api_connectivity "SerpAPI" "https://serpapi.com/search.json"

echo ""
echo "🔍 Backend Health Check"
echo "----------------------"

# Check if backend is running
if curl -s --connect-timeout 5 "http://localhost:8080/actuator/health" > /dev/null 2>&1; then
    print_status "OK" "Backend is running on localhost:8080"
    
    # Test discovery config endpoint
    print_status "INFO" "Testing discovery config endpoint..."
    response=$(curl -s --connect-timeout 5 "http://localhost:8080/api/competitors/discovery/config" 2>/dev/null || echo "{}")
    
    if echo "$response" | grep -q '"enabled":true'; then
        print_status "OK" "Discovery service is enabled"
    else
        print_status "ERROR" "Discovery service is not enabled"
        echo "   Response: $response"
    fi
else
    print_status "ERROR" "Backend is not running on localhost:8080"
fi

echo ""
echo "📊 Summary"
echo "---------"

# Count issues
error_count=$(grep -c "❌" <<< "$(cat $0)")
warn_count=$(grep -c "⚠️" <<< "$(cat $0)")

if [ $error_count -eq 0 ]; then
    print_status "OK" "No critical issues found"
else
    print_status "ERROR" "Found $error_count critical issue(s)"
fi

if [ $warn_count -gt 0 ]; then
    print_status "WARN" "Found $warn_count warning(s)"
fi

echo ""
echo "🔧 Quick Fix Commands"
echo "-------------------"

echo "1. Restart backend with environment variables:"
echo "   source config/.env && cd backend && ./gradlew bootRun --args='--spring.profiles.active=prod'"
echo ""
echo "2. Test discovery config endpoint:"
echo "   curl -H 'Authorization: Bearer YOUR_TOKEN' 'https://your-domain.com/api/competitors/discovery/config'"
echo ""
echo "3. Check backend logs for discovery service initialization:"
echo "   tail -f backend/logs/application.log | grep -i discovery"
echo ""
echo "4. Test individual search providers:"
echo "   curl -X POST 'https://api.scrapingdog.com/google' -H 'Content-Type: application/json' -d '{\"api_key\":\"$SCRAPINGDOG_KEY\",\"q\":\"test\"}'"

echo ""
print_status "INFO" "For detailed troubleshooting, see: docs/troubleshooting/MARKET_INTELLIGENCE_TROUBLESHOOTING.md" 