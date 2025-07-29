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
 * Falls back to in-memory databases if Docker is not available.
 */
public abstract class BaseIntegrationTest {

  // Check if Docker is available
  private static final boolean DOCKER_AVAILABLE = isDockerAvailable();

  // PostgreSQL TestContainer - starts a real PostgreSQL instance
  static PostgreSQLContainer<?> postgres = DOCKER_AVAILABLE 
      ? new PostgreSQLContainer<>(DockerImageName.parse("postgres:16"))
          .withDatabaseName("storesight_test")
          .withUsername("test")
          .withPassword("test")
      : null;

  // Redis TestContainer - starts a real Redis instance
  static GenericContainer<?> redis = DOCKER_AVAILABLE
      ? new GenericContainer<>(DockerImageName.parse("redis:7")).withExposedPorts(6379)
      : null;

  static {
    if (DOCKER_AVAILABLE) {
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
    } else {
      System.out.println("Docker not available - using in-memory databases for tests");
    }
  }

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    try {
      if (DOCKER_AVAILABLE && postgres != null && redis != null) {
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
        System.out.println("Dynamic properties configured for TestContainers");
      } else {
        // Fall back to in-memory databases
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1");
        registry.add("spring.datasource.username", () -> "sa");
        registry.add("spring.datasource.password", () -> "");
        registry.add("spring.datasource.driver-class-name", () -> "org.h2.Driver");
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.H2Dialect");
        registry.add("spring.jpa.database", () -> "h2");
        registry.add("spring.data.redis.host", () -> "localhost");
        registry.add("spring.data.redis.port", () -> 6379);
        registry.add("spring.redis.host", () -> "localhost");
        registry.add("spring.redis.port", () -> 6379);
        System.out.println("Dynamic properties configured for in-memory databases");
      }
      
      // Common configuration
      registry.add("logging.config", () -> "");
      registry.add("spring.flyway.enabled", () -> "false");
      registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
      
      System.out.println("Dynamic properties configured successfully");
    } catch (Exception e) {
      System.err.println("Failed to configure dynamic properties: " + e.getMessage());
      e.printStackTrace();
      throw new RuntimeException("Failed to configure test properties", e);
    }
  }

  /**
   * Check if Docker is available by trying to run a simple Docker command
   */
  private static boolean isDockerAvailable() {
    try {
      Process process = Runtime.getRuntime().exec("docker --version");
      int exitCode = process.waitFor();
      return exitCode == 0;
    } catch (Exception e) {
      return false;
    }
  }
}
