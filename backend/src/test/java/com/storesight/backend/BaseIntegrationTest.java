package com.storesight.backend;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Test configuration for integration tests using TestContainers. This provides real PostgreSQL and
 * Redis instances for testing.
 *
 * <p>Usage: Extend this class in your test classes that need real database connections.
 */
public abstract class BaseIntegrationTest {

  // PostgreSQL TestContainer - starts a real PostgreSQL instance
  static PostgreSQLContainer<?> postgres =
      new PostgreSQLContainer<>(DockerImageName.parse("postgres:16"))
          .withDatabaseName("storesight_test")
          .withUsername("test")
          .withPassword("test");

  // Redis TestContainer - starts a real Redis instance
  static GenericContainer<?> redis =
      new GenericContainer<>(DockerImageName.parse("redis:7")).withExposedPorts(6379);

  static {
    try {
      // Start containers before any tests run
      System.out.println("Starting PostgreSQL container...");
      postgres.start();
      System.out.println("PostgreSQL container started successfully on port: " + postgres.getMappedPort(5432));
      
      System.out.println("Starting Redis container...");
      redis.start();
      System.out.println("Redis container started successfully on port: " + redis.getMappedPort(6379));
      
      System.out.println("All test containers started successfully!");
    } catch (Exception e) {
      System.err.println("Failed to start test containers: " + e.getMessage());
      e.printStackTrace();
      throw new RuntimeException("Test containers failed to start", e);
    }
  }

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    try {
      // Configure Spring to use the TestContainer databases
      registry.add("spring.datasource.url", postgres::getJdbcUrl);
      registry.add("spring.datasource.username", postgres::getUsername);
      registry.add("spring.datasource.password", postgres::getPassword);
      registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
      registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
      registry.add("spring.jpa.database", () -> "postgresql");
      registry.add("spring.data.redis.host", redis::getHost);
      registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
      registry.add("spring.redis.host", redis::getHost);
      registry.add("spring.redis.port", () -> redis.getMappedPort(6379));
      // Disable logback configuration for tests
      registry.add("logging.config", () -> "");
      // Disable Flyway for integration tests to prevent migration issues
      registry.add("spring.flyway.enabled", () -> "false");
      registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
      
      System.out.println("Dynamic properties configured successfully");
    } catch (Exception e) {
      System.err.println("Failed to configure dynamic properties: " + e.getMessage());
      e.printStackTrace();
      throw new RuntimeException("Failed to configure test properties", e);
    }
  }
}
