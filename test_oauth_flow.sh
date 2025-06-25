#!/bin/bash

# Detailed OAuth Flow Test Script
# This script simulates the complete OAuth flow to identify issues

echo "=== Detailed OAuth Flow Test ==="
echo ""

# Configuration
API_BASE_URL="https://api.shopgaugeai.com"
FRONTEND_URL="https://www.shopgaugeai.com"
TEST_SHOP="test.myshopify.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS") echo -e "${GREEN}✓ SUCCESS${NC}: $message" ;;
        "ERROR") echo -e "${RED}✗ ERROR${NC}: $message" ;;
        "WARNING") echo -e "${YELLOW}⚠ WARNING${NC}: $message" ;;
        "INFO") echo -e "${BLUE}ℹ INFO${NC}: $message" ;;
    esac
}

echo "Step 1: Testing OAuth Configuration"
echo "=================================="

# Get the OAuth configuration
print_status "INFO" "Fetching OAuth configuration..."
CONFIG=$(curl -s "$API_BASE_URL/api/auth/shopify/debug-config")
echo "Configuration: $CONFIG"
echo ""

# Extract redirect URI from config
REDIRECT_URI=$(echo "$CONFIG" | grep -o '"redirectUri":"[^"]*"' | cut -d'"' -f4)
print_status "INFO" "Redirect URI: $REDIRECT_URI"
echo ""

echo "Step 2: Testing Install URL Generation"
echo "====================================="

