package com.storesight.backend.service;

import com.storesight.backend.repository.AuditLogRepository;
import com.storesight.backend.repository.CompetitorSuggestionRepository;
import com.storesight.backend.repository.MarketIntelligenceCostRepository;
import com.storesight.backend.repository.PrivacyRequestRepository;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Automated data retention and cleanup service Runs scheduled tasks to maintain data retention
 * policies
 */
@Service
public class DataRetentionService {

  private static final Logger logger = LoggerFactory.getLogger(DataRetentionService.class);

  @Autowired private AuditLogRepository auditLogRepository;

  @Autowired private CompetitorSuggestionRepository competitorSuggestionRepository;

  @Autowired private MarketIntelligenceCostRepository marketIntelligenceCostRepository;

  @Autowired private PrivacyRequestRepository privacyRequestRepository;

  @Autowired private CompetitorAuditService competitorAuditService;

  // Retention periods (configurable)
  @Value("${privacy.retention.audit-logs.days:365}")
  private int auditLogRetentionDays;

  @Value("${privacy.retention.competitor-data.days:730}")
  private int competitorDataRetentionDays;

  @Value("${privacy.retention.cost-data.days:1095}")
  private int costDataRetentionDays;

  @Value("${privacy.retention.privacy-requests.days:2555}") // 7 years for compliance
  private int privacyRequestRetentionDays;

  @Value("${privacy.cleanup.enabled:true}")
  private boolean cleanupEnabled;

  /** Daily cleanup task - runs at 2 AM */
  @Scheduled(cron = "0 0 2 * * ?")
  @Transactional
  public void performDailyCleanup() {
    if (!cleanupEnabled) {
      logger.info("Data cleanup is disabled, skipping scheduled cleanup");
      return;
    }

    logger.info("Starting daily data retention cleanup");

    Map<String, Long> cleanupReport = new HashMap<>();
    LocalDateTime startTime = LocalDateTime.now();

    try {
      // Clean up old audit logs
      LocalDateTime auditCutoff = LocalDateTime.now().minusDays(auditLogRetentionDays);
      long oldAuditLogs = auditLogRepository.countByCreatedAtBefore(auditCutoff);
      if (oldAuditLogs > 0) {
        auditLogRepository.deleteByCreatedAtBefore(auditCutoff);
        cleanupReport.put("auditLogs", oldAuditLogs);
        logger.info("Cleaned up {} old audit log entries", oldAuditLogs);
      }

      // Clean up old cost data
      LocalDateTime costCutoff = LocalDateTime.now().minusDays(costDataRetentionDays);
      long oldCostRecords =
          marketIntelligenceCostRepository.countByDateBefore(costCutoff.toLocalDate());
      if (oldCostRecords > 0) {
        marketIntelligenceCostRepository.deleteByDateBefore(costCutoff.toLocalDate());
        cleanupReport.put("costRecords", oldCostRecords);
        logger.info("Cleaned up {} old cost records", oldCostRecords);
      }

      // Clean up old privacy requests (keep for compliance)
      LocalDateTime privacyRequestCutoff =
          LocalDateTime.now().minusDays(privacyRequestRetentionDays);
      var oldPrivacyRequests =
          privacyRequestRepository.findPendingRequestsOlderThan(privacyRequestCutoff);
      if (!oldPrivacyRequests.isEmpty()) {
        privacyRequestRepository.deleteAll(oldPrivacyRequests);
        cleanupReport.put("privacyRequests", (long) oldPrivacyRequests.size());
        logger.info("Cleaned up {} old privacy requests", oldPrivacyRequests.size());
      }

      // Log cleanup completion
      LocalDateTime endTime = LocalDateTime.now();
      long durationMinutes = java.time.Duration.between(startTime, endTime).toMinutes();

      logger.info(
          "Daily cleanup completed in {} minutes - Report: {}", durationMinutes, cleanupReport);

      // Audit log the cleanup
      competitorAuditService.logDataAccessed(
          null, "AUTOMATED_CLEANUP", "Daily cleanup completed: " + cleanupReport.toString());

    } catch (Exception e) {
      logger.error("Failed to perform daily cleanup: {}", e.getMessage(), e);

      // Log the failure
      competitorAuditService.logDataAccessed(
          null, "CLEANUP_FAILED", "Daily cleanup failed: " + e.getMessage());
    }
  }

