package com.storesight.backend.service;

import com.storesight.backend.config.EnhancedDatabaseConfig;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Service for monitoring database performance, analyzing query patterns, and providing optimization
 * recommendations for Market Intelligence operations.
 */
@Service
public class DatabasePerformanceService {

  private static final Logger log = LoggerFactory.getLogger(DatabasePerformanceService.class);

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired(required = false)
  private EnhancedDatabaseConfig enhancedDatabaseConfig;

  @Value("${database.monitoring.enabled:true}")
  private boolean monitoringEnabled;

  @Value("${database.monitoring.slow-query-threshold:5000}")
  private long slowQueryThreshold;

  @Value("${database.monitoring.analysis-interval-minutes:1440}")
  private int analysisIntervalMinutes;

  private ScheduledExecutorService analysisExecutor;

  @PostConstruct
  public void initialize() {
    if (!monitoringEnabled) {
      log.info("Database performance monitoring is disabled");
      return;
    }

    log.info("Initializing Database Performance Service");

    analysisExecutor =
        Executors.newScheduledThreadPool(
            1,
            r -> {
              Thread t = new Thread(r, "db-performance-analyzer");
              t.setDaemon(true);
              return t;
            });

    // Start nightly performance analysis at 2 AM
    analysisExecutor.scheduleAtFixedRate(
        this::performPerformanceAnalysis,
        getInitialDelayToNextRun(),
        24 * 60, // 24 hours
        TimeUnit.MINUTES);

    log.info("Database performance monitoring scheduled for nightly runs at 2 AM");
  }

  /** Calculate initial delay to next 2 AM run */
  private long getInitialDelayToNextRun() {
    try {
      java.time.LocalDateTime now = java.time.LocalDateTime.now();
      java.time.LocalDateTime nextRun = now.withHour(2).withMinute(0).withSecond(0).withNano(0);

      if (now.compareTo(nextRun) > 0) {
        nextRun = nextRun.plusDays(1);
      }

      return java.time.Duration.between(now, nextRun).toMinutes();
    } catch (Exception e) {
      log.warn("Error calculating initial delay, using 5 minutes: {}", e.getMessage());
      return 5; // Fallback to 5 minutes
    }
  }

  /** Get comprehensive database performance metrics */
  public DatabasePerformanceMetrics getPerformanceMetrics() {
    DatabasePerformanceMetrics metrics = new DatabasePerformanceMetrics();

    try {
      // Get connection pool metrics
      if (enhancedDatabaseConfig != null) {
        EnhancedDatabaseConfig.DatabasePerformanceMetrics poolMetrics =
            enhancedDatabaseConfig.getPerformanceMetrics();
        metrics.connectionPoolMetrics = poolMetrics;
      }

      // Get query performance metrics
      metrics.slowQueries = getSlowQueries();
      metrics.indexUsageStats = getIndexUsageStats();
      metrics.tableSizes = getTableSizes();
      metrics.queryRecommendations = generateQueryRecommendations();

      // Get database size and growth
      metrics.databaseSize = getDatabaseSize();
      metrics.totalConnections = getTotalConnections();
      metrics.activeQueries = getActiveQueries();

      log.debug(
          "Retrieved database performance metrics - slow queries: {}, active queries: {}",
          metrics.slowQueries.size(),
          metrics.activeQueries.size());

    } catch (Exception e) {
      log.error("Error retrieving database performance metrics: {}", e.getMessage(), e);
    }

    return metrics;
  }

  /** Get slow queries from pg_stat_statements */
  public List<SlowQuery> getSlowQueries() {
    List<SlowQuery> slowQueries = new ArrayList<>();

    try {
      String sql =
          """
          SELECT query, calls, total_exec_time, mean_exec_time, rows,
                 stddev_exec_time, min_exec_time, max_exec_time
          FROM pg_stat_statements
          WHERE mean_exec_time > ?
          ORDER BY mean_exec_time DESC
          LIMIT 20
          """;

      jdbcTemplate.query(
          sql,
          rs -> {
            SlowQuery query = new SlowQuery();
            query.query = rs.getString("query");
            query.calls = rs.getLong("calls");
            query.totalExecTime = rs.getDouble("total_exec_time");
            query.meanExecTime = rs.getDouble("mean_exec_time");
            query.rows = rs.getLong("rows");
            query.stddevExecTime = rs.getDouble("stddev_exec_time");
            query.minExecTime = rs.getDouble("min_exec_time");
            query.maxExecTime = rs.getDouble("max_exec_time");
            slowQueries.add(query);
          },
          slowQueryThreshold);

    } catch (Exception e) {
      log.debug(
          "Could not retrieve slow queries (pg_stat_statements may not be available): {}",
          e.getMessage());
    }

    return slowQueries;
  }

