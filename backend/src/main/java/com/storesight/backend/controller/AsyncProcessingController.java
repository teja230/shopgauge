package com.storesight.backend.controller;

import com.storesight.backend.service.AsyncProcessingService;
import com.storesight.backend.service.AsyncProcessingService.AsyncTaskStatus;
import com.storesight.backend.service.AsyncProcessingService.ProcessingStats;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Controller for async processing monitoring and management */
@RestController
@RequestMapping("/api/admin/async")
public class AsyncProcessingController {

  private static final Logger log = LoggerFactory.getLogger(AsyncProcessingController.class);

  @Autowired private AsyncProcessingService asyncProcessingService;

  /** Get async processing statistics */
  @GetMapping("/stats")
  public ResponseEntity<ProcessingStats> getProcessingStats() {
    try {
      ProcessingStats stats = asyncProcessingService.getProcessingStats();
      return ResponseEntity.ok(stats);
    } catch (Exception e) {
      log.error("Error getting processing stats: {}", e.getMessage(), e);
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Get status of a specific task */
  @GetMapping("/task/{taskId}")
  public ResponseEntity<AsyncTaskStatus> getTaskStatus(@PathVariable String taskId) {
    try {
      AsyncTaskStatus status = asyncProcessingService.getTaskStatus(taskId);
      if (status == null) {
        return ResponseEntity.notFound().build();
      }
      return ResponseEntity.ok(status);
    } catch (Exception e) {
      log.error("Error getting task status for {}: {}", taskId, e.getMessage(), e);
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Get all active task statuses */
  @GetMapping("/tasks")
  public ResponseEntity<Map<String, AsyncTaskStatus>> getAllTaskStatuses() {
    try {
      Map<String, AsyncTaskStatus> statuses = asyncProcessingService.getAllTaskStatuses();
      return ResponseEntity.ok(statuses);
    } catch (Exception e) {
      log.error("Error getting all task statuses: {}", e.getMessage(), e);
      return ResponseEntity.internalServerError().build();
    }
  }

  /** Get async processing health check */
  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> getAsyncHealth() {
    try {
      ProcessingStats stats = asyncProcessingService.getProcessingStats();

      Map<String, Object> health =
          Map.of(
              "status", "UP",
              "totalTasks", stats.getTotalSubmitted(),
              "completedTasks", stats.getTotalCompleted(),
              "failedTasks", stats.getTotalFailed(),
              "successRate", stats.getSuccessRate(),
              "failureRate", stats.getFailureRate(),
              "activeTasks",
                  Map.of(
                      "discovery", stats.getActiveDiscovery(),
                      "scraping", stats.getActiveScraping(),
                      "notification", stats.getActiveNotification()),
              "queuedTasks",
                  Map.of(
                      "discovery", stats.getQueuedDiscovery(),
                      "scraping", stats.getQueuedScraping(),
                      "notification", stats.getQueuedNotification()));

      return ResponseEntity.ok(health);
    } catch (Exception e) {
      log.error("Error getting async health: {}", e.getMessage(), e);

      Map<String, Object> health = Map.of("status", "DOWN", "error", e.getMessage());

      return ResponseEntity.status(503).body(health);
    }
  }
}
