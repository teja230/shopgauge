package com.storesight.backend.controller;

import com.storesight.backend.service.DatabaseMonitoringService;
import com.storesight.backend.service.DatabasePerformanceService;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller for database monitoring and performance optimization endpoints. Provides admin access
 * to database statistics, performance metrics, and maintenance functions.
 */
@RestController
@RequestMapping("/api/admin/database")
public class DatabaseMonitoringController {

  private static final Logger logger = LoggerFactory.getLogger(DatabaseMonitoringController.class);

  private final DatabaseMonitoringService databaseMonitoringService;
  private final DatabasePerformanceService databasePerformanceService;

  @Autowired
  public DatabaseMonitoringController(
      DatabaseMonitoringService databaseMonitoringService,
      DatabasePerformanceService databasePerformanceService) {
    this.databaseMonitoringService = databaseMonitoringService;
    this.databasePerformanceService = databasePerformanceService;
  }

  /** Get current connection pool statistics */
  @GetMapping("/connection-pool/stats")
  public ResponseEntity<Map<String, Object>> getConnectionPoolStats() {
    try {
      Map<String, Object> stats = databaseMonitoringService.getConnectionPoolStats();
      return ResponseEntity.ok(stats);
    } catch (Exception e) {
      logger.error("Error getting connection pool stats: {}", e.getMessage());
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to retrieve connection pool statistics"));
    }
  }

  /** Get database performance metrics */
  @GetMapping("/performance/metrics")
  public ResponseEntity<Map<String, Object>> getPerformanceMetrics() {
    try {
      Map<String, Object> metrics = databaseMonitoringService.getDatabasePerformanceMetrics();
      return ResponseEntity.ok(metrics);
    } catch (Exception e) {
      logger.error("Error getting performance metrics: {}", e.getMessage());
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to retrieve performance metrics"));
    }
  }

  /** Get Market Intelligence specific table statistics */
  @GetMapping("/market-intelligence/stats")
  public ResponseEntity<Map<String, Object>> getMarketIntelligenceStats() {
    try {
      Map<String, Object> stats = databaseMonitoringService.getMarketIntelligenceTableStats();
      return ResponseEntity.ok(stats);
    } catch (Exception e) {
      logger.error("Error getting Market Intelligence stats: {}", e.getMessage());
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to retrieve Market Intelligence statistics"));
    }
  }

  /** Get performance recommendations */
  @GetMapping("/performance/recommendations")
  public ResponseEntity<Map<String, Object>> getPerformanceRecommendations() {
    try {
      List<String> recommendations = databaseMonitoringService.getPerformanceRecommendations();
      return ResponseEntity.ok(
          Map.of("recommendations", recommendations, "count", recommendations.size()));
    } catch (Exception e) {
      logger.error("Error getting performance recommendations: {}", e.getMessage());
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to generate performance recommendations"));
    }
  }

  /** Perform database maintenance tasks */
  @PostMapping("/maintenance/run")
  public ResponseEntity<Map<String, Object>> performMaintenance() {
    try {
      logger.info("Manual database maintenance triggered");
      Map<String, Object> results = databaseMonitoringService.performMaintenance();
      return ResponseEntity.ok(results);
    } catch (Exception e) {
      logger.error("Error performing database maintenance: {}", e.getMessage());
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Database maintenance failed: " + e.getMessage()));
    }
  }

  /** Get enhanced database performance metrics */
  @GetMapping("/performance/enhanced")
  public ResponseEntity<DatabasePerformanceService.DatabasePerformanceMetrics>
      getEnhancedPerformanceMetrics() {
    try {
      DatabasePerformanceService.DatabasePerformanceMetrics metrics =
          databasePerformanceService.getPerformanceMetrics();
      return ResponseEntity.ok(metrics);
    } catch (Exception e) {
      logger.error("Error getting enhanced performance metrics: {}", e.getMessage());
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Get slow queries analysis */
  @GetMapping("/performance/slow-queries")
  public ResponseEntity<List<DatabasePerformanceService.SlowQuery>> getSlowQueries() {
    try {
      List<DatabasePerformanceService.SlowQuery> slowQueries =
          databasePerformanceService.getSlowQueries();
      return ResponseEntity.ok(slowQueries);
    } catch (Exception e) {
      logger.error("Error getting slow queries: {}", e.getMessage());
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Get index usage statistics */
  @GetMapping("/performance/index-usage")
  public ResponseEntity<List<DatabasePerformanceService.IndexUsageStat>> getIndexUsageStats() {
    try {
      List<DatabasePerformanceService.IndexUsageStat> stats =
          databasePerformanceService.getIndexUsageStats();
      return ResponseEntity.ok(stats);
    } catch (Exception e) {
      logger.error("Error getting index usage stats: {}", e.getMessage());
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Get table sizes */
  @GetMapping("/performance/table-sizes")
  public ResponseEntity<List<DatabasePerformanceService.TableSize>> getTableSizes() {
    try {
      List<DatabasePerformanceService.TableSize> sizes = databasePerformanceService.getTableSizes();
      return ResponseEntity.ok(sizes);
    } catch (Exception e) {
      logger.error("Error getting table sizes: {}", e.getMessage());
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Get query optimization recommendations */
  @GetMapping("/performance/query-recommendations")
  public ResponseEntity<List<DatabasePerformanceService.QueryRecommendation>>
      getQueryRecommendations() {
    try {
      List<DatabasePerformanceService.QueryRecommendation> recommendations =
          databasePerformanceService.generateQueryRecommendations();
      return ResponseEntity.ok(recommendations);
    } catch (Exception e) {
      logger.error("Error getting query recommendations: {}", e.getMessage());
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Update table statistics */
  @PostMapping("/maintenance/update-statistics")
  public ResponseEntity<Map<String, Object>> updateTableStatistics() {
    try {
      databasePerformanceService.updateTableStatistics();
      return ResponseEntity.ok(
          Map.of(
              "message",
              "Table statistics updated successfully",
              "timestamp",
              System.currentTimeMillis()));
    } catch (Exception e) {
      logger.error("Error updating table statistics: {}", e.getMessage());
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to update table statistics"));
    }
  }

  /** Get database performance health status */
  @GetMapping("/health/performance")
  public ResponseEntity<Map<String, Object>> getPerformanceHealth() {
    try {
      Map<String, Object> health = databasePerformanceService.getHealthStatus();
      return ResponseEntity.ok(health);
    } catch (Exception e) {
      logger.error("Error getting performance health: {}", e.getMessage());
      return ResponseEntity.status(503).body(Map.of("status", "DOWN", "error", e.getMessage()));
    }
  }

  /** Get comprehensive database health report */
  @GetMapping("/health/report")
  public ResponseEntity<Map<String, Object>> getHealthReport() {
    try {
      Map<String, Object> report =
          Map.of(
              "connectionPool", databaseMonitoringService.getConnectionPoolStats(),
              "performance", databaseMonitoringService.getDatabasePerformanceMetrics(),
              "marketIntelligence", databaseMonitoringService.getMarketIntelligenceTableStats(),
              "recommendations", databaseMonitoringService.getPerformanceRecommendations(),
              "enhancedPerformance", databasePerformanceService.getHealthStatus(),
              "timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(report);
    } catch (Exception e) {
      logger.error("Error generating health report: {}", e.getMessage());
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to generate health report"));
    }
  }
}
