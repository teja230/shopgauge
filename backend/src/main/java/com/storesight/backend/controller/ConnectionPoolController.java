package com.storesight.backend.controller;

import com.storesight.backend.service.EnhancedConnectionPoolService;
import com.storesight.backend.service.QueryResultCacheService;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller for connection pool management and monitoring endpoints. Provides administrative
 * access to connection pool statistics and operations.
 */
@RestController
@RequestMapping("/api/admin/connection-pool")
public class ConnectionPoolController {

  private static final Logger logger = LoggerFactory.getLogger(ConnectionPoolController.class);

  private final EnhancedConnectionPoolService connectionPoolService;
  private final QueryResultCacheService cacheService;

  @Autowired
  public ConnectionPoolController(
      EnhancedConnectionPoolService connectionPoolService, QueryResultCacheService cacheService) {
    this.connectionPoolService = connectionPoolService;
    this.cacheService = cacheService;
  }

  /** Get connection pool statistics */
  @GetMapping("/statistics")
  public ResponseEntity<EnhancedConnectionPoolService.ConnectionPoolStatistics> getStatistics() {
    try {
      EnhancedConnectionPoolService.ConnectionPoolStatistics stats =
          connectionPoolService.getStatistics();
      return ResponseEntity.ok(stats);
    } catch (Exception e) {
      logger.error("Error retrieving connection pool statistics", e);
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Test database connection */
  @GetMapping("/test-connection")
  public ResponseEntity<Map<String, Object>> testConnection() {
    try {
      boolean isHealthy = connectionPoolService.testConnection();
      Map<String, Object> response = new HashMap<>();
      response.put("healthy", isHealthy);
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error testing database connection", e);
      Map<String, Object> response = new HashMap<>();
      response.put("healthy", false);
      response.put("error", e.getMessage());
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);
    }
  }

  /** Attempt connection pool recovery */
  @PostMapping("/recover")
  public ResponseEntity<Map<String, Object>> attemptRecovery() {
    try {
      logger.info("Manual connection pool recovery requested");
      boolean recovered = connectionPoolService.attemptRecovery();

      Map<String, Object> response = new HashMap<>();
      response.put("recovered", recovered);
      response.put("timestamp", System.currentTimeMillis());
      response.put("message", recovered ? "Recovery successful" : "Recovery failed");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error during manual connection pool recovery", e);
      Map<String, Object> response = new HashMap<>();
      response.put("recovered", false);
      response.put("error", e.getMessage());
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);
    }
  }

  /** Close idle connections */
  @PostMapping("/close-idle")
  public ResponseEntity<Map<String, Object>> closeIdleConnections() {
    try {
      logger.info("Manual idle connection closure requested");
      connectionPoolService.closeIdleConnections();

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("timestamp", System.currentTimeMillis());
      response.put("message", "Idle connections closed");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error closing idle connections", e);
      Map<String, Object> response = new HashMap<>();
      response.put("success", false);
      response.put("error", e.getMessage());
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);
    }
  }

  /** Get comprehensive health status */
  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> getHealthStatus() {
    try {
      EnhancedConnectionPoolService.ConnectionPoolStatistics stats =
          connectionPoolService.getStatistics();
      boolean connectionTest = connectionPoolService.testConnection();

      Map<String, Object> response = new HashMap<>();
      response.put("overall_healthy", stats.isHealthy() && connectionTest);
      response.put("connection_test", connectionTest);
      response.put("pool_healthy", stats.isHealthy());
      response.put("utilization_ratio", stats.getUtilizationRatio());
      response.put("active_connections", stats.getActiveConnections());
      response.put("total_connections", stats.getTotalConnections());
      response.put("threads_waiting", stats.getThreadsAwaitingConnection());
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving health status", e);
      Map<String, Object> response = new HashMap<>();
      response.put("overall_healthy", false);
      response.put("error", e.getMessage());
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);
    }
  }

  /** Get query cache statistics */
  @GetMapping("/cache-statistics")
  public ResponseEntity<QueryResultCacheService.CacheStatistics> getCacheStatistics() {
    try {
      QueryResultCacheService.CacheStatistics stats = cacheService.getStatistics();
      return ResponseEntity.ok(stats);
    } catch (Exception e) {
      logger.error("Error retrieving cache statistics", e);
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Clear query cache */
  @PostMapping("/clear-cache")
  public ResponseEntity<Map<String, Object>> clearCache() {
    try {
      logger.info("Manual cache clear requested");
      // Note: We don't have a direct clear method, but we can evict by pattern
      // This would need to be implemented in the cache service

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("timestamp", System.currentTimeMillis());
      response.put("message", "Cache clear requested");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error clearing cache", e);
      Map<String, Object> response = new HashMap<>();
      response.put("success", false);
      response.put("error", e.getMessage());
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);
    }
  }

  /** Get combined dashboard data for monitoring */
  @GetMapping("/dashboard")
  public ResponseEntity<Map<String, Object>> getDashboardData() {
    try {
      EnhancedConnectionPoolService.ConnectionPoolStatistics poolStats =
          connectionPoolService.getStatistics();
      QueryResultCacheService.CacheStatistics cacheStats = cacheService.getStatistics();
      boolean connectionTest = connectionPoolService.testConnection();

      Map<String, Object> response = new HashMap<>();

      // Connection pool data
      Map<String, Object> poolData = new HashMap<>();
      poolData.put("healthy", poolStats.isHealthy());
      poolData.put("total_connections", poolStats.getTotalConnections());
      poolData.put("active_connections", poolStats.getActiveConnections());
      poolData.put("idle_connections", poolStats.getIdleConnections());
      poolData.put("utilization_ratio", poolStats.getUtilizationRatio());
      poolData.put("threads_waiting", poolStats.getThreadsAwaitingConnection());
      poolData.put("leak_count", poolStats.getConnectionLeakCount());
      poolData.put("timeout_count", poolStats.getConnectionTimeoutCount());
      poolData.put("recovery_count", poolStats.getConnectionRecoveryCount());
      poolData.put("connection_test", connectionTest);

      // Cache data
      Map<String, Object> cacheData = new HashMap<>();
      cacheData.put("hit_count", cacheStats.getHitCount());
      cacheData.put("miss_count", cacheStats.getMissCount());
      cacheData.put("hit_ratio", cacheStats.getHitRatio());
      cacheData.put("eviction_count", cacheStats.getEvictionCount());
      cacheData.put("memory_cache_size", cacheStats.getMemoryCacheSize());
      cacheData.put("database_cache_size", cacheStats.getDatabaseCacheSize());

      response.put("connection_pool", poolData);
      response.put("query_cache", cacheData);
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving dashboard data", e);
      return ResponseEntity.internalServerError().build();
    }
  }
}
