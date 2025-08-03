package com.storesight.backend.service;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import io.micrometer.core.instrument.Timer;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import javax.management.JMX;
import javax.management.MBeanServer;
import javax.management.ObjectName;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Comprehensive database performance monitoring service
 *
 * <p>This service provides comprehensive database monitoring including: - Query performance
 * tracking - Connection pool monitoring - Database health checks - Slow query detection -
 * Connection leak detection - Market Intelligence specific table statistics - Database maintenance
 * tasks - Performance recommendations
 */
@Service
public class DatabaseMonitoringService implements HealthIndicator {

  private static final Logger logger = LoggerFactory.getLogger(DatabaseMonitoringService.class);

  @Autowired private DataSource dataSource;
  @Autowired private MetricsCollectionService metricsCollectionService;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private FeatureFlagService featureFlagService;

  // Performance thresholds
  private static final long SLOW_QUERY_THRESHOLD_MS = 1000; // 1 second
  private static final long VERY_SLOW_QUERY_THRESHOLD_MS = 5000; // 5 seconds
  private static final int CONNECTION_POOL_WARNING_THRESHOLD = 80; // 80% utilization

  // Monitoring metrics
  private final AtomicLong totalQueries = new AtomicLong(0);
  private final AtomicLong slowQueries = new AtomicLong(0);
  private final AtomicLong verySlowQueries = new AtomicLong(0);
  private final AtomicLong failedQueries = new AtomicLong(0);
  private final AtomicLong connectionLeaks = new AtomicLong(0);

  // HikariCP monitoring
  private HikariPoolMXBean hikariPoolMXBean;

  public DatabaseMonitoringService() {
    initializeHikariMonitoring();
  }

  private void initializeHikariMonitoring() {
    try {
      if (dataSource instanceof HikariDataSource) {
        HikariDataSource hikariDataSource = (HikariDataSource) dataSource;
        String poolName = hikariDataSource.getPoolName();

        MBeanServer mBeanServer = java.lang.management.ManagementFactory.getPlatformMBeanServer();
        ObjectName poolObjectName =
            new ObjectName("com.zaxxer.hikari:type=Pool (" + poolName + ")");
        this.hikariPoolMXBean =
            JMX.newMXBeanProxy(mBeanServer, poolObjectName, HikariPoolMXBean.class);

        logger.info("HikariCP monitoring initialized for pool: {}", poolName);
      }
    } catch (Exception e) {
      logger.warn("Failed to initialize HikariCP monitoring: {}", e.getMessage());
    }
  }

  /**
   * Execute a monitored database query
   *
   * @param queryName Name/description of the query for monitoring
   * @param queryExecutor Function that executes the query
   * @return Query result
   */
  public <T> T executeMonitoredQuery(String queryName, QueryExecutor<T> queryExecutor) {
    Timer.Sample sample = metricsCollectionService.startDatabaseQuery();
    long startTime = System.currentTimeMillis();

    try {
      totalQueries.incrementAndGet();
      metricsCollectionService.recordDatabaseQuery();

      T result = queryExecutor.execute();

      long duration = System.currentTimeMillis() - startTime;

      // Track slow queries
      if (duration > VERY_SLOW_QUERY_THRESHOLD_MS) {
        verySlowQueries.incrementAndGet();
        logger.warn("Very slow query detected: {} took {}ms", queryName, duration);
      } else if (duration > SLOW_QUERY_THRESHOLD_MS) {
        slowQueries.incrementAndGet();
        logger.info("Slow query detected: {} took {}ms", queryName, duration);
      }

      logger.debug("Query {} completed in {}ms", queryName, duration);
      return result;

    } catch (Exception e) {
      failedQueries.incrementAndGet();
      metricsCollectionService.recordDatabaseError();
      logger.error("Query {} failed: {}", queryName, e.getMessage());
      throw new RuntimeException("Database query failed: " + queryName, e);
    } finally {
      metricsCollectionService.recordDatabaseQueryDuration(sample);
    }
  }

