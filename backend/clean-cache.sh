#!/bin/bash

# Script to clean Gradle and Spotless caches
# This helps resolve Spotless cache issues

echo "🧹 Cleaning Gradle and Spotless caches..."

# Remove Gradle configuration cache
if [ -d ".gradle/configuration-cache" ]; then
    echo "Removing Gradle configuration cache..."
    rm -rf .gradle/configuration-cache
fi

# Remove build directory
if [ -d "build" ]; then
    echo "Removing build directory..."
    rm -rf build
fi

# Remove any Spotless-related cache files
echo "Removing Spotless cache files..."
find .gradle -name "*spotless*" -type f -delete 2>/dev/null || true
find build -name "*spotless*" -type f -delete 2>/dev/null || true

echo "✅ Cache cleaning completed!"
echo ""
echo "You can now run:"
echo "  ./gradlew spotlessApply"
echo "  ./gradlew test"
echo "  ./gradlew bootRun" 