package com.storesight.backend.controller;

import com.storesight.backend.model.PrivacyRequest;
import com.storesight.backend.repository.PrivacyRequestRepository;
import com.storesight.backend.service.CompetitorAuditService;
import com.storesight.backend.service.DataPrivacyService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Privacy compliance controller for GDPR and data protection features Handles data export,
 * deletion, and privacy requests
 */
@RestController
@RequestMapping("/api/privacy")
public class PrivacyComplianceController {

  private static final Logger logger = LoggerFactory.getLogger(PrivacyComplianceController.class);

  @Autowired private DataPrivacyService dataPrivacyService;

  @Autowired private CompetitorAuditService competitorAuditService;

  @Autowired private PrivacyRequestRepository privacyRequestRepository;

  /** Request data export (GDPR Article 20 - Right to data portability) */
  @PostMapping("/export")
  public ResponseEntity<Map<String, Object>> requestDataExport(
      @RequestParam Long shopId, HttpServletRequest request) {

    logger.info("Data export requested for shop: {}", shopId);

    try {
      // Check for existing pending export requests
      boolean hasPendingRequest =
          privacyRequestRepository.existsByShopIdAndStatus(shopId, PrivacyRequest.Status.PENDING);

      if (hasPendingRequest) {
        return ResponseEntity.badRequest()
            .body(
                Map.of(
                    "success",
                    false,
                    "message",
                    "A data export request is already pending for this shop"));
      }

      // Create privacy request record
      PrivacyRequest privacyRequest =
          new PrivacyRequest(
              shopId, PrivacyRequest.RequestType.EXPORT, "shop_user", getClientIpAddress(request));
      privacyRequestRepository.save(privacyRequest);

      // Perform export
      Map<String, Object> exportData = dataPrivacyService.exportShopData(shopId);

      // Update request status
      privacyRequest.setStatus(PrivacyRequest.Status.COMPLETED);
      privacyRequest.setCompletedAt(LocalDateTime.now());
      privacyRequest.setProcessingLog("Export completed successfully");
      privacyRequestRepository.save(privacyRequest);

      // Audit log
      competitorAuditService.logDataExported(
          shopId,
          "GDPR_EXPORT",
          exportData.values().stream()
              .mapToInt(
                  v -> v instanceof java.util.Collection ? ((java.util.Collection<?>) v).size() : 1)
              .sum());

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Data export completed");
      response.put("requestId", privacyRequest.getId());
      response.put("exportData", exportData);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Failed to export data for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.internalServerError()
          .body(Map.of("success", false, "message", "Failed to export data: " + e.getMessage()));
    }
  }

  /** Request data deletion (GDPR Article 17 - Right to be forgotten) */
  @PostMapping("/delete")
  public ResponseEntity<Map<String, Object>> requestDataDeletion(
      @RequestParam Long shopId,
      @RequestParam(required = false, defaultValue = "User request") String reason,
      HttpServletRequest request) {

    logger.info("Data deletion requested for shop: {} - Reason: {}", shopId, reason);

    try {
      // Check for existing pending deletion requests
      boolean hasPendingRequest =
          privacyRequestRepository.existsByShopIdAndStatus(shopId, PrivacyRequest.Status.PENDING);

      if (hasPendingRequest) {
        return ResponseEntity.badRequest()
            .body(
                Map.of(
                    "success",
                    false,
                    "message",
                    "A data deletion request is already pending for this shop"));
      }

      // Create privacy request record
      PrivacyRequest privacyRequest =
          new PrivacyRequest(
              shopId, PrivacyRequest.RequestType.DELETE, "shop_user", getClientIpAddress(request));
      privacyRequest.setRequestDetails("{\"reason\":\"" + reason + "\"}");
      privacyRequest.setStatus(PrivacyRequest.Status.PROCESSING);
      privacyRequest.setProcessedAt(LocalDateTime.now());
      privacyRequestRepository.save(privacyRequest);

      // Perform deletion asynchronously
      CompletableFuture<Map<String, Object>> deletionFuture =
          dataPrivacyService.deleteShopData(shopId, reason);

      deletionFuture
          .thenAccept(
              deletionReport -> {
                // Update request status
                privacyRequest.setStatus(PrivacyRequest.Status.COMPLETED);
                privacyRequest.setCompletedAt(LocalDateTime.now());
                privacyRequest.setProcessingLog("Deletion completed: " + deletionReport.toString());
                privacyRequestRepository.save(privacyRequest);
              })
          .exceptionally(
              throwable -> {
                // Handle deletion failure
                privacyRequest.setStatus(PrivacyRequest.Status.FAILED);
                privacyRequest.setProcessingLog("Deletion failed: " + throwable.getMessage());
                privacyRequestRepository.save(privacyRequest);
                return null;
              });

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Data deletion request submitted and is being processed");
      response.put("requestId", privacyRequest.getId());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Failed to process deletion request for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.internalServerError()
          .body(
              Map.of(
                  "success",
                  false,
                  "message",
                  "Failed to process deletion request: " + e.getMessage()));
    }
  }

