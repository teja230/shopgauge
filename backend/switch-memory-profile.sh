#!/bin/bash

# ShopGauge Memory Profile Switcher
# Quick utility to switch between memory profiles

echo "🔧 Memory Profile Switcher"
echo "========================="

# Show current profile if exists
if [ -f ".env" ] && grep -q "MEMORY_PROFILE" .env; then
    CURRENT=$(grep "MEMORY_PROFILE" .env | cut -d'=' -f2)
    echo "Current profile: $CURRENT"
else
    echo "Current profile: 512MB (default)"
fi

echo ""
echo "Available profiles:"
echo "1) 512MB - For Render Starter (throttling enabled)"
echo "2) 1GB   - For Render Pro (recommended)"  
echo "3) 2GB   - For high-traffic sites"
echo ""

read -p "Select profile (1-3): " choice

case $choice in
    1) PROFILE="512MB" ;;
    2) PROFILE="1GB" ;;
    3) PROFILE="2GB" ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

# Update .env file
if [ ! -f ".env" ]; then
    echo "# ShopGauge Configuration" > .env
fi

grep -v "MEMORY_PROFILE" .env > .env.tmp 2>/dev/null || touch .env.tmp
echo "MEMORY_PROFILE=$PROFILE" >> .env.tmp
mv .env.tmp .env

echo "✅ Set to $PROFILE profile"
echo ""
echo "Next steps:"
echo "• Local: export MEMORY_PROFILE=$PROFILE && ./gradlew bootRun"
echo "• Render: Set MEMORY_PROFILE=$PROFILE in environment variables"
echo "• Verify: curl /api/health/memory-profile"
echo ""
echo "📖 For details, see: docs/operations/resource-optimization.md"