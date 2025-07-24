#!/bin/bash

# Test script to verify session invalidation fix
# This script tests the /api/sessions/limit-check endpoint to ensure it handles session invalidation gracefully

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
SHOP_DOMAIN="${SHOP_DOMAIN:-test-shop.myshopify.com}"

echo "🧪 Testing session invalidation fix..."
echo "API Base URL: $API_BASE_URL"
echo "Shop Domain: $SHOP_DOMAIN"

# Function to make authenticated request
make_request() {
    local endpoint="$1"
    local description="$2"
    
    echo "📡 Testing: $description"
    echo "   Endpoint: $endpoint"
    
    # Make request with shop cookie
    response=$(curl -s -w "\n%{http_code}" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -b "shop=$SHOP_DOMAIN" \
        "$API_BASE_URL$endpoint")
    
    # Extract status code and body
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    echo "   Status: $http_code"
    echo "   Response: $body"
    echo ""
    
    # Check for session invalidation errors
    if echo "$body" | grep -q "Session was invalidated"; then
        echo "❌ ERROR: Session invalidation error detected!"
        return 1
    elif [ "$http_code" = "401" ]; then
        if echo "$body" | grep -q "session_invalidated"; then
            echo "✅ SUCCESS: Session invalidation handled gracefully (401 with proper error message)"
        else
            echo "⚠️  WARNING: 401 response but not a session invalidation error"
        fi
    elif [ "$http_code" = "200" ]; then
        echo "✅ SUCCESS: Request completed successfully"
    else
        echo "⚠️  WARNING: Unexpected status code: $http_code"
    fi
    
    echo ""
}

# Test cases
echo "🔍 Running test cases..."

# Test 1: Basic session limit check
make_request "/api/sessions/limit-check" "Session limit check endpoint"

# Test 2: Health check endpoint
make_request "/api/sessions/health-check" "Session health check endpoint"

# Test 3: Current session info
make_request "/api/sessions/current" "Current session info endpoint"

echo "✅ Session invalidation fix test completed!"
echo ""
echo "📋 Summary:"
echo "- If you see 'Session invalidation handled gracefully' messages, the fix is working"
echo "- If you see 'Session invalidation error detected' messages, there's still an issue"
echo "- Check the application logs for detailed error information" 