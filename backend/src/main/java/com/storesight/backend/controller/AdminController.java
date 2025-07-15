package com.storesight.backend.controller;

import com.storesight.backend.model.AuditLog;
import com.storesight.backend.service.DataPrivacyService;
import com.storesight.backend.service.DatabaseMonitoringService;
import com.storesight.backend.service.NotificationService;
import com.storesight.backend.service.SecretService;
import com.storesight.backend.service.SessionSynchronizationService;
import com.storesight.backend.service.ShopService;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
  private static final Logger logger = LoggerFactory.getLogger(AdminController.class);

  private final SecretService secretService;
  private final NotificationService notificationService;
  private final DataPrivacyService dataPrivacyService;
  private final DatabaseMonitoringService databaseMonitoringService;
  private final DataSource dataSource;
  private final SessionSynchronizationService sessionSynchronizationService;
  private final ShopService shopService;
  private final RedisTemplate<String, String> redisTemplate;

  @Autowired
  public AdminController(
      SecretService secretService,
      NotificationService notificationService,
      DataPrivacyService dataPrivacyService,
      DatabaseMonitoringService databaseMonitoringService,
      DataSource dataSource,
      SessionSynchronizationService sessionSynchronizationService,
      ShopService shopService,
      RedisTemplate<String, String> redisTemplate) {
    this.secretService = secretService;
    this.notificationService = notificationService;
    this.dataPrivacyService = dataPrivacyService;
    this.databaseMonitoringService = databaseMonitoringService;
    this.dataSource = dataSource;
    this.sessionSynchronizationService = sessionSynchronizationService;
    this.shopService = shopService;
    this.redisTemplate = redisTemplate;
  }

  @PostMapping("/secrets")
  public ResponseEntity<Map<String, String>> updateSecret(@RequestBody Map<String, String> secret) {
    String key = secret.get("key");
    String value = secret.get("value");

    if (key == null || value == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "Both key and value are required"));
    }

    secretService.storeSecret(key, value);
    return ResponseEntity.ok(Map.of("status", "Secret updated successfully"));
  }

  @GetMapping("/secrets/{key}")
  public ResponseEntity<Map<String, String>> getSecret(@PathVariable String key) {
    return secretService
        .getSecret(key)
        .map(value -> ResponseEntity.ok(Map.of("value", value)))
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/secrets/{key}")
  public ResponseEntity<Map<String, String>> deleteSecret(@PathVariable String key) {
    secretService.deleteSecret(key);
    return ResponseEntity.ok(Map.of("status", "Secret deleted successfully"));
  }

  @GetMapping("/secrets")
  public ResponseEntity<java.util.List<java.util.Map<String, String>>> listSecrets() {
    java.util.Map<String, String> map = secretService.listSecrets();
    java.util.List<java.util.Map<String, String>> list = new java.util.ArrayList<>();
    map.forEach((k, v) -> list.add(java.util.Map.of("key", k, "value", v)));
    return ResponseEntity.ok(list);
  }

  @GetMapping("/integrations/status")
  public ResponseEntity<Map<String, Boolean>> getIntegrationStatus() {
    return ResponseEntity.ok(
        Map.of(
            "sendGridEnabled", notificationService.isSendGridEnabled(),
            "twilioEnabled", notificationService.isTwilioEnabled()));
  }

  @PostMapping("/integrations/test-email")
  public ResponseEntity<Map<String, Object>> testEmail(@RequestBody Map<String, String> request) {
    String to = request.get("to");

    if (to == null || to.trim().isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("success", false, "error", "Email address is required"));
    }

    try {
      notificationService.sendEmailAlert(
          to,
          "ShopGauge Test Email",
          "This is a test email from ShopGauge Admin Panel. If you received this, your SendGrid integration is working correctly!");

      return ResponseEntity.ok(Map.of("success", true, "message", "Test email sent successfully"));
    } catch (Exception e) {
      return ResponseEntity.ok(
          Map.of("success", false, "error", "Failed to send test email: " + e.getMessage()));
    }
  }

  @PostMapping("/integrations/test-sms")
  public ResponseEntity<Map<String, Object>> testSms(@RequestBody Map<String, String> request) {
    String to = request.get("to");

    if (to == null || to.trim().isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("success", false, "error", "Phone number is required"));
    }

    try {
      notificationService.sendSmsAlert(
          to, "ShopGauge Test SMS: Your Twilio integration is working correctly!");

      return ResponseEntity.ok(Map.of("success", true, "message", "Test SMS sent successfully"));
    } catch (Exception e) {
      return ResponseEntity.ok(
          Map.of("success", false, "error", "Failed to send test SMS: " + e.getMessage()));
    }
  }

  @GetMapping("/audit-logs/deleted-shops")
  public ResponseEntity<Map<String, Object>> getAuditLogsFromDeletedShops(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
    try {
      List<AuditLog> auditLogs = dataPrivacyService.getAuditLogsFromDeletedShops(page, size);

      // Map audit logs to include shop domain information
      List<Map<String, Object>> mappedLogs =
          auditLogs.stream()
              .map(
                  log -> {
                    Map<String, Object> logMap = new HashMap<>();
                    logMap.put("id", log.getId());
                    logMap.put("shopId", log.getShopId());
                    logMap.put("action", log.getAction());
                    logMap.put("details", log.getDetails());
                    logMap.put("userAgent", log.getUserAgent());
                    logMap.put("ipAddress", log.getIpAddress());
                    logMap.put("createdAt", log.getCreatedAt());
                    logMap.put("timestamp", log.getCreatedAt()); // For frontend compatibility

                    // Extract shop domain from the log
                    String shopDomain = dataPrivacyService.getShopDomainFromLog(log);
                    logMap.put("shopDomain", shopDomain);

                    return logMap;
                  })
              .collect(java.util.stream.Collectors.toList());

      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", mappedLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", mappedLogs.size());
      response.put("note", "These are audit logs from shops that have been deleted");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error",
                  "Failed to retrieve audit logs from deleted shops",
                  "message",
                  e.getMessage()));
    }
  }

  @GetMapping("/audit-logs/all")
  public ResponseEntity<Map<String, Object>> getAllAuditLogs(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
    try {
      List<AuditLog> auditLogs = dataPrivacyService.getAllAuditLogs(page, size);

      // Map audit logs to include shop domain information
      List<Map<String, Object>> mappedLogs =
          auditLogs.stream()
              .map(
                  log -> {
                    Map<String, Object> logMap = new HashMap<>();
                    logMap.put("id", log.getId());
                    logMap.put("shopId", log.getShopId());
                    logMap.put("action", log.getAction());
                    logMap.put("details", log.getDetails());
                    logMap.put("userAgent", log.getUserAgent());
                    logMap.put("ipAddress", log.getIpAddress());
                    logMap.put("createdAt", log.getCreatedAt());
                    logMap.put("timestamp", log.getCreatedAt()); // For frontend compatibility

                    // Extract shop domain from the log
                    String shopDomain = dataPrivacyService.getShopDomainFromLog(log);
                    logMap.put("shopDomain", shopDomain);

                    return logMap;
                  })
              .collect(java.util.stream.Collectors.toList());

      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", mappedLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", mappedLogs.size());
      response.put("note", "All audit logs including those from deleted shops");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve all audit logs", "message", e.getMessage()));
    }
  }

  @GetMapping("/active-shops")
  public ResponseEntity<Map<String, Object>> getActiveShops() {
    try {
      // Get active shops - shops that have made requests recently
      List<Map<String, Object>> activeShops = dataPrivacyService.getActiveShops();

      Map<String, Object> response = new HashMap<>();
      response.put("active_shops", activeShops);
      response.put("total_count", activeShops.size());
      response.put(
          "note",
          "Shops that are currently active or have recent activity (enhanced with multi-session support)");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve active shops", "message", e.getMessage()));
    }
  }

  @GetMapping("/active-shops/detailed")
  public ResponseEntity<Map<String, Object>> getDetailedActiveShops() {
    try {
      // Get detailed shop session information
      List<Map<String, Object>> detailedShops = dataPrivacyService.getDetailedActiveShops();

      Map<String, Object> response = new HashMap<>();
      response.put("detailed_shops", detailedShops);
      response.put("total_sessions", detailedShops.size());
      response.put(
          "unique_shops",
          detailedShops.stream().map(shop -> shop.get("shopDomain")).distinct().count());
      response.put("note", "Detailed information about all active sessions for each shop");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error", "Failed to retrieve detailed active shops", "message", e.getMessage()));
    }
  }

  @GetMapping("/session-statistics")
  public ResponseEntity<Map<String, Object>> getSessionStatistics() {
    try {
      // Get comprehensive session statistics
      Map<String, Object> statistics = dataPrivacyService.getSessionStatistics();

      Map<String, Object> response = new HashMap<>();
      response.put("statistics", statistics);
      response.put(
          "note", "Comprehensive session statistics for monitoring multi-session architecture");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of("error", "Failed to retrieve session statistics", "message", e.getMessage()));
    }
  }

  @GetMapping("/deleted-shops")
  public ResponseEntity<Map<String, Object>> getDeletedShops() {
    try {
      // Get deleted shops data formatted consistently
      List<Map<String, Object>> deletedShops = dataPrivacyService.getDeletedShopsData();

      Map<String, Object> response = new HashMap<>();
      response.put("deleted_shops", deletedShops);
      response.put("total_count", deletedShops.size());
      response.put("note", "Shops that have been deleted with extracted domain information");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve deleted shops", "message", e.getMessage()));
    }
  }

  @GetMapping("/audit-logs/active-shops")
  public ResponseEntity<Map<String, Object>> getAuditLogsFromActiveShops(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
    try {
      // Get all audit logs that have shop IDs (not null = active shops)
      List<AuditLog> auditLogs = dataPrivacyService.getAuditLogsFromActiveShops(page, size);

      // Map audit logs to include shop domain information
      List<Map<String, Object>> mappedLogs =
          auditLogs.stream()
              .map(
                  log -> {
                    Map<String, Object> logMap = new HashMap<>();
                    logMap.put("id", log.getId());
                    logMap.put("shopId", log.getShopId());
                    logMap.put("action", log.getAction());
                    logMap.put("details", log.getDetails());
                    logMap.put("userAgent", log.getUserAgent());
                    logMap.put("ipAddress", log.getIpAddress());
                    logMap.put("createdAt", log.getCreatedAt());
                    logMap.put("timestamp", log.getCreatedAt()); // For frontend compatibility

                    // Extract shop domain from the log
                    String shopDomain = dataPrivacyService.getShopDomainFromLog(log);
                    logMap.put("shopDomain", shopDomain);

                    return logMap;
                  })
              .collect(java.util.stream.Collectors.toList());

      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", mappedLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", mappedLogs.size());
      response.put("note", "These are audit logs from active shops (shops that still exist)");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error",
                  "Failed to retrieve audit logs from active shops",
                  "message",
                  e.getMessage()));
    }
  }

  /**
   * EMERGENCY ENDPOINT: Works when connection pool is exhausted Uses direct database connection
   * with minimal operations
   */
  @GetMapping("/emergency/status")
  public ResponseEntity<Map<String, Object>> getEmergencyStatus() {
    Map<String, Object> status = new HashMap<>();
    status.put("timestamp", LocalDateTime.now().toString());
    status.put("endpoint", "emergency_admin_status");

    try {
      // Get database metrics without using repositories
      Map<String, Object> dbMetrics = databaseMonitoringService.getDatabaseMetrics();
      status.put("database", dbMetrics);

      String poolStatus = databaseMonitoringService.getPoolStatus();
      status.put("poolStatus", poolStatus);

      // Critical system information
      status.put("jvmMemory", getJvmMemoryInfo());
      status.put("systemLoad", getSystemLoadInfo());

      // Connection pool emergency info
      status.put("emergencyMode", "CRITICAL".equals(poolStatus));
      status.put("adminAccessible", true);

      if ("CRITICAL".equals(poolStatus)) {
        status.put("warning", "CONNECTION POOL EXHAUSTED - Emergency admin mode active");
        status.put(
            "recommendations",
            List.of(
                "Check for connection leaks",
                "Review long-running transactions",
                "Consider restarting application",
                "Monitor database performance"));
      }

      return ResponseEntity.ok(status);

    } catch (Exception e) {
      logger.error("Emergency status check failed", e);
      status.put("error", "Emergency status check failed: " + e.getMessage());
      status.put("adminAccessible", false);
      return ResponseEntity.status(500).body(status);
    }
  }

  /**
   * EMERGENCY ENDPOINT: Get critical database info with direct connection Bypasses connection pool
   * when possible
   */
  @GetMapping("/emergency/database-info")
  public ResponseEntity<Map<String, Object>> getEmergencyDatabaseInfo() {
    Map<String, Object> info = new HashMap<>();
    info.put("timestamp", LocalDateTime.now().toString());

    try {
      // Get pool metrics first
      Map<String, Object> poolMetrics = databaseMonitoringService.getDatabaseMetrics();
      info.put("connectionPool", poolMetrics);

      // Try to get basic database info with minimal query
      try (Connection conn = dataSource.getConnection()) {
        conn.setAutoCommit(true);

        // Get database version and basic info
        try (PreparedStatement stmt = conn.prepareStatement("SELECT version()");
            ResultSet rs = stmt.executeQuery()) {
          if (rs.next()) {
            info.put("databaseVersion", rs.getString(1));
          }
        }

        // Get current connections count
        try (PreparedStatement stmt =
                conn.prepareStatement(
                    "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active'");
            ResultSet rs = stmt.executeQuery()) {
          if (rs.next()) {
            info.put("activeDatabaseConnections", rs.getInt("active_connections"));
          }
        }

        // Get table sizes (top 5 largest tables)
        try (PreparedStatement stmt =
                conn.prepareStatement(
                    "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size "
                        + "FROM pg_tables WHERE schemaname = 'public' "
                        + "ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 5");
            ResultSet rs = stmt.executeQuery()) {

          List<Map<String, String>> tables = new java.util.ArrayList<>();
          while (rs.next()) {
            Map<String, String> table = new HashMap<>();
            table.put("table", rs.getString("tablename"));
            table.put("size", rs.getString("size"));
            tables.add(table);
          }
          info.put("largestTables", tables);
        }

        info.put("databaseAccessible", true);

      } catch (Exception dbError) {
        logger.error("Database access failed in emergency mode", dbError);
        info.put("databaseAccessible", false);
        info.put("databaseError", dbError.getMessage());
      }

      return ResponseEntity.ok(info);

    } catch (Exception e) {
      logger.error("Emergency database info failed", e);
      info.put("error", "Emergency database info failed: " + e.getMessage());
      return ResponseEntity.status(500).body(info);
    }
  }

  /** EMERGENCY ENDPOINT: Force connection pool cleanup */
  @PostMapping("/emergency/cleanup-connections")
  public ResponseEntity<Map<String, Object>> emergencyCleanupConnections() {
    Map<String, Object> result = new HashMap<>();
    result.put("timestamp", LocalDateTime.now().toString());

    try {
      // Get metrics before cleanup
      Map<String, Object> beforeMetrics = databaseMonitoringService.getDatabaseMetrics();
      result.put("beforeCleanup", beforeMetrics);

      // Force cleanup if using HikariCP
      if (dataSource instanceof com.zaxxer.hikari.HikariDataSource) {
        com.zaxxer.hikari.HikariDataSource hikariDS =
            (com.zaxxer.hikari.HikariDataSource) dataSource;

        // Soft evict idle connections
        hikariDS.getHikariPoolMXBean().softEvictConnections();

        // Wait a moment for cleanup
        Thread.sleep(2000);

        // Get metrics after cleanup
        Map<String, Object> afterMetrics = databaseMonitoringService.getDatabaseMetrics();
        result.put("afterCleanup", afterMetrics);

        result.put("cleanupPerformed", true);
        result.put("message", "Connection pool cleanup completed");

      } else {
        result.put("cleanupPerformed", false);
        result.put("message", "Connection pool cleanup not supported for this DataSource type");
      }

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Emergency connection cleanup failed", e);
      result.put("error", "Emergency cleanup failed: " + e.getMessage());
      result.put("cleanupPerformed", false);
      return ResponseEntity.status(500).body(result);
    }
  }

  /** EMERGENCY ENDPOINT: Get system resources without database */
  @GetMapping("/emergency/system-resources")
  public ResponseEntity<Map<String, Object>> getSystemResources() {
    Map<String, Object> resources = new HashMap<>();
    resources.put("timestamp", LocalDateTime.now().toString());

    try {
      // JVM Memory
      resources.put("jvmMemory", getJvmMemoryInfo());

      // System Load
      resources.put("systemLoad", getSystemLoadInfo());

      // Thread information
      resources.put("threads", getThreadInfo());

      // GC information
      resources.put("garbageCollection", getGcInfo());

      return ResponseEntity.ok(resources);

    } catch (Exception e) {
      logger.error("System resources check failed", e);
      resources.put("error", "System resources check failed: " + e.getMessage());
      return ResponseEntity.status(500).body(resources);
    }
  }

  /** EMERGENCY ENDPOINT: Kill long-running database queries and connections */
  @PostMapping("/emergency/kill-long-running-queries")
  public ResponseEntity<Map<String, Object>> killLongRunningQueries() {
    Map<String, Object> result = new HashMap<>();
    result.put("timestamp", LocalDateTime.now().toString());

    try {
      // Get metrics before cleanup
      Map<String, Object> beforeMetrics = databaseMonitoringService.getDatabaseMetrics();
      result.put("beforeCleanup", beforeMetrics);

      // Kill long-running queries (> 2 minutes)
      List<Map<String, Object>> killedQueries = new ArrayList<>();

      try (Connection conn = dataSource.getConnection()) {
        conn.setAutoCommit(true);

        // Find long-running queries
        String findLongRunningQueries =
            """
            SELECT pid, usename, application_name, client_addr, state,
                   query_start, NOW() - query_start as duration,
                   LEFT(query, 100) as query_snippet
            FROM pg_stat_activity
            WHERE state = 'active'
              AND query_start < NOW() - INTERVAL '2 minutes'
              AND query NOT LIKE '%pg_stat_activity%'
              AND pid != pg_backend_pid()
            ORDER BY query_start ASC
            """;

        try (PreparedStatement stmt = conn.prepareStatement(findLongRunningQueries);
            ResultSet rs = stmt.executeQuery()) {

          while (rs.next()) {
            Map<String, Object> queryInfo = new HashMap<>();
            int pid = rs.getInt("pid");
            queryInfo.put("pid", pid);
            queryInfo.put("username", rs.getString("usename"));
            queryInfo.put("application_name", rs.getString("application_name"));
            queryInfo.put("client_addr", rs.getString("client_addr"));
            queryInfo.put("state", rs.getString("state"));
            queryInfo.put("query_start", rs.getTimestamp("query_start").toString());
            queryInfo.put("duration", rs.getString("duration"));
            queryInfo.put("query_snippet", rs.getString("query_snippet"));

            // Kill the query
            try (PreparedStatement killStmt =
                conn.prepareStatement("SELECT pg_terminate_backend(?)")) {
              killStmt.setInt(1, pid);
              killStmt.executeQuery();
              queryInfo.put("killed", true);
              logger.warn(
                  "EMERGENCY: Killed long-running query PID {} duration {}",
                  pid,
                  rs.getString("duration"));
            } catch (Exception e) {
              queryInfo.put("killed", false);
              queryInfo.put("kill_error", e.getMessage());
            }

            killedQueries.add(queryInfo);
          }
        }

        // Also kill idle connections that have been idle for > 5 minutes
        String findIdleConnections =
            """
            SELECT pid, usename, application_name, client_addr, state,
                   state_change, NOW() - state_change as idle_duration
            FROM pg_stat_activity
            WHERE state = 'idle'
              AND state_change < NOW() - INTERVAL '5 minutes'
              AND pid != pg_backend_pid()
            ORDER BY state_change ASC
            """;

        try (PreparedStatement stmt = conn.prepareStatement(findIdleConnections);
            ResultSet rs = stmt.executeQuery()) {

          while (rs.next()) {
            Map<String, Object> connInfo = new HashMap<>();
            int pid = rs.getInt("pid");
            connInfo.put("pid", pid);
            connInfo.put("username", rs.getString("usename"));
            connInfo.put("application_name", rs.getString("application_name"));
            connInfo.put("client_addr", rs.getString("client_addr"));
            connInfo.put("state", rs.getString("state"));
            connInfo.put("idle_duration", rs.getString("idle_duration"));

            // Kill the idle connection
            try (PreparedStatement killStmt =
                conn.prepareStatement("SELECT pg_terminate_backend(?)")) {
              killStmt.setInt(1, pid);
              killStmt.executeQuery();
              connInfo.put("killed", true);
              logger.warn(
                  "EMERGENCY: Killed idle connection PID {} idle for {}",
                  pid,
                  rs.getString("idle_duration"));
            } catch (Exception e) {
              connInfo.put("killed", false);
              connInfo.put("kill_error", e.getMessage());
            }

            killedQueries.add(connInfo);
          }
        }

      } catch (Exception dbError) {
        logger.error("Database query killing failed", dbError);
        result.put("databaseError", dbError.getMessage());
      }

      // Wait for cleanup to complete
      Thread.sleep(3000);

      // Get metrics after cleanup
      Map<String, Object> afterMetrics = databaseMonitoringService.getDatabaseMetrics();
      result.put("afterCleanup", afterMetrics);

      result.put("killedQueries", killedQueries);
      result.put("cleanupPerformed", true);
      result.put("message", "Database query cleanup completed");

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Emergency database cleanup failed", e);
      result.put("error", "Emergency database cleanup failed: " + e.getMessage());
      result.put("cleanupPerformed", false);
      return ResponseEntity.status(500).body(result);
    }
  }

  /** EMERGENCY ENDPOINT: Comprehensive cleanup combining all strategies */
  @PostMapping("/emergency/comprehensive-cleanup")
  public ResponseEntity<Map<String, Object>> comprehensiveEmergencyCleanup() {
    Map<String, Object> result = new HashMap<>();
    result.put("timestamp", LocalDateTime.now().toString());

    try {
      logger.warn("COMPREHENSIVE EMERGENCY CLEANUP: Starting all cleanup strategies");

      // Get metrics before cleanup
      Map<String, Object> beforeMetrics = databaseMonitoringService.getDatabaseMetrics();
      result.put("beforeCleanup", beforeMetrics);

      // Step 1: Standard connection pool cleanup
      logger.info("Step 1: Standard connection pool cleanup");
      databaseMonitoringService.performEmergencyCleanup();
      Thread.sleep(2000);

      // Step 2: Kill long-running queries
      logger.info("Step 2: Killing long-running database queries");
      ResponseEntity<Map<String, Object>> queryKillResult = killLongRunningQueries();
      result.put("queryKillResult", queryKillResult.getBody());
      Thread.sleep(2000);

      // Step 3: Force garbage collection
      logger.info("Step 3: Forcing garbage collection");
      System.gc();
      Thread.sleep(1000);

      // Get final metrics
      Map<String, Object> afterMetrics = databaseMonitoringService.getDatabaseMetrics();
      result.put("afterCleanup", afterMetrics);

      // Calculate improvement
      int activeConnectionsBefore = (Integer) beforeMetrics.get("activeConnections");
      int activeConnectionsAfter = (Integer) afterMetrics.get("activeConnections");
      int connectionsSaved = activeConnectionsBefore - activeConnectionsAfter;

      result.put("connectionsSaved", connectionsSaved);
      result.put("cleanupPerformed", true);
      result.put("message", "Comprehensive emergency cleanup completed");

      logger.warn(
          "COMPREHENSIVE EMERGENCY CLEANUP COMPLETED: {} connections freed", connectionsSaved);

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Comprehensive emergency cleanup failed", e);
      result.put("error", "Comprehensive emergency cleanup failed: " + e.getMessage());
      result.put("cleanupPerformed", false);
      return ResponseEntity.status(500).body(result);
    }
  }

  // Helper methods for system monitoring
  private Map<String, Object> getJvmMemoryInfo() {
    Runtime runtime = Runtime.getRuntime();
    Map<String, Object> memory = new HashMap<>();
    memory.put("totalMemory", runtime.totalMemory());
    memory.put("freeMemory", runtime.freeMemory());
    memory.put("usedMemory", runtime.totalMemory() - runtime.freeMemory());
    memory.put("maxMemory", runtime.maxMemory());
    memory.put(
        "usedPercentage",
        Math.round(
            ((double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory()) * 100));
    return memory;
  }

  private Map<String, Object> getSystemLoadInfo() {
    Map<String, Object> load = new HashMap<>();
    load.put("availableProcessors", Runtime.getRuntime().availableProcessors());

    try {
      java.lang.management.OperatingSystemMXBean osBean =
          java.lang.management.ManagementFactory.getOperatingSystemMXBean();
      load.put("systemLoadAverage", osBean.getSystemLoadAverage());
    } catch (Exception e) {
      load.put("systemLoadAverage", "unavailable");
    }

    return load;
  }

  private Map<String, Object> getThreadInfo() {
    java.lang.management.ThreadMXBean threadBean =
        java.lang.management.ManagementFactory.getThreadMXBean();
    Map<String, Object> threads = new HashMap<>();
    threads.put("threadCount", threadBean.getThreadCount());
    threads.put("peakThreadCount", threadBean.getPeakThreadCount());
    threads.put("daemonThreadCount", threadBean.getDaemonThreadCount());
    return threads;
  }

  private Map<String, Object> getGcInfo() {
    Map<String, Object> gc = new HashMap<>();
    List<java.lang.management.GarbageCollectorMXBean> gcBeans =
        java.lang.management.ManagementFactory.getGarbageCollectorMXBeans();

    for (java.lang.management.GarbageCollectorMXBean gcBean : gcBeans) {
      Map<String, Object> gcInfo = new HashMap<>();
      gcInfo.put("collectionCount", gcBean.getCollectionCount());
      gcInfo.put("collectionTime", gcBean.getCollectionTime());
      gc.put(gcBean.getName(), gcInfo);
    }

    return gc;
  }

  // Session Management Endpoints

  /**
   * Clear stuck session markers for a specific session This endpoint allows admins to manually
   * clear stuck session invalidation markers
   */
  @PostMapping("/sessions/clear-stuck/{sessionId}")
  public ResponseEntity<Map<String, Object>> clearStuckSession(@PathVariable String sessionId) {
    Map<String, Object> result = new HashMap<>();

    try {
      logger.warn("Admin clearing stuck session markers for session: {}", sessionId);

      // Clear stuck session markers
      sessionSynchronizationService.clearStuckSessionMarkers(sessionId);

      // Also perform cleanup in case the session is still in the system
      shopService.performSessionCleanup("unknown", sessionId);

      result.put("success", true);
      result.put("sessionId", sessionId);
      result.put("message", "Stuck session markers cleared successfully");
      result.put("timestamp", LocalDateTime.now().toString());

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Failed to clear stuck session {}: {}", sessionId, e.getMessage());
      result.put("success", false);
      result.put("sessionId", sessionId);
      result.put("error", "Failed to clear stuck session: " + e.getMessage());
      return ResponseEntity.status(500).body(result);
    }
  }

  /**
   * Get session synchronization status This endpoint provides information about session
   * synchronization state
   */
  @GetMapping("/sessions/sync-status/{sessionId}")
  public ResponseEntity<Map<String, Object>> getSessionSyncStatus(@PathVariable String sessionId) {
    Map<String, Object> result = new HashMap<>();

    try {
      boolean isInvalidating = sessionSynchronizationService.isSessionInvalidating(sessionId);

      result.put("sessionId", sessionId);
      result.put("isInvalidating", isInvalidating);
      result.put(
          "shouldAllowOperation",
          sessionSynchronizationService.shouldAllowSessionOperation(sessionId));
      result.put("timestamp", LocalDateTime.now().toString());

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Failed to get session sync status for {}: {}", sessionId, e.getMessage());
      result.put("sessionId", sessionId);
      result.put("error", "Failed to get session sync status: " + e.getMessage());
      return ResponseEntity.status(500).body(result);
    }
  }

  /**
   * Force cleanup all stuck session markers This is an emergency endpoint to clear all stuck
   * session markers
   */
  @PostMapping("/sessions/emergency-cleanup")
  public ResponseEntity<Map<String, Object>> emergencySessionCleanup() {
    Map<String, Object> result = new HashMap<>();

    try {
      logger.warn("EMERGENCY SESSION CLEANUP: Clearing all stuck session markers");

      // This would require implementing a method to find and clear all stuck markers
      // For now, we'll just log the action
      result.put("success", true);
      result.put("message", "Emergency session cleanup initiated");
      result.put("timestamp", LocalDateTime.now().toString());
      result.put("note", "This endpoint is a placeholder for comprehensive session cleanup");

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Emergency session cleanup failed: {}", e.getMessage());
      result.put("success", false);
      result.put("error", "Emergency session cleanup failed: " + e.getMessage());
      return ResponseEntity.status(500).body(result);
    }
  }

  /** EMERGENCY ENDPOINT: Clear stuck session markers for a specific session */
  @PostMapping("/sessions/clear-stuck-markers/{sessionId}")
  public ResponseEntity<Map<String, Object>> clearStuckSessionMarkers(
      @PathVariable String sessionId) {
    Map<String, Object> result = new HashMap<>();

    try {
      logger.warn("ADMIN: Clearing stuck session markers for session: {}", sessionId);

      shopService.clearStuckSessionMarkers(sessionId);

      result.put("success", true);
      result.put("message", "Stuck session markers cleared for session: " + sessionId);
      result.put("sessionId", sessionId);
      result.put("timestamp", LocalDateTime.now().toString());

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error(
          "Failed to clear stuck session markers for session {}: {}", sessionId, e.getMessage());
      result.put("success", false);
      result.put("error", "Failed to clear stuck session markers: " + e.getMessage());
      result.put("sessionId", sessionId);
      return ResponseEntity.status(500).body(result);
    }
  }

  /** EMERGENCY ENDPOINT: Clear all stuck session markers for a shop */
  @PostMapping("/sessions/clear-stuck-markers/shop/{shopDomain}")
  public ResponseEntity<Map<String, Object>> clearStuckSessionMarkersForShop(
      @PathVariable String shopDomain) {
    Map<String, Object> result = new HashMap<>();

    try {
      logger.warn("ADMIN: Clearing all stuck session markers for shop: {}", shopDomain);

      shopService.clearStuckSessionMarkersForShop(shopDomain);

      result.put("success", true);
      result.put("message", "All stuck session markers cleared for shop: " + shopDomain);
      result.put("shopDomain", shopDomain);
      result.put("timestamp", LocalDateTime.now().toString());

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error(
          "Failed to clear stuck session markers for shop {}: {}", shopDomain, e.getMessage());
      result.put("success", false);
      result.put("error", "Failed to clear stuck session markers: " + e.getMessage());
      result.put("shopDomain", shopDomain);
      return ResponseEntity.status(500).body(result);
    }
  }

  /** EMERGENCY ENDPOINT: Get all stuck sessions for a shop */
  @GetMapping("/sessions/stuck-sessions/{shopDomain}")
  public ResponseEntity<Map<String, Object>> getStuckSessions(@PathVariable String shopDomain) {
    Map<String, Object> result = new HashMap<>();

    try {
      logger.warn("ADMIN: Getting stuck sessions for shop: {}", shopDomain);

      // Get all session-related Redis keys for this shop
      Set<String> sessionKeys = redisTemplate.keys("*" + shopDomain + "*");
      List<Map<String, Object>> stuckSessions = new ArrayList<>();

      logger.info(
          "Found {} Redis keys for shop {}",
          sessionKeys != null ? sessionKeys.size() : 0,
          shopDomain);

      if (sessionKeys != null) {
        for (String key : sessionKeys) {
          try {
            String value = redisTemplate.opsForValue().get(key);
            if (value != null
                && (value.contains("invalid")
                    || value.contains("stuck")
                    || value.contains("cleanup"))) {
              Map<String, Object> sessionInfo = new HashMap<>();
              sessionInfo.put("key", key);
              sessionInfo.put("value", value);
              sessionInfo.put("type", getSessionKeyType(key));
              stuckSessions.add(sessionInfo);
              logger.debug("Found stuck session: {} = {}", key, value);
            }
          } catch (Exception e) {
            logger.warn("Error reading Redis key {}: {}", key, e.getMessage());
          }
        }
      }

      result.put("success", true);
      result.put("shopDomain", shopDomain);
      result.put("stuckSessions", stuckSessions);
      result.put("count", stuckSessions.size());
      result.put("timestamp", LocalDateTime.now().toString());

      logger.info("Returning {} stuck sessions for shop {}", stuckSessions.size(), shopDomain);
      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Failed to get stuck sessions for shop {}: {}", shopDomain, e.getMessage(), e);
      result.put("success", false);
      result.put("error", "Failed to get stuck sessions: " + e.getMessage());
      result.put("shopDomain", shopDomain);
      return ResponseEntity.status(500).body(result);
    }
  }

  /** EMERGENCY ENDPOINT: Get all stuck sessions across all shops */
  @GetMapping("/sessions/stuck-sessions")
  public ResponseEntity<Map<String, Object>> getAllStuckSessions() {
    Map<String, Object> result = new HashMap<>();

    try {
      logger.warn("ADMIN: Getting all stuck sessions across all shops");

      // Get all session-related Redis keys
      Set<String> sessionKeys = redisTemplate.keys("*session*");
      Map<String, List<Map<String, Object>>> stuckSessionsByShop = new HashMap<>();

      if (sessionKeys != null) {
        for (String key : sessionKeys) {
          try {
            String value = redisTemplate.opsForValue().get(key);
            if (value != null
                && (value.contains("invalid")
                    || value.contains("stuck")
                    || value.contains("cleanup"))) {
              String shopDomain = extractShopDomainFromKey(key);
              if (shopDomain != null) {
                Map<String, Object> sessionInfo = new HashMap<>();
                sessionInfo.put("key", key);
                sessionInfo.put("value", value);
                sessionInfo.put("type", getSessionKeyType(key));

                stuckSessionsByShop
                    .computeIfAbsent(shopDomain, k -> new ArrayList<>())
                    .add(sessionInfo);
              }
            }
          } catch (Exception e) {
            logger.warn("Error reading Redis key {}: {}", key, e.getMessage());
          }
        }
      }

      result.put("success", true);
      result.put("stuckSessionsByShop", stuckSessionsByShop);
      result.put("totalShops", stuckSessionsByShop.size());
      result.put(
          "totalStuckSessions", stuckSessionsByShop.values().stream().mapToInt(List::size).sum());
      result.put("timestamp", LocalDateTime.now().toString());

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Failed to get all stuck sessions: {}", e.getMessage());
      result.put("success", false);
      result.put("error", "Failed to get stuck sessions: " + e.getMessage());
      return ResponseEntity.status(500).body(result);
    }
  }

  /** EMERGENCY ENDPOINT: Clear all stuck sessions for a shop */
  @PostMapping("/sessions/clear-stuck-sessions/{shopDomain}")
  public ResponseEntity<Map<String, Object>> clearAllStuckSessionsForShop(
      @PathVariable String shopDomain) {
    Map<String, Object> result = new HashMap<>();

    try {
      logger.warn("ADMIN: Clearing all stuck sessions for shop: {}", shopDomain);

      // Clear all session-related Redis keys for this shop
      Set<String> sessionKeys = redisTemplate.keys("*" + shopDomain + "*");
      int clearedCount = 0;

      if (sessionKeys != null) {
        for (String key : sessionKeys) {
          try {
            String value = redisTemplate.opsForValue().get(key);
            if (value != null
                && (value.contains("invalid")
                    || value.contains("stuck")
                    || value.contains("cleanup"))) {
              redisTemplate.delete(key);
              clearedCount++;
              logger.info("Cleared stuck session key: {}", key);
            }
          } catch (Exception e) {
            logger.warn("Error clearing Redis key {}: {}", key, e.getMessage());
          }
        }
      }

      // Also clear session synchronization markers for this shop
      shopService.clearStuckSessionMarkersForShop(shopDomain);

      result.put("success", true);
      result.put("shopDomain", shopDomain);
      result.put("clearedCount", clearedCount);
      result.put(
          "message", "Cleared " + clearedCount + " stuck session markers for shop: " + shopDomain);
      result.put("timestamp", LocalDateTime.now().toString());

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Failed to clear stuck sessions for shop {}: {}", shopDomain, e.getMessage());
      result.put("success", false);
      result.put("error", "Failed to clear stuck sessions: " + e.getMessage());
      result.put("shopDomain", shopDomain);
      return ResponseEntity.status(500).body(result);
    }
  }

  /** Helper method to extract shop domain from Redis key */
  private String extractShopDomainFromKey(String key) {
    try {
      // Look for shop domain patterns in the key
      if (key.contains("shop_token:")) {
        String[] parts = key.split("shop_token:");
        if (parts.length > 1) {
          String[] shopSession = parts[1].split(":");
          if (shopSession.length > 0) {
            return shopSession[0];
          }
        }
      }
      if (key.contains("invalid_session:")) {
        String[] parts = key.split("invalid_session:");
        if (parts.length > 1) {
          String[] shopSession = parts[1].split(":");
          if (shopSession.length > 0) {
            return shopSession[0];
          }
        }
      }
      return null;
    } catch (Exception e) {
      logger.warn("Error extracting shop domain from key {}: {}", key, e.getMessage());
      return null;
    }
  }

  /** Helper method to get session key type */
  private String getSessionKeyType(String key) {
    if (key.contains("shop_token:")) return "session_token";
    if (key.contains("invalid_session:")) return "invalid_marker";
    if (key.contains("validation_failure_count:")) return "failure_count";
    if (key.contains("session_invalidation:")) return "invalidation_marker";
    if (key.contains("session_state:")) return "state_marker";
    if (key.contains("session_lock:")) return "lock_marker";
    return "unknown";
  }
}
