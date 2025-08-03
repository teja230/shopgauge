#!/bin/bash

# Debug script for Add Competitor issue on production
# This script helps test the API endpoints and identify the root cause

echo "🔍 ShopGauge Add Competitor Debug Script"
echo "========================================"

# Configuration
API_BASE_URL="${API_BASE_URL:-https://api.shopgaugeai.com}"
SHOP_DOMAIN="${SHOP_DOMAIN:-}"
TEST_URL="${TEST_URL:-https://example.com/product}"

if [ -z "$SHOP_DOMAIN" ]; then
    echo "❌ Error: SHOP_DOMAIN environment variable is required"
    echo "Usage: SHOP_DOMAIN=your-shop.myshopify.com ./debug-add-competitor.sh"
    exit 1
fi

echo "API Base URL: $API_BASE_URL"
echo "Shop Domain: $SHOP_DOMAIN"
echo "Test Competitor URL: $TEST_URL"
echo ""

# Function to make authenticated API calls
make_api_call() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="$3"
    
    echo "📡 Testing: $method $endpoint"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nRESPONSE_TIME:%{time_total}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -H "Cookie: shop=$SHOP_DOMAIN" \
            -d "$data" \
            "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nRESPONSE_TIME:%{time_total}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -H "Cookie: shop=$SHOP_DOMAIN" \
            "$API_BASE_URL$endpoint")
    fi
    
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    response_time=$(echo "$response" | grep "RESPONSE_TIME:" | cut -d: -f2)
    response_body=$(echo "$response" | sed '/HTTP_STATUS:/d' | sed '/RESPONSE_TIME:/d')
    
    echo "   Status: $http_status"
    echo "   Time: ${response_time}s"
    echo "   Response: $response_body"
    echo ""
    
    return $http_status
}

# Test 1: Check authentication
echo "🔐 Step 1: Testing Authentication"
make_api_call "/api/auth/shopify/me"
auth_status=$?

if [ $auth_status -ne 200 ]; then
    echo "❌ Authentication failed. Please ensure you're logged in to ShopGauge."
    echo "   Visit https://www.shopgaugeai.com and log in first."
    exit 1
fi

echo "✅ Authentication successful"
echo ""

# Test 2: Check products
echo "📦 Step 2: Testing Products Endpoint"
make_api_call "/api/analytics/products"
products_status=$?

if [ $products_status -ne 200 ]; then
    echo "⚠️  Products endpoint failed. This might cause PRODUCTS_SYNC_NEEDED error."
else
    echo "✅ Products endpoint working"
fi
echo ""

# Test 3: Check competitor limits
echo "📊 Step 3: Testing Competitor Limits"
make_api_call "/api/competitors/limits"
limits_status=$?

if [ $limits_status -ne 200 ]; then
    echo "⚠️  Limits endpoint failed."
else
    echo "✅ Limits endpoint working"
fi
echo ""

# Test 4: Get existing competitors
echo "🏪 Step 4: Testing Get Competitors"
make_api_call "/api/competitors"
get_competitors_status=$?

if [ $get_competitors_status -ne 200 ]; then
    echo "⚠️  Get competitors failed."
else
    echo "✅ Get competitors working"
fi
echo ""

# Test 5: Try to add a competitor
echo "➕ Step 5: Testing Add Competitor"
competitor_data="{\"url\":\"$TEST_URL\",\"productId\":\"\"}"
make_api_call "/api/competitors" "POST" "$competitor_data"
add_status=$?

case $add_status in
    200)
        echo "✅ Add competitor successful!"
        ;;
    400)
        echo "⚠️  Bad request - check the error message above"
        ;;
    401)
        echo "❌ Authentication failed during add competitor"
        ;;
    412)
        echo "⚠️  Products sync needed - this is the likely cause of the issue"
        echo "   Solution: User needs to visit Dashboard first to sync products"
        ;;
    429)
        echo "⚠️  Rate limited - too many requests"
        ;;
    500)
        echo "❌ Server error - check backend logs"
        ;;
    *)
        echo "❌ Unexpected status code: $add_status"
        ;;
esac

echo ""
echo "🔍 Debug Summary:"
echo "=================="
echo "Authentication: $([ $auth_status -eq 200 ] && echo "✅ OK" || echo "❌ FAILED")"
echo "Products: $([ $products_status -eq 200 ] && echo "✅ OK" || echo "❌ FAILED")"
echo "Limits: $([ $limits_status -eq 200 ] && echo "✅ OK" || echo "❌ FAILED")"
echo "Get Competitors: $([ $get_competitors_status -eq 200 ] && echo "✅ OK" || echo "❌ FAILED")"
echo "Add Competitor: $([ $add_status -eq 200 ] && echo "✅ OK" || echo "❌ FAILED ($add_status)")"

echo ""
echo "💡 Recommendations:"
if [ $add_status -eq 412 ]; then
    echo "- The issue is likely PRODUCTS_SYNC_NEEDED"
    echo "- Users need to visit their Dashboard first to sync products from Shopify"
    echo "- Consider auto-syncing products when users first access Market Intelligence"
elif [ $add_status -eq 401 ]; then
    echo "- Authentication is failing during the add competitor request"
    echo "- Check session management and cookie handling"
elif [ $add_status -eq 500 ]; then
    echo "- Server error occurred - check backend application logs"
    echo "- Look for database connection issues or missing dependencies"
else
    echo "- Check the specific error messages above for more details"
fi

echo ""
echo "🚀 To run this script:"
echo "SHOP_DOMAIN=your-shop.myshopify.com ./debug-add-competitor.sh"