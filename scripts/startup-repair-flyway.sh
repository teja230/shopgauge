#!/bin/bash

# Startup script to repair Flyway checksum issues before starting the application
set -e

echo "🔧 Starting Flyway repair and application startup process..."

# Check if we're in the right directory
if [ ! -f "backend/gradlew" ]; then
    echo "❌ Error: gradlew not found in backend directory"
    echo "Current directory: $(pwd)"
    exit 1
fi

cd backend

echo "📁 Working directory: $(pwd)"

# Function to repair Flyway checksum issues
repair_flyway() {
    echo "🔧 Attempting to repair Flyway checksum issues..."
    
    # Try to repair using Gradle
    if ./gradlew flywayRepair --no-daemon; then
        echo "✅ Flyway repair completed successfully"
        return 0
    else
        echo "⚠️  Gradle flywayRepair failed, trying alternative approach..."
        
        # Alternative: Use Flyway directly if available
        if command -v flyway &> /dev/null; then
            echo "🔧 Using system Flyway to repair..."
            flyway repair
            echo "✅ System Flyway repair completed"
            return 0
        else
            echo "❌ No Flyway repair method available"
            return 1
        fi
    fi
}

# Function to start the application
start_application() {
    echo "🚀 Starting the application..."
    
    # Use the same JVM settings as the Dockerfile
    case "${MEMORY_PROFILE:-512MB}" in
        "1GB")
            exec java -Xmx768m -Xms384m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:G1HeapRegionSize=16m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heapdump.hprof -XX:+UseStringDeduplication -XX:+UseCompressedOops -XX:+UseCompressedClassPointers -XX:MaxMetaspaceSize=256m -XX:CompressedClassSpaceSize=128m -XX:MaxDirectMemorySize=128m -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom -Dspring.profiles.active=prod -DMEMORY_PROFILE=1GB -jar build/libs/*-SNAPSHOT.jar
            ;;
        "2GB")
            exec java -Xmx1536m -Xms768m -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:G1HeapRegionSize=32m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heapdump.hprof -XX:+UseStringDeduplication -XX:+UseCompressedOops -XX:+UseCompressedClassPointers -XX:MaxMetaspaceSize=512m -XX:CompressedClassSpaceSize=256m -XX:MaxDirectMemorySize=256m -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom -Dspring.profiles.active=prod -DMEMORY_PROFILE=2GB -jar build/libs/*-SNAPSHOT.jar
            ;;
        *)
            exec java -Xmx380m -Xms200m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:G1HeapRegionSize=8m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heapdump.hprof -XX:+UseStringDeduplication -XX:+UseCompressedOops -XX:+UseCompressedClassPointers -XX:MaxMetaspaceSize=160m -XX:CompressedClassSpaceSize=64m -XX:MaxDirectMemorySize=64m -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom -Dspring.profiles.active=prod -DMEMORY_PROFILE=512MB -jar build/libs/*-SNAPSHOT.jar
            ;;
    esac
}

# Main execution flow
echo "🔍 Checking if application is already built..."
if [ ! -f "build/libs/*-SNAPSHOT.jar" ]; then
    echo "📦 Building application first..."
    ./gradlew clean build -x test -x spotlessCheck -x spotlessApply --no-daemon --build-cache --parallel --max-workers=4 --stacktrace
fi

# Try to repair Flyway issues
if repair_flyway; then
    echo "✅ Flyway repair successful, starting application..."
else
    echo "⚠️  Flyway repair failed, but continuing with application startup..."
    echo "   The application will attempt to handle checksum issues automatically."
fi

# Start the application
start_application
