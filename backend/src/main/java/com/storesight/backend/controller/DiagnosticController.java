package com.storesight.backend.controller;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/diagnostics")
public class DiagnosticController {

  private static final Logger logger = LoggerFactory.getLogger(DiagnosticController.class);

  @Autowired private StringRedisTemplate redisTemplate;

  @Autowired private JdbcTemplate jdbcTemplate;

  @Value("${spring.redis.host:localhost}")
  private String redisHost;

  @Value("${spring.redis.port:6379}")
  private int redisPort;

  @GetMapping("/ping")
  public Map<String, Object> pingServices() {
    Map<String, Object> result = new HashMap<>();
    result.put("timestamp", Instant.now().toString());

    // Test Redis
    Map<String, Object> redisStatus = new HashMap<>();
    redisStatus.put("host", redisHost);
    redisStatus.put("port", redisPort);

    try {
      long startTime = System.currentTimeMillis();
      String testKey = "diagnostic:ping:" + UUID.randomUUID();
      String testValue = "test-" + System.currentTimeMillis();

      // Test write
      redisTemplate.opsForValue().set(testKey, testValue, Duration.ofSeconds(10));

      // Test read
      String readValue = redisTemplate.opsForValue().get(testKey);

      // Clean up
      redisTemplate.delete(testKey);

      long duration = System.currentTimeMillis() - startTime;

      redisStatus.put("status", "UP");
      redisStatus.put("responseTime", duration + "ms");
      redisStatus.put("testPassed", testValue.equals(readValue));

      logger.info("Redis ping successful - {}ms", duration);

    } catch (Exception e) {
      redisStatus.put("status", "DOWN");
      redisStatus.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
      logger.error("Redis ping failed: {}", e.getMessage());
    }

    result.put("redis", redisStatus);

    // Test Database
    Map<String, Object> dbStatus = new HashMap<>();

    try {
      long startTime = System.currentTimeMillis();

      // Simple query to test connection
      Integer testResult = jdbcTemplate.queryForObject("SELECT 1", Integer.class);

      // Get connection pool stats
      Map<String, Object> poolStats =
          jdbcTemplate.queryForMap(
              "SELECT count(*) as connection_count FROM pg_stat_activity WHERE datname = current_database()");

      long duration = System.currentTimeMillis() - startTime;

      dbStatus.put("status", "UP");
      dbStatus.put("responseTime", duration + "ms");
      dbStatus.put("testPassed", Integer.valueOf(1).equals(testResult));
      dbStatus.put("activeConnections", poolStats.get("connection_count"));

      logger.info("Database ping successful - {}ms", duration);

    } catch (Exception e) {
      dbStatus.put("status", "DOWN");
      dbStatus.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
      logger.error("Database ping failed: {}", e.getMessage());
    }

    result.put("database", dbStatus);

    // Overall status
    boolean redisUp = "UP".equals(redisStatus.get("status"));
    boolean dbUp = "UP".equals(dbStatus.get("status"));

    result.put("overallStatus", dbUp ? (redisUp ? "HEALTHY" : "DEGRADED") : "UNHEALTHY");
    result.put(
        "message",
        !redisUp && dbUp ? "Redis is down but database is operational. Caching disabled." : null);

    return result;
  }

  @GetMapping("/redis-info")
  public Map<String, Object> getRedisInfo() {
    Map<String, Object> info = new HashMap<>();

    try {
      // Get Redis server info
      String serverInfo =
          redisTemplate.execute(
              (org.springframework.data.redis.core.RedisCallback<String>)
                  connection -> {
                    return connection.serverCommands().info().toString();
                  });

      // Parse some basic info
      String[] lines = serverInfo.split("\n");
      for (String line : lines) {
        if (line.startsWith("redis_version:")) {
          info.put("version", line.split(":")[1].trim());
        } else if (line.startsWith("connected_clients:")) {
          info.put("connectedClients", line.split(":")[1].trim());
        } else if (line.startsWith("used_memory_human:")) {
          info.put("usedMemory", line.split(":")[1].trim());
        }
      }

      info.put("status", "CONNECTED");

    } catch (Exception e) {
      info.put("status", "ERROR");
      info.put("error", e.getMessage());
    }

    return info;
  }
}
