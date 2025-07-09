#!/bin/bash

# Admin Password Setup Script
# This script helps generate BCrypt hashes for admin passwords

set -e

echo "=== Storesight Admin Password Setup ==="
echo ""

# Check if password is provided as argument
if [ $# -eq 0 ]; then
    echo "Usage: $0 <admin_password>"
    echo ""
    echo "Example: $0 mySecurePassword123"
    echo ""
    echo "IMPORTANT: Use a strong password with:"
    echo "  - At least 12 characters"
    echo "  - Uppercase and lowercase letters"
    echo "  - Numbers and special characters"
    exit 1
fi

PASSWORD="$1"

# Validate password strength
if [ ${#PASSWORD} -lt 12 ]; then
    echo "❌ ERROR: Password must be at least 12 characters long"
    exit 1
fi

if ! echo "$PASSWORD" | grep -q '[A-Z]'; then
    echo "❌ ERROR: Password must contain at least one uppercase letter"
    exit 1
fi

if ! echo "$PASSWORD" | grep -q '[a-z]'; then
    echo "❌ ERROR: Password must contain at least one lowercase letter"
    exit 1
fi

if ! echo "$PASSWORD" | grep -q '[0-9]'; then
    echo "❌ ERROR: Password must contain at least one number"
    exit 1
fi

if ! echo "$PASSWORD" | grep -q '[!@#$%^&*(),.?":{}|<>]'; then
    echo "❌ ERROR: Password must contain at least one special character"
    exit 1
fi

echo "✅ Password strength validation passed"
echo ""

# Generate BCrypt hash
echo "Generating BCrypt hash..."
HASH=$(java -cp build/classes/java/main com.storesight.backend.util.PasswordUtil "$PASSWORD" 2>/dev/null | grep "BCrypt hash:" | cut -d' ' -f3)

if [ -z "$HASH" ]; then
    echo "❌ ERROR: Failed to generate hash. Make sure the project is compiled."
    echo "Run: ./gradlew compileJava"
    exit 1
fi

echo "✅ BCrypt hash generated successfully"
echo ""

# Generate JWT secret
echo "Generating JWT secret..."
JWT_SECRET=$(openssl rand -base64 64)

echo "=== Environment Variables Setup ==="
echo ""
echo "Add the following to your environment variables:"
echo ""
echo "export ADMIN_USERNAME=admin"
echo "export ADMIN_PASSWORD='$HASH'"
echo "export JWT_SECRET='$JWT_SECRET'"
echo ""
echo "Or add to your .env file:"
echo ""
echo "ADMIN_USERNAME=admin"
echo "ADMIN_PASSWORD=$HASH"
echo "JWT_SECRET=$JWT_SECRET"
echo ""
echo "=== Security Notes ==="
echo ""
echo "🔒 NEVER store the plain password in environment variables"
echo "🔒 Only use the BCrypt hash for ADMIN_PASSWORD"
echo "🔒 Keep your JWT_SECRET secure and rotate it regularly"
echo "🔒 Use HTTPS in production and set ADMIN_REQUIRE_HTTPS=true"
echo ""
echo "=== Testing ==="
echo ""
echo "To test the setup, you can use:"
echo "curl -X POST http://localhost:8080/api/admin/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\":\"admin\",\"password\":\"$PASSWORD\"}'"
echo ""
echo "✅ Setup complete!" 