  /**
   * Execute a monitored database connection operation
   *
   * @param operationName Name/description of the operation
   * @param connectionExecutor Function that uses the connection
   * @return Operation result
   */
  public <T> T executeWithMonitoredConnection(
      String operationName, ConnectionExecutor<T> connectionExecutor) {
    long startTime = System.currentTimeMillis();
    Connection connection = null;

    try {
      connection = dataSource.getConnection();

      if (connection == null) {
        metricsCollectionService.recordConnectionPoolExhaustion();
        throw new RuntimeException("Failed to obtain database connection");
      }

      T result = connectionExecutor.execute(connection);

      long duration = System.currentTimeMillis() - startTime;
      logger.debug("Database operation {} completed in {}ms", operationName, duration);

      return result;

    } catch (Exception e) {
      failedQueries.incrementAndGet();
      metricsCollectionService.recordDatabaseError();
      logger.error("Database operation {} failed: {}", operationName, e.getMessage());
      throw new RuntimeException("Database operation failed: " + operationName, e);
    } finally {
      if (connection != null) {
        try {
          connection.close();
        } catch (Exception e) {
          connectionLeaks.incrementAndGet();
          logger.warn(
              "Failed to close database connection for {}: {}", operationName, e.getMessage());
        }
      }
    }
  }

  /** Get comprehensive database performance statistics */
  public Map<String, Object> getDatabaseStatistics() {
    Map<String, Object> stats = new HashMap<>();

    // Query statistics
    long total = totalQueries.get();
    stats.put("totalQueries", total);
    stats.put("slowQueries", slowQueries.get());
    stats.put("verySlowQueries", verySlowQueries.get());
    stats.put("failedQueries", failedQueries.get());
    stats.put("connectionLeaks", connectionLeaks.get());

    // Calculate percentages
    if (total > 0) {
      stats.put("slowQueryPercentage", (double) slowQueries.get() / total * 100);
      stats.put("verySlowQueryPercentage", (double) verySlowQueries.get() / total * 100);
      stats.put("failureRate", (double) failedQueries.get() / total * 100);
    } else {
      stats.put("slowQueryPercentage", 0.0);
      stats.put("verySlowQueryPercentage", 0.0);
      stats.put("failureRate", 0.0);
    }

    // Connection pool statistics
    Map<String, Object> connectionPoolStats = getConnectionPoolStatistics();
    stats.put("connectionPool", connectionPoolStats);

    stats.put("timestamp", LocalDateTime.now());
    return stats;
  }

