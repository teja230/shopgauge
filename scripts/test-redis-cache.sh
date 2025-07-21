#!/bin/bash

# Test Redis Cache Behavior for StoreSight
# This script helps debug Redis cache issues on new login sessions

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
SHOP_DOMAIN="${SHOP_DOMAIN:-test-shop.myshopify.com}"

echo "🔍 Testing Redis Cache Behavior for StoreSight"
echo "=============================================="
echo "API Base URL: $API_BASE_URL"
echo "Shop Domain: $SHOP_DOMAIN"
echo ""

# Function to make authenticated request
make_request() {
    local endpoint="$1"
    local description="$2"
    
    echo "📡 Testing: $description"
    echo "Endpoint: $endpoint"
    
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Content-Type: application/json" \
        -H "Cookie: shop=$SHOP_DOMAIN" \
        "$API_BASE_URL$endpoint")
    
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    echo "Status: $http_status"
    echo "Response: $body"
    echo ""
}

# Test cache status endpoint
echo "🧪 Testing Cache Status Endpoint"
make_request "/api/analytics/cache/status" "Get Redis cache status"

# Test debug endpoint (if available)
echo "🔧 Testing Cache Debug Endpoint"
make_request "/api/analytics/cache/debug" "Get detailed cache debug info"

# Test revenue endpoint (should check Redis first)
echo "💰 Testing Revenue Endpoint (should check Redis first)"
make_request "/api/analytics/revenue" "Get revenue data (Redis-first)"

# Test products endpoint (should check Redis first)
echo "📦 Testing Products Endpoint (should check Redis first)"
make_request "/api/analytics/products" "Get products data (Redis-first)"

echo "✅ Redis cache behavior test completed!"
echo ""
echo "📊 Expected Behavior:"
echo "- New sessions should check Redis cache first"
echo "- If Redis has data, should return cached data"
echo "- If Redis has no data, should make API call and cache result"
echo "- Subsequent requests should use cached data"
echo ""
echo "🔍 Check the logs for cache hit/miss messages" 