# Multi-stage build for better caching and smaller final image
FROM eclipse-temurin:17-jdk-alpine AS builder

# Install dependencies for better caching
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy Gradle wrapper and project files from backend directory in repository
# These change less frequently, so they get their own layer for better caching
COPY backend/gradlew ./gradlew
COPY backend/gradle ./gradle
COPY backend/build.gradle ./build.gradle
COPY backend/settings.gradle ./settings.gradle

# Make gradlew executable
RUN chmod +x ./gradlew

# Download dependencies first (better Docker layer caching)
# This step will be cached unless dependencies change
RUN ./gradlew dependencies --no-daemon --offline || true

# Copy source code (this layer changes more frequently)
COPY backend/src ./src

# Build the application with aggressive optimizations
# Use parallel builds, skip tests, and enable all caching options
ENV GRADLE_OPTS="-Xmx3072m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8 -Dorg.gradle.parallel=true -Dorg.gradle.caching=true -Dorg.gradle.configureondemand=true"
RUN ./gradlew clean build -x test -x spotlessCheck -x spotlessApply --no-daemon --build-cache --parallel --max-workers=4

# Final stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy the built jar from builder stage
COPY --from=builder /app/build/libs/*-SNAPSHOT.jar app.jar

# Expose port
EXPOSE 8080

# Run the application
CMD ["java", "-jar", "app.jar"] 