  /** Get connection pool statistics */
  public Map<String, Object> getConnectionPoolStatistics() {
    Map<String, Object> stats = new HashMap<>();

    try {
      // Try to get HikariCP statistics if available
      if (dataSource.getClass().getName().contains("HikariDataSource")) {
        // Use reflection to get HikariCP pool statistics
        try {
          Object hikariPool =
              dataSource.getClass().getMethod("getHikariPoolMXBean").invoke(dataSource);

          if (hikariPool != null) {
            int activeConnections =
                (Integer)
                    hikariPool.getClass().getMethod("getActiveConnections").invoke(hikariPool);
            int idleConnections =
                (Integer) hikariPool.getClass().getMethod("getIdleConnections").invoke(hikariPool);
            int totalConnections =
                (Integer) hikariPool.getClass().getMethod("getTotalConnections").invoke(hikariPool);
            int threadsAwaitingConnection =
                (Integer)
                    hikariPool
                        .getClass()
                        .getMethod("getThreadsAwaitingConnection")
                        .invoke(hikariPool);

            // Get maximum pool size from HikariCP configuration
            int maximumPoolSize = 20; // Default fallback
            try {
              Object hikariConfig =
                  dataSource.getClass().getMethod("getHikariConfigMXBean").invoke(dataSource);
              if (hikariConfig != null) {
                maximumPoolSize =
                    (Integer)
                        hikariConfig
                            .getClass()
                            .getMethod("getMaximumPoolSize")
                            .invoke(hikariConfig);
              }
            } catch (Exception configException) {
              logger.debug(
                  "Could not get HikariCP configuration, using default maximum pool size: {}",
                  configException.getMessage());
            }

            stats.put("activeConnections", activeConnections);
            stats.put("idleConnections", idleConnections);
            stats.put("totalConnections", totalConnections);
            stats.put("maximumPoolSize", maximumPoolSize);
            stats.put("threadsAwaitingConnection", threadsAwaitingConnection);

            // Calculate utilization based on maximum pool size, not current total connections
            // This prevents false emergency cleanup triggers when idle connections are closed
            double utilizationPercentage = (double) activeConnections / maximumPoolSize * 100;
            double currentPoolUtilization =
                totalConnections > 0 ? (double) activeConnections / totalConnections * 100 : 0;

            stats.put("utilizationPercentage", utilizationPercentage);
            stats.put("currentPoolUtilization", currentPoolUtilization);

            // Use the correct utilization percentage for warnings
            if (utilizationPercentage > CONNECTION_POOL_WARNING_THRESHOLD) {
              stats.put(
                  "warning",
                  "High connection pool utilization: "
                      + String.format("%.1f%%", utilizationPercentage));
            }

            // Add pool health status
            String poolStatus = "HEALTHY";
            if (utilizationPercentage > 90) {
              poolStatus = "CRITICAL";
            } else if (utilizationPercentage > CONNECTION_POOL_WARNING_THRESHOLD) {
              poolStatus = "WARNING";
            }
            stats.put("poolStatus", poolStatus);

            // Log detailed connection info for debugging
            logger.debug(
                "Connection pool stats - Active: {}, Idle: {}, Total: {}, Max: {}, Utilization: {:.1f}%",
                activeConnections,
                idleConnections,
                totalConnections,
                maximumPoolSize,
                utilizationPercentage);

            if (threadsAwaitingConnection > 0) {
              stats.put("warning", "Threads waiting for connections: " + threadsAwaitingConnection);
              metricsCollectionService.recordConnectionPoolExhaustion();
            }
          }
        } catch (Exception e) {
          logger.debug("Could not get HikariCP statistics: {}", e.getMessage());
          stats.put("error", "HikariCP statistics not available");
        }
      } else {
        stats.put("info", "Connection pool statistics not available for this DataSource type");
      }

      // Basic connection test
      try (Connection connection = dataSource.getConnection()) {
        boolean isValid = connection.isValid(5);
        stats.put("connectionTest", isValid ? "PASS" : "FAIL");

        if (!isValid) {
          stats.put("error", "Database connection validation failed");
        }
      }

    } catch (Exception e) {
      stats.put("error", "Failed to get connection pool statistics: " + e.getMessage());
      logger.warn("Failed to get connection pool statistics: {}", e.getMessage());
    }

    return stats;
  }

  /** Get database performance metrics */
  public Map<String, Object> getDatabasePerformanceMetrics() {
    Map<String, Object> metrics = new HashMap<>();

    try {
      // Get database size information
      String dbSizeQuery =
          """
                    SELECT
                        pg_size_pretty(pg_database_size(current_database())) as database_size,
                        pg_database_size(current_database()) as database_size_bytes
                    """;

      jdbcTemplate.queryForObject(
          dbSizeQuery,
          (rs, rowNum) -> {
            metrics.put("databaseSize", rs.getString("database_size"));
            metrics.put("databaseSizeBytes", rs.getLong("database_size_bytes"));
            return null;
          });

      // Get table sizes for Market Intelligence tables
      String tableSizesQuery =
          """
                    SELECT
                        schemaname,
                        tablename,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
                    FROM pg_tables
                    WHERE tablename IN ('competitor_urls', 'price_snapshots', 'competitor_suggestions',
                                       'price_alerts', 'market_intelligence_costs')
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                    """;

      List<Map<String, Object>> tableSizes = jdbcTemplate.queryForList(tableSizesQuery);
      metrics.put("tableSizes", tableSizes);

      // Get connection statistics
      String connectionStatsQuery =
          """
                    SELECT
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active_connections,
                        count(*) FILTER (WHERE state = 'idle') as idle_connections,
                        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                    """;

      jdbcTemplate.queryForObject(
          connectionStatsQuery,
          (rs, rowNum) -> {
            metrics.put("totalDbConnections", rs.getInt("total_connections"));
            metrics.put("activeDbConnections", rs.getInt("active_connections"));
            metrics.put("idleDbConnections", rs.getInt("idle_connections"));
            metrics.put("idleInTransactionConnections", rs.getInt("idle_in_transaction"));
            return null;
          });

      // Get slow query information (if pg_stat_statements is available)
      try {
        String slowQueriesQuery =
            """
                          SELECT
                              query,
                              calls,
                              total_exec_time,
                              mean_exec_time,
                              max_exec_time
                          FROM pg_stat_statements
                          WHERE query LIKE '%competitor%' OR query LIKE '%price_snapshot%'
                          ORDER BY mean_exec_time DESC
                          LIMIT 5
                          """;

        List<Map<String, Object>> slowQueries = jdbcTemplate.queryForList(slowQueriesQuery);
        metrics.put("slowQueries", slowQueries);
      } catch (Exception e) {
        // pg_stat_statements extension not available
        metrics.put("slowQueries", "pg_stat_statements extension not available");
      }

    } catch (Exception e) {
      logger.error("Error getting database performance metrics: {}", e.getMessage());
      metrics.put("error", "Failed to retrieve database performance metrics");
    }

    return metrics;
  }