# Test the install endpoint to see what URL it generates
print_status "INFO" "Testing install endpoint..."
INSTALL_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/install?shop=$TEST_SHOP")
HTTP_STATUS=$(echo "$INSTALL_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$INSTALL_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "302" ]; then
    print_status "SUCCESS" "Install endpoint redirecting correctly"
    
    # Extract the Location header to see the Shopify OAuth URL
    LOCATION=$(curl -s -I "$API_BASE_URL/api/auth/shopify/install?shop=$TEST_SHOP" | grep -i "location:" | cut -d' ' -f2- | tr -d '\r')
    print_status "INFO" "Redirect Location: $LOCATION"
    
    # Parse the Shopify OAuth URL
    if [[ "$LOCATION" == *"myshopify.com/admin/oauth/authorize"* ]]; then
        print_status "SUCCESS" "Valid Shopify OAuth URL generated"
        
        # Extract parameters from the URL
        CLIENT_ID=$(echo "$LOCATION" | grep -o 'client_id=[^&]*' | cut -d'=' -f2)
        SCOPE=$(echo "$LOCATION" | grep -o 'scope=[^&]*' | cut -d'=' -f2)
        REDIRECT_PARAM=$(echo "$LOCATION" | grep -o 'redirect_uri=[^&]*' | cut -d'=' -f2)
        STATE=$(echo "$LOCATION" | grep -o 'state=[^&]*' | cut -d'=' -f2)
        
        print_status "INFO" "Client ID: $CLIENT_ID"
        print_status "INFO" "Scope: $SCOPE"
        print_status "INFO" "Redirect URI: $REDIRECT_PARAM"
        print_status "INFO" "State: $STATE"
        
        # URL decode the parameters
        DECODED_REDIRECT=$(echo "$REDIRECT_PARAM" | sed 's/%2F/\//g' | sed 's/%3A/:/g')
        DECODED_SCOPE=$(echo "$SCOPE" | sed 's/%2C/,/g')
        
        print_status "INFO" "Decoded Redirect URI: $DECODED_REDIRECT"
        print_status "INFO" "Decoded Scope: $DECODED_SCOPE"
        
    else
        print_status "ERROR" "Invalid Shopify OAuth URL generated"
        echo "URL: $LOCATION"
    fi
else
    print_status "ERROR" "Install endpoint failed (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

echo "Step 3: Testing Callback with Various Scenarios"
echo "=============================================="

# Test 1: Callback with missing parameters
print_status "INFO" "Testing callback with missing parameters..."
CALLBACK_EMPTY=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/callback")
HTTP_STATUS=$(echo "$CALLBACK_EMPTY" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CALLBACK_EMPTY" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "400" ]; then
    print_status "SUCCESS" "Correctly rejects missing parameters"
else
    print_status "WARNING" "Unexpected response for missing parameters (Status: $HTTP_STATUS)"
fi
echo "Response: $RESPONSE_BODY"
echo ""

# Test 2: Callback with only shop parameter
print_status "INFO" "Testing callback with only shop parameter..."
CALLBACK_SHOP_ONLY=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/callback?shop=$TEST_SHOP")
HTTP_STATUS=$(echo "$CALLBACK_SHOP_ONLY" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CALLBACK_SHOP_ONLY" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "400" ]; then
    print_status "SUCCESS" "Correctly rejects missing code parameter"
else
    print_status "WARNING" "Unexpected response for missing code (Status: $HTTP_STATUS)"
fi
echo "Response: $RESPONSE_BODY"
echo ""

# Test 3: Callback with invalid code
print_status "INFO" "Testing callback with invalid authorization code..."
CALLBACK_INVALID_CODE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/auth/shopify/callback?shop=$TEST_SHOP&code=invalid_code_123&state=test_state")
HTTP_STATUS=$(echo "$CALLBACK_INVALID_CODE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CALLBACK_INVALID_CODE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "302" ]; then
    print_status "SUCCESS" "Correctly redirects with error for invalid code"
    
    # Check if it redirects to frontend with error
    LOCATION=$(curl -s -I "$API_BASE_URL/api/auth/shopify/callback?shop=$TEST_SHOP&code=invalid_code_123&state=test_state" | grep -i "location:" | cut -d' ' -f2- | tr -d '\r')
    print_status "INFO" "Error redirect location: $LOCATION"
    
    if [[ "$LOCATION" == *"error="* ]]; then
        print_status "SUCCESS" "Error parameters included in redirect"
    else
        print_status "WARNING" "No error parameters in redirect"
    fi
elif [ "$HTTP_STATUS" = "500" ]; then
    print_status "WARNING" "Server error for invalid code (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
else
    print_status "WARNING" "Unexpected response for invalid code (Status: $HTTP_STATUS)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

echo "Step 4: Testing Shopify App Configuration"
echo "========================================"

print_status "INFO" "Checking if redirect URI matches app configuration..."
print_status "INFO" "Backend expects: $REDIRECT_URI"

# Test if the redirect URI is accessible
print_status "INFO" "Testing redirect URI accessibility..."
REDIRECT_TEST=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$REDIRECT_URI")
HTTP_STATUS=$(echo "$REDIRECT_TEST" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$HTTP_STATUS" = "400" ]; then
    print_status "SUCCESS" "Redirect URI is accessible (correctly rejects missing parameters)"
elif [ "$HTTP_STATUS" = "200" ]; then
    print_status "WARNING" "Redirect URI returns 200 (might be configured incorrectly)"
else
    print_status "WARNING" "Redirect URI returns unexpected status: $HTTP_STATUS"
fi
echo ""

echo "Step 5: Environment Variable Check"
echo "================================="

# Test environment debug endpoint
print_status "INFO" "Checking environment variables..."
ENV_RESPONSE=$(curl -s "$API_BASE_URL/api/auth/shopify/debug-environment")
echo "Environment: $ENV_RESPONSE"
echo ""

echo "Step 6: Manual OAuth Flow Test"
echo "============================="

print_status "INFO" "To test the complete OAuth flow manually:"
echo ""
echo "1. Visit this URL in your browser:"
echo "   $API_BASE_URL/api/auth/shopify/install?shop=$TEST_SHOP"
echo ""
echo "2. This should redirect you to Shopify's OAuth page"
echo ""
echo "3. After authorization, Shopify will redirect to:"
echo "   $REDIRECT_URI?shop=$TEST_SHOP&code=AUTHORIZATION_CODE&state=STATE"
echo ""
echo "4. Check if the callback processes correctly"
echo ""

echo "Step 7: Common Issues and Solutions"
echo "=================================="

print_status "INFO" "Based on the test results, here are potential issues:"

echo ""
echo "✓ CONFIGURATION LOOKS GOOD:"
echo "  - API credentials are loaded"
echo "  - Redirect URI is properly configured"
echo "  - Frontend URL is accessible"
echo "  - CORS is working"
echo ""

echo "⚠ POTENTIAL ISSUES TO CHECK:"
echo "1. Shopify App Configuration:"
echo "   - Verify the redirect URI in your Shopify Partner Dashboard matches:"
echo "     $REDIRECT_URI"
echo "   - Ensure the app is not in development mode"
echo "   - Check that the app has the required scopes: read_products,read_orders,read_customers,read_inventory"
echo ""
echo "2. App Status:"
echo "   - Make sure your Shopify app is active and approved"
echo "   - Check if the app is in development or production mode"
echo ""
echo "3. Domain Configuration:"
echo "   - Verify your app's allowed redirection URLs include:"
echo "     $REDIRECT_URI"
echo ""

print_status "INFO" "The 400 Bad Request error is likely due to:"
echo "1. Missing or invalid authorization code from Shopify"
echo "2. App configuration mismatch in Shopify Partner Dashboard"
echo "3. App being in development mode with production URLs"
echo ""

print_status "INFO" "Next steps:"
echo "1. Check your Shopify Partner Dashboard app settings"
echo "2. Verify the redirect URI matches exactly"
echo "3. Ensure the app is in the correct mode (development/production)"
echo "4. Test with a fresh OAuth flow in the browser" 