  /** Request data anonymization (alternative to deletion) */
  @PostMapping("/anonymize")
  public ResponseEntity<Map<String, Object>> requestDataAnonymization(
      @RequestParam Long shopId,
      @RequestParam(required = false, defaultValue = "User request") String reason,
      HttpServletRequest request) {

    logger.info("Data anonymization requested for shop: {} - Reason: {}", shopId, reason);

    try {
      // Create privacy request record
      PrivacyRequest privacyRequest =
          new PrivacyRequest(
              shopId,
              PrivacyRequest.RequestType.ANONYMIZE,
              "shop_user",
              getClientIpAddress(request));
      privacyRequest.setRequestDetails("{\"reason\":\"" + reason + "\"}");
      privacyRequestRepository.save(privacyRequest);

      // Perform anonymization
      Map<String, Object> anonymizationReport =
          dataPrivacyService.anonymizeShopData(shopId, reason);

      // Update request status
      privacyRequest.setStatus(PrivacyRequest.Status.COMPLETED);
      privacyRequest.setCompletedAt(LocalDateTime.now());
      privacyRequest.setProcessingLog("Anonymization completed: " + anonymizationReport.toString());
      privacyRequestRepository.save(privacyRequest);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Data anonymization completed");
      response.put("requestId", privacyRequest.getId());
      response.put("report", anonymizationReport);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Failed to anonymize data for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.internalServerError()
          .body(Map.of("success", false, "message", "Failed to anonymize data: " + e.getMessage()));
    }
  }

  /** Get privacy request status */
  @GetMapping("/requests/{requestId}")
  public ResponseEntity<Map<String, Object>> getRequestStatus(@PathVariable Long requestId) {
    try {
      PrivacyRequest request =
          privacyRequestRepository
              .findById(requestId)
              .orElseThrow(() -> new RuntimeException("Request not found"));

      Map<String, Object> response = new HashMap<>();
      response.put("id", request.getId());
      response.put("shopId", request.getShopId());
      response.put("requestType", request.getRequestType());
      response.put("status", request.getStatus());
      response.put("requestedAt", request.getRequestedAt());
      response.put("processedAt", request.getProcessedAt());
      response.put("completedAt", request.getCompletedAt());
      response.put("processingLog", request.getProcessingLog());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Failed to get request status for ID {}: {}", requestId, e.getMessage());
      return ResponseEntity.internalServerError()
          .body(
              Map.of(
                  "success", false, "message", "Failed to get request status: " + e.getMessage()));
    }
  }

  /** Get data retention status for a shop */
  @GetMapping("/retention-status")
  public ResponseEntity<Map<String, Object>> getRetentionStatus(@RequestParam Long shopId) {
    try {
      Map<String, Object> status = dataPrivacyService.getDataRetentionStatus(shopId);
      return ResponseEntity.ok(status);

    } catch (Exception e) {
      logger.error("Failed to get retention status for shop {}: {}", shopId, e.getMessage());
      return ResponseEntity.internalServerError()
          .body(
              Map.of(
                  "success",
                  false,
                  "message",
                  "Failed to get retention status: " + e.getMessage()));
    }
  }

  /** Get privacy requests for a shop */
  @GetMapping("/requests")
  public ResponseEntity<Map<String, Object>> getShopRequests(@RequestParam Long shopId) {
    try {
      var requests = privacyRequestRepository.findByShopIdOrderByRequestedAtDesc(shopId);

      Map<String, Object> response = new HashMap<>();
      response.put("requests", requests);
      response.put("count", requests.size());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Failed to get requests for shop {}: {}", shopId, e.getMessage());
      return ResponseEntity.internalServerError()
          .body(Map.of("success", false, "message", "Failed to get requests: " + e.getMessage()));
    }
  }

  /** Extract client IP address from request */
  private String getClientIpAddress(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
      return xForwardedFor.split(",")[0].trim();
    }

    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isEmpty()) {
      return xRealIp;
    }

    return request.getRemoteAddr();
  }
}
