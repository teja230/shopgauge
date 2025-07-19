package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.model.AuditLog;
import com.storesight.backend.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Specialized audit logging service for competitor management actions Provides comprehensive
 * tracking of all competitor-related operations
 */
@Service
public class CompetitorAuditService {

  private static final Logger logger = LoggerFactory.getLogger(CompetitorAuditService.class);

  @Autowired private AuditLogRepository auditLogRepository;

  @Autowired private ObjectMapper objectMapper;

  // Audit action types
  public static final String ACTION_COMPETITOR_ADDED = "COMPETITOR_ADDED";
  public static final String ACTION_COMPETITOR_REMOVED = "COMPETITOR_REMOVED";
  public static final String ACTION_COMPETITOR_UPDATED = "COMPETITOR_UPDATED";
  public static final String ACTION_COMPETITOR_VIEWED = "COMPETITOR_VIEWED";
  public static final String ACTION_DISCOVERY_TRIGGERED = "DISCOVERY_TRIGGERED";
  public static final String ACTION_SUGGESTION_APPROVED = "SUGGESTION_APPROVED";
  public static final String ACTION_SUGGESTION_IGNORED = "SUGGESTION_IGNORED";
  public static final String ACTION_PRICE_ALERT_SENT = "PRICE_ALERT_SENT";
  public static final String ACTION_DATA_EXPORTED = "DATA_EXPORTED";
  public static final String ACTION_DATA_ACCESSED = "DATA_ACCESSED";
  public static final String ACTION_SETTINGS_CHANGED = "SETTINGS_CHANGED";

