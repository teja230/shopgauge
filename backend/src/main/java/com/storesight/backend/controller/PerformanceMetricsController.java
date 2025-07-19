package com.storesight.backend.controller;

import com.storesight.backend.service.PerformanceMetricsService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Performance metrics dashboard controller for Market Intelligence production monitoring.
 *
 * <p>Provides endpoints for: - Comprehensive performance metrics dashboard - API endpoint response
 * time and error rate monitoring - Discovery and scraping operation throughput metrics - Cache
 * performance monitoring and optimization alerts - Database query performance tracking
 */
@RestController
@RequestMapping("/api/admin/performance")
public class PerformanceMetricsController {

  private static final Logger logger = LoggerFactory.getLogger(PerformanceMetricsController.class);

  @Autowired private PerformanceMetricsService performanceMetricsService;

  /** Get comprehensive performance metrics dashboard */
  @GetMapping("/dashboard")
  public ResponseEntity<Map<String, Object>> getPerformanceDashboard() {
    try {
      Map<String, Object> metrics = performanceMetricsService.getPerformanceMetrics();
      return ResponseEntity.ok(metrics);

    } catch (Exception e) {
      logger.error("Error retrieving performance dashboard: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Get API endpoint performance metrics */
  @GetMapping("/api-endpoints")
  public ResponseEntity<Map<String, Object>> getApiEndpointMetrics() {
    try {
      Map<String, Object> metrics = performanceMetricsService.getPerformanceMetrics();

      @SuppressWarnings("unchecked")
      Map<String, Object> apiMetrics = (Map<String, Object>) metrics.get("apiEndpoints");

      Map<String, Object> response = new HashMap<>();
      response.put("apiEndpoints", apiMetrics);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving API endpoint metrics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Get throughput metrics for discovery and scraping operations */
  @GetMapping("/throughput")
  public ResponseEntity<Map<String, Object>> getThroughputMetrics() {
    try {
      Map<String, Object> metrics = performanceMetricsService.getPerformanceMetrics();

      Map<String, Object> response = new HashMap<>();
      response.put("throughput", metrics.get("throughput"));
      response.put("discovery", metrics.get("discovery"));
      response.put("scraping", metrics.get("scraping"));
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving throughput metrics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Get cache performance metrics */
  @GetMapping("/cache")
  public ResponseEntity<Map<String, Object>> getCachePerformanceMetrics() {
    try {
      Map<String, Object> metrics = performanceMetricsService.getPerformanceMetrics();

      @SuppressWarnings("unchecked")
      Map<String, Object> cacheMetrics = (Map<String, Object>) metrics.get("cache");

      Map<String, Object> response = new HashMap<>();
      response.put("cache", cacheMetrics);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving cache performance metrics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Get database performance metrics */
  @GetMapping("/database")
  public ResponseEntity<Map<String, Object>> getDatabasePerformanceMetrics() {
    try {
      Map<String, Object> metrics = performanceMetricsService.getPerformanceMetrics();

      @SuppressWarnings("unchecked")
      Map<String, Object> databaseMetrics = (Map<String, Object>) metrics.get("database");

      Map<String, Object> response = new HashMap<>();
      response.put("database", databaseMetrics);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving database performance metrics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Get performance alerts */
  @GetMapping("/alerts")
  public ResponseEntity<Map<String, Object>> getPerformanceAlerts() {
    try {
      Map<String, Object> metrics = performanceMetricsService.getPerformanceMetrics();

      @SuppressWarnings("unchecked")
      Map<String, Object> alerts = (Map<String, Object>) metrics.get("alerts");

      Map<String, Object> response = new HashMap<>();
      response.put("alerts", alerts);
      response.put("alertCount", alerts != null ? alerts.size() : 0);
      response.put("hasAlerts", alerts != null && !alerts.isEmpty());
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving performance alerts: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Record API endpoint response time (for manual testing) */
  @PostMapping("/record/response-time")
  public ResponseEntity<Map<String, Object>> recordResponseTime(
      @RequestParam String endpoint, @RequestParam long responseTimeMs) {
    try {
      performanceMetricsService.recordResponseTime(endpoint, responseTimeMs);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Response time recorded");
      response.put("endpoint", endpoint);
      response.put("responseTimeMs", responseTimeMs);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error recording response time: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Record API endpoint error (for manual testing) */
  @PostMapping("/record/error")
  public ResponseEntity<Map<String, Object>> recordError(
      @RequestParam String endpoint, @RequestParam String errorType) {
    try {
      performanceMetricsService.recordError(endpoint, errorType);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Error recorded");
      response.put("endpoint", endpoint);
      response.put("errorType", errorType);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error recording error: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Record successful API endpoint request (for manual testing) */
  @PostMapping("/record/success")
  public ResponseEntity<Map<String, Object>> recordSuccess(@RequestParam String endpoint) {
    try {
      performanceMetricsService.recordSuccess(endpoint);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Success recorded");
      response.put("endpoint", endpoint);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error recording success: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Record throughput metrics (for manual testing) */
  @PostMapping("/record/throughput")
  public ResponseEntity<Map<String, Object>> recordThroughput(
      @RequestParam String operation, @RequestParam int itemsProcessed) {
    try {
      performanceMetricsService.recordThroughput(operation, itemsProcessed);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Throughput recorded");
      response.put("operation", operation);
      response.put("itemsProcessed", itemsProcessed);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error recording throughput: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Record cache hit (for manual testing) */
  @PostMapping("/record/cache-hit")
  public ResponseEntity<Map<String, Object>> recordCacheHit(@RequestParam String cacheType) {
    try {
      performanceMetricsService.recordCacheHit(cacheType);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Cache hit recorded");
      response.put("cacheType", cacheType);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error recording cache hit: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Record cache miss (for manual testing) */
  @PostMapping("/record/cache-miss")
  public ResponseEntity<Map<String, Object>> recordCacheMiss(@RequestParam String cacheType) {
    try {
      performanceMetricsService.recordCacheMiss(cacheType);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Cache miss recorded");
      response.put("cacheType", cacheType);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error recording cache miss: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Record discovery operation metrics (for manual testing) */
  @PostMapping("/record/discovery")
  public ResponseEntity<Map<String, Object>> recordDiscoveryOperation(
      @RequestParam long durationMs,
      @RequestParam int suggestionsFound,
      @RequestParam boolean success) {
    try {
      performanceMetricsService.recordDiscoveryOperation(durationMs, suggestionsFound, success);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Discovery operation recorded");
      response.put("durationMs", durationMs);
      response.put("suggestionsFound", suggestionsFound);
      response.put("operationSuccess", success);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error recording discovery operation: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Record scraping operation metrics (for manual testing) */
  @PostMapping("/record/scraping")
  public ResponseEntity<Map<String, Object>> recordScrapingOperation(
      @RequestParam long durationMs,
      @RequestParam int urlsProcessed,
      @RequestParam boolean success) {
    try {
      performanceMetricsService.recordScrapingOperation(durationMs, urlsProcessed, success);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Scraping operation recorded");
      response.put("durationMs", durationMs);
      response.put("urlsProcessed", urlsProcessed);
      response.put("operationSuccess", success);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error recording scraping operation: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }

  /** Reset all performance metrics */
  @PostMapping("/reset")
  public ResponseEntity<Map<String, Object>> resetMetrics() {
    try {
      performanceMetricsService.resetMetrics();

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Performance metrics reset successfully");
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error resetting performance metrics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.internalServerError().body(errorResponse);
    }
  }
}
