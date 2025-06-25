#!/bin/bash

# Comprehensive OAuth and Redis Analysis Script
# This script analyzes Redis keys, session behavior, and OAuth flow issues

echo "=== Comprehensive OAuth and Redis Analysis ==="
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
CYAN='\033[0;36m'
NC='\033[0m'

print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS") echo -e "${GREEN}✓ SUCCESS${NC}: $message" ;;
        "ERROR") echo -e "${RED}✗ ERROR${NC}: $message" ;;
        "WARNING") echo -e "${YELLOW}⚠ WARNING${NC}: $message" ;;
        "INFO") echo -e "${BLUE}ℹ INFO${NC}: $message" ;;
        "ANALYSIS") echo -e "${CYAN}🔍 ANALYSIS${NC}: $message" ;;
    esac
}

echo "Configuration:"
echo "  API Base URL: $API_BASE_URL"
echo "  Frontend URL: $FRONTEND_URL"
echo "  Test Shop: $TEST_SHOP"
echo ""

# Function to check Redis keys
check_redis_keys() {
    print_status "INFO" "Checking Redis for OAuth-related keys..."
    
    # Check for used OAuth codes
    echo "--- OAuth Used Codes ---"
    response=$(curl -s "$API_BASE_URL/api/auth/shopify/debug-oauth-state")
    if [[ $? -eq 0 ]]; then
        echo "$response" | jq -r '.used_codes_details[]? | "Code: \(.code_preview), Used: \(.age_minutes) min ago"' 2>/dev/null || echo "$response"
    else
        print_status "ERROR" "Failed to fetch OAuth state debug info"
    fi
    
    echo ""
    echo "--- Redis Keys Analysis (NEW) ---"
    
    # Use the new debug endpoint
    redis_debug=$(curl -s "$API_BASE_URL/api/auth/shopify/debug-redis-keys")
    if [[ $? -eq 0 ]]; then
        echo "Redis Debug Info:"
        echo "$redis_debug" | jq '.' 2>/dev/null || echo "$redis_debug"
    else
        print_status "ERROR" "Failed to fetch Redis debug info"
    fi
    
    echo ""
    echo "--- Redis Keys for Test Shop ---"
    
    # Check specific shop keys
    shop_debug=$(curl -s "$API_BASE_URL/api/auth/shopify/debug-redis-keys?shop=$TEST_SHOP")
    if [[ $? -eq 0 ]]; then
        echo "Shop-specific Redis Info:"
        echo "$shop_debug" | jq '.' 2>/dev/null || echo "$shop_debug"
    else
        print_status "ERROR" "Failed to fetch shop-specific Redis debug info"
    fi
    
    echo ""
}