  /** Log competitor addition */
  public void logCompetitorAdded(Long shopId, String competitorUrl, String label) {
    Map<String, Object> details = new HashMap<>();
    details.put("url", competitorUrl);
    details.put("label", label);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_COMPETITOR_ADDED, details);
  }

  /** Log competitor removal */
  public void logCompetitorRemoved(Long shopId, String competitorUrl, String reason) {
    Map<String, Object> details = new HashMap<>();
    details.put("url", competitorUrl);
    details.put("reason", reason);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_COMPETITOR_REMOVED, details);
  }

  /** Log competitor data update */
  public void logCompetitorUpdated(Long shopId, String competitorUrl, Map<String, Object> changes) {
    Map<String, Object> details = new HashMap<>();
    details.put("url", competitorUrl);
    details.put("changes", changes);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_COMPETITOR_UPDATED, details);
  }

  /** Log competitor data access */
  public void logCompetitorViewed(Long shopId, String competitorUrl) {
    Map<String, Object> details = new HashMap<>();
    details.put("url", competitorUrl);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_COMPETITOR_VIEWED, details);
  }

  /** Log discovery trigger */
  public void logDiscoveryTriggered(Long shopId, int suggestionsFound, double costIncurred) {
    Map<String, Object> details = new HashMap<>();
    details.put("suggestionsFound", suggestionsFound);
    details.put("costIncurred", costIncurred);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_DISCOVERY_TRIGGERED, details);
  }

  /** Log suggestion approval */
  public void logSuggestionApproved(Long shopId, String suggestedUrl, String title) {
    Map<String, Object> details = new HashMap<>();
    details.put("url", suggestedUrl);
    details.put("title", title);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_SUGGESTION_APPROVED, details);
  }

  /** Log suggestion ignored */
  public void logSuggestionIgnored(Long shopId, String suggestedUrl, String reason) {
    Map<String, Object> details = new HashMap<>();
    details.put("url", suggestedUrl);
    details.put("reason", reason);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_SUGGESTION_IGNORED, details);
  }

  /** Log price alert sent */
  public void logPriceAlertSent(
      Long shopId, String competitorUrl, double oldPrice, double newPrice, String alertType) {
    Map<String, Object> details = new HashMap<>();
    details.put("url", competitorUrl);
    details.put("oldPrice", oldPrice);
    details.put("newPrice", newPrice);
    details.put("alertType", alertType);
    details.put("priceChange", ((newPrice - oldPrice) / oldPrice) * 100);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_PRICE_ALERT_SENT, details);
  }

  /** Log data export */
  public void logDataExported(Long shopId, String exportType, int recordCount) {
    Map<String, Object> details = new HashMap<>();
    details.put("exportType", exportType);
    details.put("recordCount", recordCount);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_DATA_EXPORTED, details);
  }

  /** Log sensitive data access */
  public void logDataAccessed(Long shopId, String dataType, String accessReason) {
    Map<String, Object> details = new HashMap<>();
    details.put("dataType", dataType);
    details.put("accessReason", accessReason);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_DATA_ACCESSED, details);
  }

  /** Log settings changes */
  public void logSettingsChanged(
      Long shopId, Map<String, Object> oldSettings, Map<String, Object> newSettings) {
    Map<String, Object> details = new HashMap<>();
    details.put("oldSettings", oldSettings);
    details.put("newSettings", newSettings);
    details.put("timestamp", LocalDateTime.now());

    logAction(shopId, ACTION_SETTINGS_CHANGED, details);
  }

  /** Generic audit logging method */
  private void logAction(Long shopId, String action, Map<String, Object> details) {
    try {
      // Get request context for IP and user agent
      HttpServletRequest request = getCurrentRequest();
      String ipAddress = null;
      String userAgent = null;

      if (request != null) {
        ipAddress = getClientIpAddress(request);
        userAgent = request.getHeader("User-Agent");
      }

      // Convert details to JSON string
      String detailsJson = objectMapper.writeValueAsString(details);

      // Create audit log entry
      AuditLog auditLog = new AuditLog(shopId, action, detailsJson, userAgent, ipAddress);
      auditLogRepository.save(auditLog);

      logger.info("Audit log created: shopId={}, action={}, ip={}", shopId, action, ipAddress);

    } catch (Exception e) {
      // Don't fail the operation if audit logging fails
      logger.error(
          "Failed to create audit log: shopId={}, action={}, error={}",
          shopId,
          action,
          e.getMessage());
    }
  }

  /** Get current HTTP request */
  private HttpServletRequest getCurrentRequest() {
    try {
      ServletRequestAttributes attributes =
          (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
      return attributes != null ? attributes.getRequest() : null;
    } catch (Exception e) {
      return null;
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

  /** Get audit statistics for a shop */
  public Map<String, Object> getAuditStats(Long shopId, LocalDateTime since) {
    Map<String, Object> stats = new HashMap<>();

    try {
      // Count actions by type
      stats.put(
          "competitorAdded",
          auditLogRepository.countByShopIdAndActionAndCreatedAtAfter(
              shopId, ACTION_COMPETITOR_ADDED, since));
      stats.put(
          "competitorRemoved",
          auditLogRepository.countByShopIdAndActionAndCreatedAtAfter(
              shopId, ACTION_COMPETITOR_REMOVED, since));
      stats.put(
          "discoveryTriggered",
          auditLogRepository.countByShopIdAndActionAndCreatedAtAfter(
              shopId, ACTION_DISCOVERY_TRIGGERED, since));
      stats.put(
          "suggestionsApproved",
          auditLogRepository.countByShopIdAndActionAndCreatedAtAfter(
              shopId, ACTION_SUGGESTION_APPROVED, since));
      stats.put(
          "priceAlertsSent",
          auditLogRepository.countByShopIdAndActionAndCreatedAtAfter(
              shopId, ACTION_PRICE_ALERT_SENT, since));
      stats.put(
          "dataExported",
          auditLogRepository.countByShopIdAndActionAndCreatedAtAfter(
              shopId, ACTION_DATA_EXPORTED, since));

      // Total activity
      long totalActivity = stats.values().stream().mapToLong(v -> (Long) v).sum();
      stats.put("totalActivity", totalActivity);

    } catch (Exception e) {
      logger.error("Failed to get audit stats for shop {}: {}", shopId, e.getMessage());
      stats.put("error", "Failed to retrieve audit statistics");
    }

    return stats;
  }
}
