package com.storesight.backend.controller;

import com.storesight.backend.service.MonitoringConfigurationService;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin-refactor/monitoring")
public class AdminMonitoringController {
  private static final Logger logger = LoggerFactory.getLogger(AdminMonitoringController.class);

  @Autowired private MonitoringConfigurationService monitoringConfigurationService;

  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> getHealth() {
    try {
      Map<String, Object> health = monitoringConfigurationService.getMonitoringBestPractices();
      return ResponseEntity.ok(health);
    } catch (Exception e) {
      logger.error("Error retrieving health: {}", e.getMessage());
      return ResponseEntity.status(500).body(Map.of("error", "Failed to retrieve health"));
    }
  }

  @GetMapping("/metrics/config")
  public ResponseEntity<Map<String, Object>> getMetricsConfig() {
    try {
      Map<String, Object> config = monitoringConfigurationService.getGrafanaDashboardConfig();
      return ResponseEntity.ok(config);
    } catch (Exception e) {
      logger.error("Error retrieving metrics config: {}", e.getMessage());
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve metrics config", "message", e.getMessage()));
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
