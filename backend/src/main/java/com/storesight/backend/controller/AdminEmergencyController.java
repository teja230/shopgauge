package com.storesight.backend.controller;

import com.storesight.backend.service.DatabaseMonitoringService;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin-refactor/emergency")
public class AdminEmergencyController {
  private static final Logger logger = LoggerFactory.getLogger(AdminEmergencyController.class);

  private final DatabaseMonitoringService databaseMonitoringService;
  private final DataSource dataSource;

  @Autowired
  public AdminEmergencyController(
      DatabaseMonitoringService databaseMonitoringService, DataSource dataSource) {
    this.databaseMonitoringService = databaseMonitoringService;
    this.dataSource = dataSource;
  }

  @GetMapping("/status")
  public ResponseEntity<Map<String, Object>> getEmergencyStatus() {
    Map<String, Object> status = new HashMap<>();
    status.put("timestamp", LocalDateTime.now().toString());
    status.put("endpoint", "emergency_admin_status");
    try {
      Map<String, Object> dbMetrics = databaseMonitoringService.getDatabaseStatistics();
      status.put("database", dbMetrics);
      String poolStatus = databaseMonitoringService.getPoolStatus();
      status.put("poolStatus", poolStatus);
      status.put("jvmMemory", getJvmMemoryInfo());
      status.put("systemLoad", getSystemLoadInfo());
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

  @GetMapping("/database-info")
  public ResponseEntity<Map<String, Object>> getEmergencyDatabaseInfo() {
    Map<String, Object> info = new HashMap<>();
    info.put("timestamp", LocalDateTime.now().toString());
    try {
      Map<String, Object> poolMetrics = databaseMonitoringService.getDatabaseStatistics();
      info.put("connectionPool", poolMetrics);
      try (Connection conn = dataSource.getConnection()) {
        conn.setAutoCommit(true);
        try (PreparedStatement stmt = conn.prepareStatement("SELECT version()");
            ResultSet rs = stmt.executeQuery()) {
          if (rs.next()) {
            info.put("databaseVersion", rs.getString(1));
          }
        }
        try (PreparedStatement stmt =
                conn.prepareStatement(
                    "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active'");
            ResultSet rs = stmt.executeQuery()) {
          if (rs.next()) {
            info.put("activeDatabaseConnections", rs.getInt("active_connections"));
          }
        }
        try (PreparedStatement stmt =
                conn.prepareStatement(
                    "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size "
                        + "FROM pg_tables WHERE schemaname = 'public' "
                        + "ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 5");
            ResultSet rs = stmt.executeQuery()) {
          List<Map<String, String>> tables = new ArrayList<>();
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

  @PostMapping("/cleanup-connections")
  public ResponseEntity<Map<String, Object>> emergencyCleanupConnections() {
    Map<String, Object> result = new HashMap<>();
    result.put("timestamp", LocalDateTime.now().toString());
    try {
      Map<String, Object> beforeMetrics = databaseMonitoringService.getDatabaseMetrics();
      result.put("beforeCleanup", beforeMetrics);
      if (dataSource instanceof com.zaxxer.hikari.HikariDataSource hikariDS) {
        hikariDS.getHikariPoolMXBean().softEvictConnections();
        Thread.sleep(2000);
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
}
