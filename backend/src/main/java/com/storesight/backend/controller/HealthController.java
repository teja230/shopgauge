package com.storesight.backend.controller;

import com.storesight.backend.service.ShopService;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

  private static final Logger logger = LoggerFactory.getLogger(HealthController.class);

  @Autowired private DataSource dataSource;

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private StringRedisTemplate redisTemplate;

  @Autowired private ShopService shopService;

  @Value("${spring.application.name:storesight-backend}")
  private String applicationName;

  @GetMapping("/summary")
  public ResponseEntity<Map<String, Object>> getHealthSummary() {
    Map<String, Object> health = new HashMap<>();
    health.put("application", applicationName);
    health.put("timestamp", LocalDateTime.now().toString());
    health.put("status", "healthy");

    // Database health check
    Map<String, Object> databaseHealth = checkDatabaseHealth();
    health.put("database", databaseHealth);

    // Redis health check
    Map<String, Object> redisHealth = checkRedisHealth();
    health.put("redis", redisHealth);

    // Overall status
    boolean isHealthy =
        "healthy".equals(databaseHealth.get("status"))
            && "healthy".equals(redisHealth.get("status"));

    health.put("status", isHealthy ? "healthy" : "degraded");

    return ResponseEntity.ok(health);
  }

  @GetMapping("/database")
  public ResponseEntity<Map<String, Object>> getDatabaseHealth() {
    Map<String, Object> health = checkDatabaseHealth();
    return ResponseEntity.ok(health);
  }

  @GetMapping("/redis")
  public ResponseEntity<Map<String, Object>> getRedisHealth() {
    Map<String, Object> health = checkRedisHealth();
    return ResponseEntity.ok(health);
  }

  private Map<String, Object> checkDatabaseHealth() {
    Map<String, Object> health = new HashMap<>();

    try {
      // Test connection
      try (Connection connection = dataSource.getConnection()) {
        health.put("connection", "healthy");
        health.put("connection_timeout", connection.getNetworkTimeout());
      }

      // Test query execution
      long startTime = System.currentTimeMillis();
      Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
      long queryTime = System.currentTimeMillis() - startTime;

      health.put("query_execution", "healthy");
      health.put("query_time_ms", queryTime);
      health.put("test_result", result);

      // Check connection pool stats if using HikariCP
      if (dataSource instanceof com.zaxxer.hikari.HikariDataSource) {
        com.zaxxer.hikari.HikariDataSource hikariDS =
            (com.zaxxer.hikari.HikariDataSource) dataSource;
        health.put(
            "pool_active_connections", hikariDS.getHikariPoolMXBean().getActiveConnections());
        health.put("pool_idle_connections", hikariDS.getHikariPoolMXBean().getIdleConnections());
        health.put("pool_total_connections", hikariDS.getHikariPoolMXBean().getTotalConnections());
      }

      health.put("status", "healthy");

    } catch (SQLException e) {
      logger.error("Database health check failed: {}", e.getMessage(), e);
      health.put("status", "unhealthy");
      health.put("error", e.getMessage());
      health.put("error_type", e.getClass().getSimpleName());
    } catch (Exception e) {
      logger.error("Database health check failed with unexpected error: {}", e.getMessage(), e);
      health.put("status", "unhealthy");
      health.put("error", e.getMessage());
      health.put("error_type", e.getClass().getSimpleName());
    }

    return health;
  }

  private Map<String, Object> checkRedisHealth() {
    Map<String, Object> health = new HashMap<>();

    try {
      // Test Redis connection with timeout
      CompletableFuture<String> future =
          CompletableFuture.supplyAsync(
              () -> {
                try {
                  return redisTemplate.opsForValue().get("health_check");
                } catch (Exception e) {
                  throw new RuntimeException(e);
                }
              });

      String result = future.get(5, TimeUnit.SECONDS);
      health.put("connection", "healthy");
      health.put("test_result", result);
      health.put("status", "healthy");

    } catch (Exception e) {
      logger.error("Redis health check failed: {}", e.getMessage(), e);
      health.put("status", "unhealthy");
      health.put("error", e.getMessage());
      health.put("error_type", e.getClass().getSimpleName());
    }

    return health;
  }

  @GetMapping("/detailed")
  public ResponseEntity<Map<String, Object>> getDetailedHealth() {
    Map<String, Object> health = new HashMap<>();
    health.put("application", applicationName);
    health.put("timestamp", LocalDateTime.now().toString());

    // Run all health checks in parallel
    CompletableFuture<Map<String, Object>> dbHealth =
        CompletableFuture.supplyAsync(this::checkDatabaseHealth);
    CompletableFuture<Map<String, Object>> redisHealth =
        CompletableFuture.supplyAsync(this::checkRedisHealth);

    try {
      Map<String, Object> databaseHealth = dbHealth.get(10, TimeUnit.SECONDS);
      Map<String, Object> redisHealthResult = redisHealth.get(10, TimeUnit.SECONDS);

      health.put("database", databaseHealth);
      health.put("redis", redisHealthResult);

      // Overall status
      boolean isHealthy =
          "healthy".equals(databaseHealth.get("status"))
              && "healthy".equals(redisHealthResult.get("status"));

      health.put("status", isHealthy ? "healthy" : "degraded");

    } catch (Exception e) {
      logger.error("Detailed health check failed: {}", e.getMessage(), e);
      health.put("status", "unhealthy");
      health.put("error", e.getMessage());
    }

    return ResponseEntity.ok(health);
  }
}