  /** Get index usage statistics */
  public List<IndexUsageStat> getIndexUsageStats() {
    List<IndexUsageStat> stats = new ArrayList<>();

    try {
      String sql =
          """
          SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch,
                 CASE WHEN idx_scan = 0 THEN 0.0
                      ELSE ROUND((CAST(idx_tup_read AS DOUBLE PRECISION) / idx_scan), 2)
                 END as usage_ratio
          FROM pg_stat_user_indexes
          WHERE schemaname = 'public'
          AND tablename IN ('competitor_urls', 'price_snapshots', 'competitor_suggestions',
                           'market_intelligence_costs', 'price_alerts')
          ORDER BY idx_scan DESC
          """;

      jdbcTemplate.query(
          sql,
          rs -> {
            IndexUsageStat stat = new IndexUsageStat();
            stat.schemaName = rs.getString("schemaname");
            stat.tableName = rs.getString("tablename");
            stat.indexName = rs.getString("indexname");
            stat.indexScans = rs.getLong("idx_scan");
            stat.tuplesRead = rs.getLong("idx_tup_read");
            stat.tuplesFetched = rs.getLong("idx_tup_fetch");
            stat.usageRatio = rs.getDouble("usage_ratio");
            stats.add(stat);
          });

    } catch (Exception e) {
      log.error("Error retrieving index usage statistics: {}", e.getMessage());
    }

    return stats;
  }

  /** Get table sizes for Market Intelligence tables */
  public List<TableSize> getTableSizes() {
    List<TableSize> sizes = new ArrayList<>();

    try {
      String sql =
          """
          SELECT schemaname, tablename,
                 pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
                 pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty,
                 COALESCE(pc.reltuples::BIGINT, 0) as row_count
          FROM pg_tables pt
          LEFT JOIN pg_class pc ON pc.relname = pt.tablename
          WHERE pt.tablename IN ('competitor_urls', 'price_snapshots', 'competitor_suggestions',
                                'market_intelligence_costs', 'price_alerts')
          ORDER BY pg_total_relation_size(pt.schemaname||'.'||pt.tablename) DESC
          """;

      jdbcTemplate.query(
          sql,
          rs -> {
            TableSize size = new TableSize();
            size.schemaName = rs.getString("schemaname");
            size.tableName = rs.getString("tablename");
            size.sizeBytes = rs.getLong("size_bytes");
            size.sizePretty = rs.getString("size_pretty");
            size.rowCount = rs.getLong("row_count");
            sizes.add(size);
          });

    } catch (Exception e) {
      log.error("Error retrieving table sizes: {}", e.getMessage());
    }

    return sizes;
  }

  /** Get current database size */
  public String getDatabaseSize() {
    try {
      return jdbcTemplate.queryForObject(
          "SELECT pg_size_pretty(pg_database_size(current_database()))", String.class);
    } catch (Exception e) {
      log.error("Error retrieving database size: {}", e.getMessage());
      return "Unknown";
    }
  }

  /** Get total number of connections */
  public int getTotalConnections() {
    try {
      return jdbcTemplate.queryForObject("SELECT count(*) FROM pg_stat_activity", Integer.class);
    } catch (Exception e) {
      log.error("Error retrieving total connections: {}", e.getMessage());
      return 0;
    }
  }

