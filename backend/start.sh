#!/bin/sh

# Production startup script for StoreSight Backend
# This script handles environment-specific configuration loading

echo "Starting StoreSight Backend..."
echo "Environment: ${SPRING_PROFILES_ACTIVE:-dev}"

# Set default profile if not specified
export SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE:-prod}

# Load environment-specific configuration
if [ "$SPRING_PROFILES_ACTIVE" = "prod" ]; then
    echo "Loading production configuration..."
    if [ -f "/app/config/.env.prod" ]; then
        echo "Found production environment file"
        export $(grep -v '^#' /app/config/.env.prod | xargs)
    elif [ -f "/app/config/.env" ]; then
        echo "Using default environment file"
        export $(grep -v '^#' /app/config/.env | xargs)
    fi
else
    echo "Loading development configuration..."
    if [ -f "/app/config/.env.local" ]; then
        export $(grep -v '^#' /app/config/.env.local | xargs)
    fi
fi

# Validate critical environment variables
echo "Validating environment variables..."

# Database validation
if [ -z "$DB_URL" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
    echo "ERROR: Database configuration is incomplete"
    echo "DB_URL: ${DB_URL:-NOT_SET}"
    echo "DB_USER: ${DB_USER:-NOT_SET}"
    echo "DB_PASS: ${DB_PASS:+SET}"
    exit 1
fi

# Redis validation
if [ -z "$REDIS_HOST" ]; then
    echo "ERROR: Redis configuration is incomplete"
    echo "REDIS_HOST: ${REDIS_HOST:-NOT_SET}"
    exit 1
fi

echo "Environment validation passed"
echo "Database URL: $DB_URL"
echo "Redis Host: $REDIS_HOST"
echo "Server Port: ${SERVER_PORT:-8080}"

# Start the application with optimized JVM settings
exec java \
    -Xmx1024m \
    -XX:+UseG1GC \
    -XX:MaxGCPauseMillis=200 \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/tmp/heapdump.hprof \
    -Dspring.profiles.active=$SPRING_PROFILES_ACTIVE \
    -Dserver.port=${SERVER_PORT:-8080} \
    -Djava.security.egd=file:/dev/./urandom \
    -jar app.jar