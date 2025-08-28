#!/bin/bash

# Build script for backend deployment on Render
set -e

echo "🚀 Starting backend build process..."

# Check if we're in the right directory
if [ ! -f "backend/gradlew" ]; then
    echo "❌ Error: gradlew not found in backend directory"
    echo "Current directory: $(pwd)"
    echo "Contents:"
    ls -la
    exit 1
fi

# Navigate to backend directory
cd backend

echo "📁 Working directory: $(pwd)"
echo "🔧 Making gradlew executable..."
chmod +x gradlew

echo "📦 Building backend with Gradle..."
./gradlew clean build -x test -x spotlessCheck -x spotlessApply --no-daemon --build-cache --parallel --max-workers=4 --stacktrace

echo "✅ Backend build completed successfully!"
echo "📁 Build artifacts:"
ls -la build/libs/

# Copy the built jar to the expected location
JAR_FILE=$(find build/libs -name "*-SNAPSHOT.jar" -type f 2>/dev/null | head -n1)
if [ -n "$JAR_FILE" ] && [ -f "$JAR_FILE" ]; then
    echo "📋 Copying built jar: $JAR_FILE"
    cp "$JAR_FILE" app.jar
    echo "✅ Jar copied successfully"
else
    echo "❌ Error: Built jar not found in build/libs/"
    echo "Available files:"
    ls -la build/libs/ 2>/dev/null || echo "No build/libs directory found"
    exit 1
fi