# Function to simulate OAuth flow with detailed logging
simulate_oauth_flow() {
    print_status "INFO" "Simulating OAuth flow with detailed analysis..."
    
    echo "Step 1: Testing install endpoint"
    install_response=$(curl -s -w "HTTPSTATUS:%{http_code};REDIRECT:%{redirect_url}" \
        "$API_BASE_URL/api/auth/shopify/install?shop=$TEST_SHOP")
    
    http_status=$(echo "$install_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    redirect_url=$(echo "$install_response" | grep -o "REDIRECT:.*" | cut -d: -f2-)
    
    if [[ "$http_status" == "302" ]]; then
        print_status "SUCCESS" "Install endpoint working - HTTP $http_status"
        print_status "INFO" "Redirect URL: $redirect_url"
    else
        print_status "ERROR" "Install endpoint failed - HTTP $http_status"
        echo "Response: $install_response"
        return 1
    fi
    
    echo ""
    echo "Step 2: Analyzing callback endpoint behavior"
    
    # Test callback with missing parameters
    print_status "INFO" "Testing callback with missing parameters..."
    callback_response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        "$API_BASE_URL/api/auth/shopify/callback")
    
    callback_status=$(echo "$callback_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    callback_body=$(echo "$callback_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    print_status "INFO" "Callback (no params) - HTTP $callback_status"
    
    # Test callback with shop but no code
    print_status "INFO" "Testing callback with shop but no code..."
    callback_response2=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        "$API_BASE_URL/api/auth/shopify/callback?shop=$TEST_SHOP")
    
    callback_status2=$(echo "$callback_response2" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    print_status "INFO" "Callback (shop only) - HTTP $callback_status2"
    
    # Test callback with fake code (this should trigger the "code already used" logic)
    print_status "INFO" "Testing callback with fake authorization code..."
    fake_code="fake_test_code_$(date +%s)"
    callback_response3=$(curl -s -w "HTTPSTATUS:%{http_code};REDIRECT:%{redirect_url}" \
        "$API_BASE_URL/api/auth/shopify/callback?shop=$TEST_SHOP&code=$fake_code")
    
    callback_status3=$(echo "$callback_response3" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    callback_redirect3=$(echo "$callback_response3" | grep -o "REDIRECT:.*" | cut -d: -f2-)
    
    print_status "INFO" "Callback (fake code) - HTTP $callback_status3"
    if [[ -n "$callback_redirect3" ]]; then
        print_status "INFO" "Redirect URL: $callback_redirect3"
    fi
    
    echo ""
}

# Function to test session creation
test_session_behavior() {
    print_status "INFO" "Testing session creation and cookie behavior..."
    
    # Test cookie setting endpoint
    cookie_response=$(curl -s -c /tmp/test_cookies.txt -b /tmp/test_cookies.txt \
        -w "HTTPSTATUS:%{http_code}" \
        "$API_BASE_URL/api/auth/shopify/test-cookie?shop=$TEST_SHOP")
    
    cookie_status=$(echo "$cookie_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    cookie_body=$(echo "$cookie_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [[ "$cookie_status" == "200" ]]; then
        print_status "SUCCESS" "Cookie test endpoint working - HTTP $cookie_status"
        echo "Response: $cookie_body" | jq '.' 2>/dev/null || echo "$cookie_body"
        
        # Check what cookies were set
        if [[ -f /tmp/test_cookies.txt ]]; then
            echo ""
            print_status "INFO" "Cookies saved:"
            cat /tmp/test_cookies.txt | grep -v "^#" | while read line; do
                if [[ -n "$line" ]]; then
                    echo "  $line"
                fi
            done
        fi
    else
        print_status "ERROR" "Cookie test failed - HTTP $cookie_status"
        echo "Response: $cookie_body"
    fi
    
    echo ""
    
    # Clean up cookie file
    rm -f /tmp/test_cookies.txt
}

# Function to analyze the specific Redis key pattern mentioned
analyze_redis_pattern() {
    print_status "ANALYSIS" "Analyzing the Redis key pattern you mentioned..."
    
    echo "The key pattern 'shpua_a974f9c73c7ad8dd4d9cb3a257371bf0' suggests:"
    echo "  - This might be a Spring Session key (shpua = shopify user auth?)"
    echo "  - The hash 'a974f9c73c7ad8dd4d9cb3a257371bf0' could be a session ID or shop hash"
    echo ""
    
    print_status "INFO" "Expected Redis key patterns based on code analysis:"
    echo "  1. OAuth used codes: 'oauth:used_code:<code>'"
    echo "  2. Shop tokens: 'shop_token:<shop_domain>'"
    echo "  3. Shop tokens with session: 'shop_token:<shop_domain>:<session_id>'"
    echo "  4. Spring sessions: 'storesight:sessions:*'"
    echo ""
    
    print_status "WARNING" "The pattern you mentioned doesn't match expected patterns!"
    print_status "WARNING" "This suggests there might be:"
    echo "    - Session configuration issues"
    echo "    - Redis namespace conflicts"
    echo "    - Custom session handling creating unexpected keys"
    echo ""
}

# Function to provide recommendations
provide_recommendations() {
    print_status "ANALYSIS" "Key Issues Identified and Recommendations:"
    echo ""
    
    echo "🔍 ISSUE 1: Session and Redis Configuration"
    echo "   Problem: Multiple sessions created, inconsistent Redis keys"
    echo "   Root Cause: Spring Session + manual session handling conflict"
    echo "   Solution: Standardize on one session approach"
    echo ""
    
    echo "🔍 ISSUE 2: TTL Mismatch"
    echo "   Problem: OAuth codes TTL (5 min) vs shop tokens TTL (60 min) vs session TTL (60 min)"
    echo "   Root Cause: Different TTL values causing timing issues"
    echo "   Solution: Align TTL values appropriately"
    echo ""
    
    echo "🔍 ISSUE 3: 403 Access Denied"
    echo "   Problem: Authentication filter rejecting requests"
    echo "   Root Cause: Shop token not found due to session/Redis key issues"
    echo "   Solution: Fix session and token storage logic"
    echo ""
    
    echo "🔧 RECOMMENDED FIXES:"
    echo "   1. Set matching TTL for OAuth codes and shop tokens"
    echo "   2. Simplify session handling - use either Spring Session OR manual"
    echo "   3. Add Redis key debugging endpoints"
    echo "   4. Implement robust fallback authentication"
    echo "   5. Add session validation in authentication filter"
    echo ""
}

# Main execution
main() {
    check_redis_keys
    echo ""
    simulate_oauth_flow
    echo ""
    test_session_behavior
    echo ""
    analyze_redis_pattern
    echo ""
    provide_recommendations
}

# Run the analysis
main 