  /** Weekly deep cleanup task - runs on Sundays at 3 AM */
  @Scheduled(cron = "0 0 3 * * SUN")
  @Transactional
  public void performWeeklyDeepCleanup() {
    if (!cleanupEnabled) {
      logger.info("Data cleanup is disabled, skipping weekly deep cleanup");
      return;
    }

    logger.info("Starting weekly deep cleanup");

    try {
      // Check for stuck privacy requests
      LocalDateTime stuckCutoff = LocalDateTime.now().minusHours(24);
      var stuckRequests = privacyRequestRepository.findStuckProcessingRequests(stuckCutoff);

      for (var request : stuckRequests) {
        request.setStatus(com.storesight.backend.model.PrivacyRequest.Status.FAILED);
        request.setProcessingLog("Request marked as failed due to timeout");
        privacyRequestRepository.save(request);

        logger.warn(
            "Marked stuck privacy request as failed: ID {}, Shop {}",
            request.getId(),
            request.getShopId());
      }

      if (!stuckRequests.isEmpty()) {
        logger.info("Processed {} stuck privacy requests", stuckRequests.size());
      }

      // Vacuum analyze for performance (PostgreSQL specific)
      logger.info("Weekly deep cleanup completed");

    } catch (Exception e) {
      logger.error("Failed to perform weekly deep cleanup: {}", e.getMessage(), e);
    }
  }

  /** Get cleanup statistics */
  public Map<String, Object> getCleanupStatistics() {
    Map<String, Object> stats = new HashMap<>();

    try {
      // Calculate data that would be cleaned up
      LocalDateTime auditCutoff = LocalDateTime.now().minusDays(auditLogRetentionDays);
      long expiredAuditLogs = auditLogRepository.countByCreatedAtBefore(auditCutoff);

      LocalDateTime costCutoff = LocalDateTime.now().minusDays(costDataRetentionDays);
      long expiredCostRecords =
          marketIntelligenceCostRepository.countByDateBefore(costCutoff.toLocalDate());

      LocalDateTime privacyRequestCutoff =
          LocalDateTime.now().minusDays(privacyRequestRetentionDays);
      var expiredPrivacyRequests =
          privacyRequestRepository.findPendingRequestsOlderThan(privacyRequestCutoff);

      stats.put(
          "expiredData",
          Map.of(
              "auditLogs", expiredAuditLogs,
              "costRecords", expiredCostRecords,
              "privacyRequests", expiredPrivacyRequests.size()));

      stats.put(
          "retentionPolicies",
          Map.of(
              "auditLogRetentionDays", auditLogRetentionDays,
              "competitorDataRetentionDays", competitorDataRetentionDays,
              "costDataRetentionDays", costDataRetentionDays,
              "privacyRequestRetentionDays", privacyRequestRetentionDays));

      stats.put("cleanupEnabled", cleanupEnabled);
      stats.put("lastCalculated", LocalDateTime.now());

    } catch (Exception e) {
      logger.error("Failed to get cleanup statistics: {}", e.getMessage());
      stats.put("error", e.getMessage());
    }

    return stats;
  }

  /** Manual cleanup trigger (for admin use) */
  @Transactional
  public Map<String, Object> performManualCleanup(String reason) {
    logger.info("Manual cleanup triggered - Reason: {}", reason);

    Map<String, Object> result = new HashMap<>();
    LocalDateTime startTime = LocalDateTime.now();

    try {
      // Perform the same cleanup as daily task
      performDailyCleanup();

      result.put("success", true);
      result.put("message", "Manual cleanup completed successfully");
      result.put("reason", reason);
      result.put("triggeredAt", startTime);
      result.put("completedAt", LocalDateTime.now());

      // Audit log the manual cleanup
      competitorAuditService.logDataAccessed(
          null, "MANUAL_CLEANUP", "Manual cleanup triggered: " + reason);

    } catch (Exception e) {
      logger.error("Manual cleanup failed: {}", e.getMessage(), e);
      result.put("success", false);
      result.put("error", e.getMessage());
    }

    return result;
  }
}