  /** Get Market Intelligence specific table statistics */
  public Map<String, Object> getMarketIntelligenceTableStats() {
    Map<String, Object> stats = new HashMap<>();

    try {
      // Competitor URLs statistics
      String competitorStatsQuery =
          """
                    SELECT
                        COUNT(*) as total_competitors,
                        COUNT(*) FILTER (WHERE status = 'active') as active_competitors,
                        COUNT(*) FILTER (WHERE status = 'error') as error_competitors,
                        COUNT(*) FILTER (WHERE error_count > 0) as competitors_with_errors,
                        COUNT(DISTINCT shop_id) as shops_with_competitors,
                        COUNT(DISTINCT platform) as unique_platforms
                    FROM competitor_urls
                    WHERE deleted_at IS NULL
                    """;

      jdbcTemplate.queryForObject(
          competitorStatsQuery,
          (rs, rowNum) -> {
            Map<String, Object> competitorStats = new HashMap<>();
            competitorStats.put("totalCompetitors", rs.getInt("total_competitors"));
            competitorStats.put("activeCompetitors", rs.getInt("active_competitors"));
            competitorStats.put("errorCompetitors", rs.getInt("error_competitors"));
            competitorStats.put("competitorsWithErrors", rs.getInt("competitors_with_errors"));
            competitorStats.put("shopsWithCompetitors", rs.getInt("shops_with_competitors"));
            competitorStats.put("uniquePlatforms", rs.getInt("unique_platforms"));
            stats.put("competitorUrls", competitorStats);
            return null;
          });

      // Price snapshots statistics
      String priceStatsQuery =
          """
                    SELECT
                        COUNT(*) as total_snapshots,
                        COUNT(*) FILTER (WHERE checked_at >= CURRENT_DATE - INTERVAL '1 day') as snapshots_last_24h,
                        COUNT(*) FILTER (WHERE significant_change = true) as significant_changes,
                        AVG(response_time_ms) as avg_response_time,
                        MAX(checked_at) as last_snapshot_time
                    FROM price_snapshots
                    """;

      jdbcTemplate.queryForObject(
          priceStatsQuery,
          (rs, rowNum) -> {
            Map<String, Object> priceStats = new HashMap<>();
            priceStats.put("totalSnapshots", rs.getInt("total_snapshots"));
            priceStats.put("snapshotsLast24h", rs.getInt("snapshots_last_24h"));
            priceStats.put("significantChanges", rs.getInt("significant_changes"));
            priceStats.put("avgResponseTime", rs.getDouble("avg_response_time"));
            priceStats.put("lastSnapshotTime", rs.getTimestamp("last_snapshot_time"));
            stats.put("priceSnapshots", priceStats);
            return null;
          });

      // Competitor suggestions statistics
      String suggestionsStatsQuery =
          """
                    SELECT
                        COUNT(*) as total_suggestions,
                        COUNT(*) FILTER (WHERE status = 'NEW') as new_suggestions,
                        COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_suggestions,
                        AVG(relevance_score) as avg_relevance_score,
                        COUNT(DISTINCT shop_id) as shops_with_suggestions
                    FROM competitor_suggestions
                    """;

      jdbcTemplate.queryForObject(
          suggestionsStatsQuery,
          (rs, rowNum) -> {
            Map<String, Object> suggestionStats = new HashMap<>();
            suggestionStats.put("totalSuggestions", rs.getInt("total_suggestions"));
            suggestionStats.put("newSuggestions", rs.getInt("new_suggestions"));
            suggestionStats.put("approvedSuggestions", rs.getInt("approved_suggestions"));
            suggestionStats.put("avgRelevanceScore", rs.getDouble("avg_relevance_score"));
            suggestionStats.put("shopsWithSuggestions", rs.getInt("shops_with_suggestions"));
            stats.put("competitorSuggestions", suggestionStats);
            return null;
          });

      // Cost tracking statistics
      String costStatsQuery =
          """
                    SELECT
                        SUM(daily_cost) as total_cost,
                        AVG(daily_cost) as avg_daily_cost,
                        SUM(daily_requests) as total_requests,
                        AVG(cache_hit_rate) as avg_cache_hit_rate,
                        COUNT(DISTINCT shop_id) as shops_with_costs,
                        MAX(date) as last_cost_date
                    FROM market_intelligence_costs
                    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
                    """;

      jdbcTemplate.queryForObject(
          costStatsQuery,
          (rs, rowNum) -> {
            Map<String, Object> costStats = new HashMap<>();
            costStats.put("totalCost", rs.getBigDecimal("total_cost"));
            costStats.put("avgDailyCost", rs.getBigDecimal("avg_daily_cost"));
            costStats.put("totalRequests", rs.getInt("total_requests"));
            costStats.put("avgCacheHitRate", rs.getDouble("avg_cache_hit_rate"));
            costStats.put("shopsWithCosts", rs.getInt("shops_with_costs"));
            costStats.put("lastCostDate", rs.getDate("last_cost_date"));
            stats.put("marketIntelligenceCosts", costStats);
            return null;
          });

    } catch (Exception e) {
      logger.error("Error getting Market Intelligence table stats: {}", e.getMessage());
      stats.put("error", "Failed to retrieve Market Intelligence table statistics");
    }

    return stats;
  }

