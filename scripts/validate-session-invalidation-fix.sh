#!/bin/bash

# Validation script for session invalidation fix
# This script tests the /api/sessions/limit-check endpoint to ensure it handles session invalidation gracefully

set -e

# Configuration - Update these for your Render environment
API_BASE_URL="${API_BASE_URL:-https://api.shopgaugeai.com}"
SHOP_DOMAIN="${SHOP_DOMAIN:-storesight.myshopify.com}"

echo "🧪 Validating session invalidation fix..."
echo "API Base URL: $API_BASE_URL"
echo "Shop Domain: $SHOP_DOMAIN"
echo ""

# Function to make authenticated request and check for session invalidation errors
test_endpoint() {
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
    body=$(echo "$response" | sed '$d')
    
    echo "   Status: $http_code"
    echo "   Response: $body"
    echo ""
    
    # Check for session invalidation errors
    if echo "$body" | grep -q "Session was invalidated"; then
        echo "❌ ERROR: Session invalidation error detected!"
        echo "   This indicates the fix is not working properly."
        return 1
    elif [ "$http_code" = "500" ]; then
        echo "❌ ERROR: HTTP 500 error detected!"
        echo "   This indicates the session invalidation is still causing server errors."
        return 1
    elif [ "$http_code" = "200" ]; then
        echo "✅ SUCCESS: Request completed successfully with 200 status"
        if echo "$body" | grep -q "session_invalidated"; then
            echo "⚠️  WARNING: Response contains session_invalidated message but status is 200"
            echo "   This might indicate the fix is working but returning wrong status"
        else
            echo "✅ SUCCESS: No session invalidation errors detected"
        fi
    else
        echo "⚠️  WARNING: Unexpected status code: $http_code"
        echo "   Expected 200 for successful requests"
    fi
    
    echo ""
}

# Function to check application logs for session invalidation handling
check_logs() {
    echo "📋 Checking for session invalidation handling in logs..."
    echo "   Look for these log messages in your application logs:"
    echo "   - 'Session invalidation error handled gracefully'"
    echo "   - 'Session invalidation occurred after successful response'"
    echo "   - 'Session was invalidated during limit check'"
    echo ""
}

# Test cases
echo "🔍 Running validation tests..."

# Test 1: Basic session limit check
test_endpoint "/api/sessions/limit-check" "Session limit check endpoint"

# Test 2: Health check endpoint
test_endpoint "/api/sessions/health-check" "Session health check endpoint"

# Test 3: Current session info
test_endpoint "/api/sessions/current" "Current session info endpoint"

# Check logs
check_logs

echo "✅ Session invalidation fix validation completed!"
echo ""
echo "📋 Summary:"
echo "- If you see 'SUCCESS' messages, the fix is working"
echo "- If you see 'ERROR' messages, the fix needs adjustment"
echo "- Check your application logs for session invalidation handling messages"
echo ""
echo "🔧 If issues persist:"
echo "1. Check that SessionErrorHandlingFilter is properly configured"
echo "2. Verify filter chain order in WebSecurityConfig"
echo "3. Ensure session invalidation errors are being caught and logged"
echo "4. Review application logs for detailed error information" 