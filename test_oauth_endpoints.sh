#!/bin/bash

# OAuth Endpoint Test Script for ShopGauge
# This script tests all OAuth endpoints to diagnose configuration issues

echo "=== ShopGauge OAuth Endpoint Test Script ==="
echo ""

# Configuration - Update these values as needed
API_BASE_URL="https://api.shopgaugeai.com"
FRONTEND_URL="https://www.shopgaugeai.com"
TEST_SHOP="test.myshopify.com"

echo "Configuration:"
echo "  API Base URL: $API_BASE_URL"
echo "  Frontend URL: $FRONTEND_URL"
echo "  Test Shop: $TEST_SHOP"
echo ""

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
        "SUCCESS")
            echo -e "${GREEN}✓ SUCCESS${NC}: $message"
            ;;
        "ERROR")
            echo -e "${RED}✗ ERROR${NC}: $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠ WARNING${NC}: $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ INFO${NC}: $message"
            ;;
    esac
}

# Test 1: Health Check
echo "=== Test 1: Health Check ==="
print_status "INFO" "Testing backend health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/health")
HTTP_STATUS=$(echo "$HEALTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    print_status "SUCCESS" "Backend is healthy"
    echo "Response: $RESPONSE_BODY"
else
    print_status "ERROR" "Backend health check failed (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 2: Debug Configuration
echo "=== Test 2: Debug Configuration ==="
print_status "INFO" "Checking OAuth configuration..."
CONFIG_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/debug-config")
HTTP_STATUS=$(echo "$CONFIG_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CONFIG_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    print_status "SUCCESS" "Configuration endpoint accessible"
    echo "Configuration: $RESPONSE_BODY"
else
    print_status "ERROR" "Configuration endpoint failed (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 3: Test Credentials
echo "=== Test 3: Test Credentials ==="
print_status "INFO" "Testing API credentials..."
CREDS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/test-credentials")
HTTP_STATUS=$(echo "$CREDS_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CREDS_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    print_status "SUCCESS" "Credentials test passed"
    echo "Response: $RESPONSE_BODY"
else
    print_status "ERROR" "Credentials test failed (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 4: Login Endpoint
echo "=== Test 4: Login Endpoint ==="
print_status "INFO" "Testing login endpoint with shop parameter..."
LOGIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/login?shop=$TEST_SHOP")
HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "302" ] || [ "$HTTP_STATUS" = "200" ]; then
    print_status "SUCCESS" "Login endpoint working (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
else
    print_status "ERROR" "Login endpoint failed (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 5: Install Endpoint
echo "=== Test 5: Install Endpoint ==="
print_status "INFO" "Testing install endpoint..."
INSTALL_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/install?shop=$TEST_SHOP")
HTTP_STATUS=$(echo "$INSTALL_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$INSTALL_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "302" ] || [ "$HTTP_STATUS" = "200" ]; then
    print_status "SUCCESS" "Install endpoint working (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
else
    print_status "ERROR" "Install endpoint failed (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 6: Callback Endpoint (without parameters - should show error)
echo "=== Test 6: Callback Endpoint (No Parameters) ==="
print_status "INFO" "Testing callback endpoint without parameters..."
CALLBACK_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/callback")
HTTP_STATUS=$(echo "$CALLBACK_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CALLBACK_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "400" ]; then
    print_status "SUCCESS" "Callback endpoint correctly rejects missing parameters (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
elif [ "$HTTP_STATUS" = "302" ]; then
    print_status "SUCCESS" "Callback endpoint redirecting (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
else
    print_status "WARNING" "Unexpected callback response (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 7: Callback Endpoint (with invalid parameters)
echo "=== Test 7: Callback Endpoint (Invalid Parameters) ==="
print_status "INFO" "Testing callback endpoint with invalid parameters..."
CALLBACK_INVALID_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/callback?shop=$TEST_SHOP&code=invalid_code&state=invalid_state")
HTTP_STATUS=$(echo "$CALLBACK_INVALID_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CALLBACK_INVALID_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "302" ]; then
    print_status "SUCCESS" "Callback endpoint redirecting with error (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
elif [ "$HTTP_STATUS" = "400" ]; then
    print_status "SUCCESS" "Callback endpoint correctly rejects invalid parameters (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
else
    print_status "WARNING" "Unexpected callback response with invalid params (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 8: Environment Debug
echo "=== Test 8: Environment Debug ==="
print_status "INFO" "Checking environment configuration..."
ENV_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/debug-environment")
HTTP_STATUS=$(echo "$ENV_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$ENV_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    print_status "SUCCESS" "Environment debug accessible"
    echo "Environment: $RESPONSE_BODY"
else
    print_status "ERROR" "Environment debug failed (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 9: CORS Preflight
echo "=== Test 9: CORS Preflight ==="
print_status "INFO" "Testing CORS configuration..."
CORS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -H "Origin: $FRONTEND_URL" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" -X OPTIONS "$API_BASE_URL/api/auth/shopify/callback")
HTTP_STATUS=$(echo "$CORS_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CORS_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
    print_status "SUCCESS" "CORS preflight successful (Status: $HTTP_STATUS)"
else
    print_status "WARNING" "CORS preflight may have issues (Status: $HTTP_STATUS)"
fi
echo ""

# Test 10: Frontend URL Test
echo "=== Test 10: Frontend URL Test ==="
print_status "INFO" "Testing frontend accessibility..."
FRONTEND_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$FRONTEND_URL")
HTTP_STATUS=$(echo "$FRONTEND_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    print_status "SUCCESS" "Frontend is accessible (Status: $HTTP_STATUS)"
else
    print_status "ERROR" "Frontend not accessible (Status: $HTTP_STATUS)"
fi
echo ""

# Summary
echo "=== Test Summary ==="
print_status "INFO" "OAuth endpoint testing completed"
echo ""
echo "Common issues to check:"
echo "1. Verify SHOPIFY_API_KEY and SHOPIFY_API_SECRET are set correctly"
echo "2. Check SHOPIFY_REDIRECT_URI matches your app configuration"
echo "3. Ensure SHOPIFY_SCOPES are properly configured"
echo "4. Verify FRONTEND_URL is correct"
echo "5. Check that your Shopify app is active and properly configured"
echo ""
echo "If you're getting 400 Bad Request errors:"
echo "- Check the response body for specific error messages"
echo "- Verify all required environment variables are set"
echo "- Ensure your Shopify app configuration matches the backend settings"
echo ""
echo "For debugging OAuth flow:"
echo "1. Check the Shopify Partner Dashboard app settings"
echo "2. Verify the redirect URI in your app configuration"
echo "3. Ensure the app has the correct scopes"
echo "4. Check that the app is not in development mode if testing with production URLs" 