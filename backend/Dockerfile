# Multi-stage build for better caching and smaller final image
FROM eclipse-temurin:17-jdk-alpine AS builder

# Set working directory
WORKDIR /app

# Copy Gradle wrapper and project files from backend directory in repository
COPY backend/gradlew ./gradlew
COPY backend/gradle ./gradle
COPY backend/build.gradle ./build.gradle
COPY backend/settings.gradle ./settings.gradle
COPY backend/pom.xml ./pom.xml

# Make gradlew executable
RUN chmod +x ./gradlew

# Download dependencies first (better Docker layer caching)
RUN ./gradlew dependencies --no-daemon || true

# Copy source code
COPY backend/src ./src

# Build the application (skip tests for faster container build)
# Use --no-daemon to avoid daemon-related issues in Docker
# Set JVM options for better memory management in Docker
ENV GRADLE_OPTS="-Xmx1024m -Dfile.encoding=UTF-8"
RUN ./gradlew clean build -x test --no-daemon

# Final stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy the built jar from builder stage
COPY --from=builder /app/build/libs/*-SNAPSHOT.jar app.jar

# Expose port
EXPOSE 8080

# Run the application
CMD ["java", "-jar", "app.jar"] 