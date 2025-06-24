# Use OpenJDK 17 as base image
FROM openjdk:17-jdk-slim

# Set working directory
WORKDIR /app

# Copy Gradle wrapper and project files from backend directory in repository
COPY backend/gradlew ./gradlew
COPY backend/gradle ./gradle
COPY backend/build.gradle ./build.gradle
COPY backend/settings.gradle ./settings.gradle

# Copy source code
COPY backend/src ./src

# Make gradlew executable
RUN chmod +x ./gradlew

# Build the application (skip tests for faster container build)
RUN ./gradlew build -x test

# Copy the built jar to a consistent location
RUN JAR_FILE=$(ls build/libs | grep '.jar$' | grep -v plain | head -n 1) && \
    cp "build/libs/${JAR_FILE}" app.jar

# Expose port
EXPOSE 8080

# Run the application
CMD ["java", "-jar", "app.jar"] 