  /** Perform database maintenance tasks */
  public Map<String, Object> performMaintenance() {
    Map<String, Object> results = new HashMap<>();

    try {
      // Clean up old price snapshots (older than 90 days) using standard SQL
      String cleanupQuery =
          "DELETE FROM price_snapshots WHERE checked_at < CURRENT_DATE - INTERVAL '90 days'";
      int deletedSnapshots = jdbcTemplate.update(cleanupQuery);
      results.put("priceSnapshotCleanup", "Deleted " + deletedSnapshots + " old price snapshots");

      // Update table statistics using standard SQL
      try {
        jdbcTemplate.execute("ANALYZE price_snapshots");
        jdbcTemplate.execute("ANALYZE competitor_urls");
        jdbcTemplate.execute("ANALYZE competitor_suggestions");
        results.put("statisticsUpdate", "completed");
      } catch (Exception e) {
        logger.warn("Could not update table statistics: {}", e.getMessage());
        results.put("statisticsUpdate", "skipped - " + e.getMessage());
      }

      // Refresh materialized view if it exists
      try {
        // Check if materialized view exists first
        String checkViewQuery =
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.views
                WHERE table_name = 'competitor_performance_summary'
                AND table_schema = 'public'
            )
            """;
        Boolean viewExists = jdbcTemplate.queryForObject(checkViewQuery, Boolean.class);

        if (viewExists != null && viewExists) {
          jdbcTemplate.execute("REFRESH MATERIALIZED VIEW competitor_performance_summary");
          results.put("materializedViewRefresh", "completed");
        } else {
          results.put("materializedViewRefresh", "skipped - view does not exist");
        }
      } catch (Exception e) {
        logger.warn("Could not refresh materialized view: {}", e.getMessage());
        results.put("materializedViewRefresh", "skipped - " + e.getMessage());
      }

      results.put("maintenanceCompleted", LocalDateTime.now());
      logger.info("Database maintenance completed successfully");

    } catch (Exception e) {
      logger.error("Error during database maintenance: {}", e.getMessage());
      results.put("error", "Database maintenance failed: " + e.getMessage());
    }

    return results;
  }

  /** Analyze query performance and provide recommendations */
  public List<String> getPerformanceRecommendations() {
    List<String> recommendations = new ArrayList<>();

    try {
      Map<String, Object> poolStats = getConnectionPoolStatistics();
      Map<String, Object> tableStats = getMarketIntelligenceTableStats();

      // Check connection pool utilization
      if (poolStats.containsKey("utilizationPercentage")) {
        double utilization = (Double) poolStats.get("utilizationPercentage");
        if (utilization > 80) {
          recommendations.add(
              "Connection pool utilization is high ("
                  + utilization
                  + "%). Consider increasing pool size.");
        } else if (utilization < 20) {
          recommendations.add(
              "Connection pool utilization is low ("
                  + utilization
                  + "%). Consider reducing pool size to save resources.");
        }
      }

      // Check for competitors with errors
      if (tableStats.containsKey("competitorUrls")) {
        @SuppressWarnings("unchecked")
        Map<String, Object> competitorStats =
            (Map<String, Object>) tableStats.get("competitorUrls");
        int errorCompetitors = (Integer) competitorStats.get("errorCompetitors");
        int totalCompetitors = (Integer) competitorStats.get("totalCompetitors");

        if (errorCompetitors > 0) {
          double errorRate = (double) errorCompetitors / totalCompetitors * 100;
          if (errorRate > 10) {
            recommendations.add(
                "High error rate in competitor URLs ("
                    + errorRate
                    + "%). Review and fix failing URLs.");
          }
        }
      }

      // Check cache hit rate
      if (tableStats.containsKey("marketIntelligenceCosts")) {
        @SuppressWarnings("unchecked")
        Map<String, Object> costStats =
            (Map<String, Object>) tableStats.get("marketIntelligenceCosts");
        if (costStats.containsKey("avgCacheHitRate")) {
          double cacheHitRate = (Double) costStats.get("avgCacheHitRate");
          if (cacheHitRate < 70) {
            recommendations.add(
                "Cache hit rate is low ("
                    + cacheHitRate
                    + "%). Consider optimizing caching strategy.");
          }
        }
      }

      // Check for old data that needs cleanup
      String oldDataQuery =
          """
                    SELECT COUNT(*) as old_snapshots
                    FROM price_snapshots
                    WHERE checked_at < CURRENT_DATE - INTERVAL '90 days'
                    """;

      Integer oldSnapshots = jdbcTemplate.queryForObject(oldDataQuery, Integer.class);
      if (oldSnapshots != null && oldSnapshots > 1000) {
        recommendations.add(
            "Found "
                + oldSnapshots
                + " old price snapshots. Consider running cleanup maintenance.");
      }

    } catch (Exception e) {
      logger.error("Error generating performance recommendations: {}", e.getMessage());
      recommendations.add("Error analyzing performance: " + e.getMessage());
    }

    return recommendations;
  }

  /** Perform database health check */
  public Map<String, Object> performHealthCheck() {
    Map<String, Object> healthCheck = new HashMap<>();
    long startTime = System.currentTimeMillis();

    try {
      // Test basic connectivity
      try (Connection connection = dataSource.getConnection()) {
        boolean isValid = connection.isValid(5);
        long responseTime = System.currentTimeMillis() - startTime;

        healthCheck.put("connectivity", isValid ? "HEALTHY" : "UNHEALTHY");
        healthCheck.put("responseTimeMs", responseTime);

        if (responseTime > 1000) {
          healthCheck.put("warning", "Slow database response: " + responseTime + "ms");
        }

        // Test a simple query
        if (isValid) {
          try (PreparedStatement stmt = connection.prepareStatement("SELECT 1");
              ResultSet rs = stmt.executeQuery()) {

            boolean queryWorked = rs.next() && rs.getInt(1) == 1;
            healthCheck.put("queryTest", queryWorked ? "PASS" : "FAIL");

            long totalResponseTime = System.currentTimeMillis() - startTime;
            healthCheck.put("totalResponseTimeMs", totalResponseTime);
          }
        }
      }

      // Check performance metrics
      Map<String, Object> performanceHealth = new HashMap<>();

      long total = totalQueries.get();
      if (total > 0) {
        double failureRate = (double) failedQueries.get() / total * 100;
        double slowQueryRate = (double) slowQueries.get() / total * 100;

        performanceHealth.put("failureRate", failureRate);
        performanceHealth.put("slowQueryRate", slowQueryRate);

        // Health assessment
        String performanceStatus = "HEALTHY";
        if (failureRate > 5) {
          performanceStatus = "CRITICAL";
        } else if (failureRate > 1 || slowQueryRate > 20) {
          performanceStatus = "WARNING";
        }

        performanceHealth.put("status", performanceStatus);
      } else {
        performanceHealth.put("status", "NO_DATA");
      }

      healthCheck.put("performance", performanceHealth);
      healthCheck.put("overallStatus", "HEALTHY");

    } catch (Exception e) {
      healthCheck.put("connectivity", "UNHEALTHY");
      healthCheck.put("error", e.getMessage());
      healthCheck.put("overallStatus", "UNHEALTHY");
      healthCheck.put("responseTimeMs", System.currentTimeMillis() - startTime);

      logger.error("Database health check failed: {}", e.getMessage());
    }

    healthCheck.put("timestamp", LocalDateTime.now());
    return healthCheck;
  }

  /** Scheduled monitoring task to check database health with startup delay */
  @Scheduled(
      fixedRateString = "${storesight.monitoring.database-interval:PT4H}",
      initialDelayString = "${storesight.monitoring.database-startup-delay:PT12M}")
  public void monitorDatabaseHealth() {
    // Check if scheduled database monitoring is enabled
    if (!featureFlagService.isScheduledDatabaseMonitoringEnabled()) {
      logger.debug("Scheduled database monitoring is disabled via feature flag");
      return;
    }

    try {
      Map<String, Object> healthCheck = performHealthCheck();
      String status = (String) healthCheck.get("overallStatus");

      if ("UNHEALTHY".equals(status)) {
        logger.warn("Database health check failed: {}", healthCheck);
      } else {
        logger.debug("Database health check passed: {}", healthCheck);
      }

      // Update system metrics based on health check
      Long responseTime = (Long) healthCheck.get("responseTimeMs");
      if (responseTime != null && responseTime > 2000) {
        logger.warn("Database response time is high: {}ms", responseTime);
      }

    } catch (Exception e) {
      logger.error("Error during scheduled database health check: {}", e.getMessage());
    }
  }

  /** Scheduled task to perform regular maintenance */
  @Scheduled(cron = "0 45 2 * * ?") // Run at 2:45 AM daily (staggered to avoid conflicts)
  public void scheduledMaintenance() {
    logger.info("Starting scheduled database maintenance");
    Map<String, Object> results = performMaintenance();
    logger.info("Scheduled database maintenance completed: {}", results);
  }

  /** Reset monitoring statistics */
  public void resetStatistics() {
    totalQueries.set(0);
    slowQueries.set(0);
    verySlowQueries.set(0);
    failedQueries.set(0);
    connectionLeaks.set(0);
    logger.info("Database monitoring statistics reset");
  }

  /** Health check implementation for HealthIndicator interface */
  @Override
  public Health health() {
    try {
      Map<String, Object> poolStats = getConnectionPoolStatistics();
      Map<String, Object> performanceMetrics = getDatabasePerformanceMetrics();

      Health.Builder builder = Health.up();
      builder.withDetails(poolStats);
      builder.withDetail("performanceMetrics", performanceMetrics);

      // Check if connection pool utilization is critical
      if (poolStats.containsKey("utilizationPercentage")) {
        double utilization = (Double) poolStats.get("utilizationPercentage");
        if (utilization > 95) {
          builder = Health.down();
          builder.withDetail(
              "reason", "Connection pool utilization critical: " + utilization + "%");
        }
      }

      return builder.build();

    } catch (Exception e) {
      return Health.down().withDetail("error", e.getMessage()).build();
    }
  }

  /** Functional interface for query execution */
  @FunctionalInterface
  public interface QueryExecutor<T> {
    T execute() throws Exception;
  }

  /** Functional interface for connection-based operations */
  @FunctionalInterface
  public interface ConnectionExecutor<T> {
    T execute(Connection connection) throws Exception;
  }

  /** Get database pool status for admin interface */
  public String getPoolStatus() {
    try {
      Map<String, Object> poolStats = getConnectionPoolStatistics();
      if (poolStats.containsKey("poolStatus")) {
        return (String) poolStats.get("poolStatus");
      } else if (poolStats.containsKey("utilizationPercentage")) {
        // Fallback to manual calculation using corrected utilization
        double utilization = (Double) poolStats.get("utilizationPercentage");
        if (utilization > 90) {
          return "CRITICAL";
        } else if (utilization > 70) {
          return "WARNING";
        } else {
          return "HEALTHY";
        }
      }
      return "UNKNOWN";
    } catch (Exception e) {
      logger.warn("Error getting pool status: {}", e.getMessage());
      return "ERROR";
    }
  }

  /** Get database metrics for admin interface */
  public Map<String, Object> getDatabaseMetrics() {
    return getDatabaseStatistics();
  }

  /** Get database performance metrics for admin interface */
  public Map<String, Object> getDatabasePerformanceMetricsForAdmin() {
    return getDatabasePerformanceMetrics();
  }

  /** Get connection pool stats for admin interface */
  public Map<String, Object> getConnectionPoolStats() {
    return getConnectionPoolStatistics();
  }

  /** Perform emergency cleanup */
  public void performEmergencyCleanup() {
    try {
      logger.warn("Performing emergency database cleanup");

      // Clean up old price snapshots more aggressively (30 days instead of 90) using standard SQL
      String cleanupQuery =
          "DELETE FROM price_snapshots WHERE checked_at < CURRENT_DATE - INTERVAL '30 days'";
      int deletedSnapshots = jdbcTemplate.update(cleanupQuery);
      logger.info("Emergency cleanup result: Deleted {} old price snapshots", deletedSnapshots);

      // Update statistics using standard SQL
      try {
        jdbcTemplate.execute("ANALYZE price_snapshots");
        jdbcTemplate.execute("ANALYZE competitor_urls");
        jdbcTemplate.execute("ANALYZE competitor_suggestions");
      } catch (Exception e) {
        logger.warn(
            "Could not update table statistics during emergency cleanup: {}", e.getMessage());
      }

      // Log the emergency cleanup
      try {
        jdbcTemplate.update(
            "INSERT INTO admin_audit_logs (action, details, created_at) VALUES (?, ?, ?)",
            "EMERGENCY_DATABASE_CLEANUP",
            "{\"retention_days\": 30, \"reason\": \"emergency_cleanup\", \"deleted_snapshots\": "
                + deletedSnapshots
                + "}",
            LocalDateTime.now());
      } catch (Exception e) {
        logger.warn("Could not log emergency cleanup to audit logs: {}", e.getMessage());
      }

      // Reset monitoring statistics
      resetStatistics();

    } catch (Exception e) {
      logger.error("Emergency cleanup failed: {}", e.getMessage());
      throw new RuntimeException("Emergency cleanup failed", e);
    }
  }

  /** Get database health indicators for monitoring dashboards */
  public Map<String, String> getHealthIndicators() {
    Map<String, String> indicators = new HashMap<>();

    long total = totalQueries.get();
    if (total > 0) {
      double failureRate = (double) failedQueries.get() / total * 100;
      double slowQueryRate = (double) slowQueries.get() / total * 100;

      // Database reliability indicator
      if (failureRate < 1) {
        indicators.put("reliability", "HEALTHY");
      } else if (failureRate < 5) {
        indicators.put("reliability", "WARNING");
      } else {
        indicators.put("reliability", "CRITICAL");
      }

      // Database performance indicator
      if (slowQueryRate < 10) {
        indicators.put("performance", "HEALTHY");
      } else if (slowQueryRate < 25) {
        indicators.put("performance", "WARNING");
      } else {
        indicators.put("performance", "CRITICAL");
      }
    } else {
      indicators.put("reliability", "NO_DATA");
      indicators.put("performance", "NO_DATA");
    }

    // Connection pool health - use the corrected utilization calculation
    Map<String, Object> poolStats = getConnectionPoolStatistics();
    if (poolStats.containsKey("poolStatus")) {
      String poolStatus = (String) poolStats.get("poolStatus");
      indicators.put("connectionPool", poolStatus);
    } else if (poolStats.containsKey("utilizationPercentage")) {
      // Fallback to manual calculation if poolStatus is not available
      double utilization = (Double) poolStats.get("utilizationPercentage");
      if (utilization < 70) {
        indicators.put("connectionPool", "HEALTHY");
      } else if (utilization < 90) {
        indicators.put("connectionPool", "WARNING");
      } else {
        indicators.put("connectionPool", "CRITICAL");
      }
    } else {
      indicators.put("connectionPool", "UNKNOWN");
    }

    return indicators;
  }
}