  /** Get currently active queries */
  public List<ActiveQuery> getActiveQueries() {
    List<ActiveQuery> queries = new ArrayList<>();

    try {
      String sql =
          """
          SELECT pid, usename, application_name, client_addr, state,
                 query_start, state_change, query
          FROM pg_stat_activity
          WHERE state = 'active'
          AND query NOT LIKE '%pg_stat_activity%'
          ORDER BY query_start
          """;

      jdbcTemplate.query(
          sql,
          rs -> {
            ActiveQuery query = new ActiveQuery();
            query.pid = rs.getInt("pid");
            query.username = rs.getString("usename");
            query.applicationName = rs.getString("application_name");
            query.clientAddr = rs.getString("client_addr");
            query.state = rs.getString("state");
            query.queryStart = rs.getTimestamp("query_start");
            query.stateChange = rs.getTimestamp("state_change");
            query.query = rs.getString("query");
            queries.add(query);
          });

    } catch (Exception e) {
      log.error("Error retrieving active queries: {}", e.getMessage());
    }

    return queries;
  }

  /** Generate query optimization recommendations */
  public List<QueryRecommendation> generateQueryRecommendations() {
    List<QueryRecommendation> recommendations = new ArrayList<>();

    try {
      // Check for unused indexes
      List<IndexUsageStat> indexStats = getIndexUsageStats();
      for (IndexUsageStat stat : indexStats) {
        if (stat.indexScans == 0) {
          recommendations.add(
              new QueryRecommendation(
                  "UNUSED_INDEX",
                  "Consider dropping unused index: "
                      + stat.indexName
                      + " on table "
                      + stat.tableName,
                  "DROP INDEX " + stat.indexName + ";",
                  "HIGH"));
        }
      }

      // Check for tables without recent statistics
      String statsSql =
          """
          SELECT schemaname, tablename, last_analyze, last_autoanalyze
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
          AND tablename IN ('competitor_urls', 'price_snapshots', 'competitor_suggestions',
                           'market_intelligence_costs', 'price_alerts')
          AND (last_analyze IS NULL OR last_analyze < NOW() - INTERVAL '7 days')
          AND (last_autoanalyze IS NULL OR last_autoanalyze < NOW() - INTERVAL '7 days')
          """;

      jdbcTemplate.query(
          statsSql,
          rs -> {
            String tableName = rs.getString("tablename");
            recommendations.add(
                new QueryRecommendation(
                    "STALE_STATISTICS",
                    "Table " + tableName + " has stale statistics, consider running ANALYZE",
                    "ANALYZE " + tableName + ";",
                    "MEDIUM"));
          });

      // Check for slow queries that could benefit from indexes
      List<SlowQuery> slowQueries = getSlowQueries();
      for (SlowQuery query : slowQueries) {
        if (query.meanExecTime > 10000 && query.calls > 10) { // > 10 seconds, called > 10 times
          recommendations.add(
              new QueryRecommendation(
                  "SLOW_QUERY",
                  "Frequently executed slow query detected (avg: "
                      + String.format("%.2f", query.meanExecTime)
                      + "ms)",
                  "Review query: "
                      + (query.query.length() > 100
                          ? query.query.substring(0, 100) + "..."
                          : query.query),
                  "HIGH"));
        }
      }

      // Check for large tables that might need partitioning
      List<TableSize> tableSizes = getTableSizes();
      for (TableSize size : tableSizes) {
        if (size.rowCount > 1000000) { // > 1M rows
          recommendations.add(
              new QueryRecommendation(
                  "LARGE_TABLE",
                  "Table "
                      + size.tableName
                      + " has "
                      + size.rowCount
                      + " rows, consider partitioning",
                  "Consider partitioning by date or shop_id for table: " + size.tableName,
                  "MEDIUM"));
        }
      }

    } catch (Exception e) {
      log.error("Error generating query recommendations: {}", e.getMessage());
    }

    return recommendations;
  }

  /** Perform periodic performance analysis */
  private void performPerformanceAnalysis() {
    try {
      log.debug("Starting periodic database performance analysis");

      DatabasePerformanceMetrics metrics = getPerformanceMetrics();

      // Log performance summary
      log.info("Database Performance Summary:");
      log.info("  Database size: {}", metrics.databaseSize);
      log.info("  Total connections: {}", metrics.totalConnections);
      log.info("  Active queries: {}", metrics.activeQueries.size());
      log.info("  Slow queries: {}", metrics.slowQueries.size());
      log.info("  Recommendations: {}", metrics.queryRecommendations.size());

      // Log high-priority recommendations
      for (QueryRecommendation rec : metrics.queryRecommendations) {
        if ("HIGH".equals(rec.priority)) {
          log.warn("High Priority DB Recommendation [{}]: {}", rec.type, rec.description);
        }
      }

      // Update table statistics if needed
      updateTableStatistics();

    } catch (Exception e) {
      log.error("Error during periodic performance analysis: {}", e.getMessage(), e);
    }
  }

