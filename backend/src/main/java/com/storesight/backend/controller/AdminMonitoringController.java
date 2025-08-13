package com.storesight.backend.controller;

import com.storesight.backend.service.AlertingService;
import com.storesight.backend.service.MetricsCollectionService;
import com.storesight.backend.service.MonitoringConfigurationService;
import com.storesight.backend.service.MonitoringDashboardService;
import com.storesight.backend.service.SystemResourceMonitoringService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin-refactor/monitoring")
@PreAuthorize("hasRole('ADMIN')")
public class AdminMonitoringController {
  private static final Logger logger = LoggerFactory.getLogger(AdminMonitoringController.class);

  private final MonitoringDashboardService monitoringDashboardService;
  private final AlertingService alertingService;
  private final SystemResourceMonitoringService systemResourceMonitoringService;
  private final MetricsCollectionService metricsCollectionService;
  private final MonitoringConfigurationService monitoringConfigurationService;

  @Autowired
  public AdminMonitoringController(
      MonitoringDashboardService monitoringDashboardService,
      AlertingService alertingService,
      SystemResourceMonitoringService systemResourceMonitoringService,
      MetricsCollectionService metricsCollectionService,
      MonitoringConfigurationService monitoringConfigurationService) {
    this.monitoringDashboardService = monitoringDashboardService;
    this.alertingService = alertingService;
    this.systemResourceMonitoringService = systemResourceMonitoringService;
    this.metricsCollectionService = metricsCollectionService;
    this.monitoringConfigurationService = monitoringConfigurationService;
  }

  @GetMapping("/dashboard")
  public ResponseEntity<Map<String, Object>> getMonitoringDashboard() {
    try {
      Map<String, Object> response = new HashMap<>();
      Map<String, Object> dashboardData = monitoringDashboardService.getAllDashboardData();
      response.put("dashboards", dashboardData);
      Map<String, Object> alertStats = alertingService.getAlertStatistics();
      response.put("alerts", alertStats);
      Map<String, Object> systemStats =
          systemResourceMonitoringService.getSystemResourceStatistics();
      response.put("systemResources", systemStats);
      Map<String, Object> appMetrics = metricsCollectionService.getMetricsSummary();
      response.put("applicationMetrics", appMetrics);
      response.put("timestamp", LocalDateTime.now());
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving monitoring dashboard: {}", e.getMessage());
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error", "Failed to retrieve monitoring dashboard", "message", e.getMessage()));
    }
  }

  @GetMapping("/alerts")
  public ResponseEntity<Map<String, Object>> getCurrentAlerts() {
    try {
      Map<String, Object> response = alertingService.getAlertStatistics();
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving alerts: {}", e.getMessage());
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve alerts", "message", e.getMessage()));
    }
  }

  @PostMapping("/reset-stats")
  public ResponseEntity<Map<String, Object>> resetMonitoringStats() {
    try {
      metricsCollectionService.resetMetrics();
      alertingService.resetAlertStatistics();
      monitoringDashboardService.resetStatistics();
      systemResourceMonitoringService.resetStatistics();
      return ResponseEntity.ok(Map.of("success", true, "message", "Monitoring statistics reset"));
    } catch (Exception e) {
      logger.error("Error resetting monitoring stats: {}", e.getMessage());
      return ResponseEntity.status(500)
          .body(
              Map.of("error", "Failed to reset monitoring statistics", "message", e.getMessage()));
    }
  }

  @GetMapping("/error-patterns")
  public ResponseEntity<Map<String, Object>> getErrorPatterns() {
    try {
      Map<String, Object> response = monitoringDashboardService.getErrorPatternAnalysis();
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving error patterns: {}", e.getMessage());
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve error patterns", "message", e.getMessage()));
    }
  }

  @GetMapping("/config/grafana")
  public ResponseEntity<Map<String, Object>> getGrafanaConfig() {
    try {
      Map<String, Object> response = monitoringConfigurationService.getGrafanaDashboardConfig();
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving Grafana config: {}", e.getMessage());
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve Grafana config", "message", e.getMessage()));
    }
  }

  @GetMapping("/config/prometheus")
  public ResponseEntity<Map<String, Object>> getPrometheusConfig() {
    try {
      Map<String, Object> response = monitoringConfigurationService.getPrometheusAlertingRules();
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving Prometheus config: {}", e.getMessage());
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve Prometheus config", "message", e.getMessage()));
    }
  }
}