  /** Update table statistics for better query planning */
  public void updateTableStatistics() {
    try {
      jdbcTemplate.execute("SELECT update_table_statistics()");
      log.debug("Updated table statistics for Market Intelligence tables");
    } catch (Exception e) {
      log.warn("Could not update table statistics: {}", e.getMessage());
    }
  }

  /** Get database performance health status */
  public Map<String, Object> getHealthStatus() {
    Map<String, Object> health = new HashMap<>();

    try {
      DatabasePerformanceMetrics metrics = getPerformanceMetrics();

      health.put("status", "UP");
      health.put("databaseSize", metrics.databaseSize);
      health.put("totalConnections", metrics.totalConnections);
      health.put("activeQueries", metrics.activeQueries.size());
      health.put("slowQueries", metrics.slowQueries.size());
      health.put("recommendations", metrics.queryRecommendations.size());

      if (metrics.connectionPoolMetrics != null) {
        health.put(
            "connectionPool",
            Map.of(
                "active", metrics.connectionPoolMetrics.getActiveConnections(),
                "idle", metrics.connectionPoolMetrics.getIdleConnections(),
                "total", metrics.connectionPoolMetrics.getTotalConnections(),
                "utilization", metrics.connectionPoolMetrics.getConnectionUtilization()));
      }

      // Determine overall health
      boolean hasHighPriorityIssues =
          metrics.queryRecommendations.stream().anyMatch(rec -> "HIGH".equals(rec.priority));

      if (hasHighPriorityIssues || metrics.slowQueries.size() > 10) {
        health.put("status", "DEGRADED");
      }

    } catch (Exception e) {
      log.error("Error getting database health status: {}", e.getMessage());
      health.put("status", "DOWN");
      health.put("error", e.getMessage());
    }

    return health;
  }

  public void shutdown() {
    if (analysisExecutor != null) {
      analysisExecutor.shutdown();
      try {
        if (!analysisExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
          analysisExecutor.shutdownNow();
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        analysisExecutor.shutdownNow();
      }
    }
  }

  // Data classes for metrics
  public static class DatabasePerformanceMetrics {
    public EnhancedDatabaseConfig.DatabasePerformanceMetrics connectionPoolMetrics;
    public List<SlowQuery> slowQueries = new ArrayList<>();
    public List<IndexUsageStat> indexUsageStats = new ArrayList<>();
    public List<TableSize> tableSizes = new ArrayList<>();
    public List<QueryRecommendation> queryRecommendations = new ArrayList<>();
    public List<ActiveQuery> activeQueries = new ArrayList<>();
    public String databaseSize;
    public int totalConnections;
  }

  public static class SlowQuery {
    public String query;
    public long calls;
    public double totalExecTime;
    public double meanExecTime;
    public long rows;
    public double stddevExecTime;
    public double minExecTime;
    public double maxExecTime;
  }

  public static class IndexUsageStat {
    public String schemaName;
    public String tableName;
    public String indexName;
    public long indexScans;
    public long tuplesRead;
    public long tuplesFetched;
    public double usageRatio;
  }

  public static class TableSize {
    public String schemaName;
    public String tableName;
    public long sizeBytes;
    public String sizePretty;
    public long rowCount;
  }

  public static class QueryRecommendation {
    public String type;
    public String description;
    public String suggestion;
    public String priority;

    public QueryRecommendation(
        String type, String description, String suggestion, String priority) {
      this.type = type;
      this.description = description;
      this.suggestion = suggestion;
      this.priority = priority;
    }
  }

  public static class ActiveQuery {
    public int pid;
    public String username;
    public String applicationName;
    public String clientAddr;
    public String state;
    public java.sql.Timestamp queryStart;
    public java.sql.Timestamp stateChange;
    public String query;
  }
}
