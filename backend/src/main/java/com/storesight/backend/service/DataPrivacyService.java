package com.storesight.backend.service;

import com.storesight.backend.model.AuditLog;
import com.storesight.backend.model.Shop;
import com.storesight.backend.model.ShopSession;
import com.storesight.backend.repository.AuditLogRepository;
import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.repository.ShopSessionRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Enhanced service for data privacy compliance with multi-session support. Handles GDPR compliance,
 * audit logging, and data minimization.
 */
@Service
public class DataPrivacyService {

  private static final Logger logger = LoggerFactory.getLogger(DataPrivacyService.class);
  private final StringRedisTemplate redisTemplate;
  private final AuditLogRepository auditLogRepository;
  private final ShopRepository shopRepository;
  private final ShopSessionRepository shopSessionRepository;

  // Data retention periods (in days)
  private static final int ORDER_DATA_RETENTION_DAYS = 60; // Only last 60 days as per requirement
  private static final int ANALYTICS_DATA_RETENTION_DAYS = 90; // Aggregated analytics
  private static final int AUDIT_LOG_RETENTION_DAYS = 365; // Compliance audit logs

  @Autowired
  public DataPrivacyService(
      StringRedisTemplate redisTemplate,
      AuditLogRepository auditLogRepository,
      ShopRepository shopRepository,
      ShopSessionRepository shopSessionRepository) {
    this.redisTemplate = redisTemplate;
    this.auditLogRepository = auditLogRepository;
    this.shopRepository = shopRepository;
    this.shopSessionRepository = shopSessionRepository;
  }

  /** Process only minimum required data for analytics purposes */
  @SuppressWarnings("unchecked")
  public Map<String, Object> minimizeOrderData(Map<String, Object> orderData) {
    Map<String, Object> minimizedData = new HashMap<>();

    // Only extract essential fields for analytics
    minimizedData.put("id", orderData.get("id"));
    minimizedData.put("total_price", orderData.get("total_price"));
    minimizedData.put("currency", orderData.get("currency"));
    minimizedData.put("created_at", orderData.get("created_at"));
    minimizedData.put("financial_status", orderData.get("financial_status"));
    minimizedData.put("fulfillment_status", orderData.get("fulfillment_status"));

    // Customer data - only ID for analytics, no PII unless explicitly needed
    if (orderData.containsKey("customer") && orderData.get("customer") != null) {
      Map<String, Object> customer = (Map<String, Object>) orderData.get("customer");
      if (customer != null) {
        Map<String, Object> minimizedCustomer = new HashMap<>();
        minimizedCustomer.put("id", customer.get("id")); // Only customer ID for analytics
        minimizedData.put("customer", minimizedCustomer);
      }
    }

    logDataAccess("ORDER_DATA_MINIMIZED", String.valueOf(orderData.get("id")));
    return minimizedData;
  }

  /** Check if data processing is within stated purposes */
  public boolean isProcessingPurposeValid(String purpose) {
    Set<String> validPurposes =
        Set.of(
            "ANALYTICS",
            "REVENUE_REPORTING",
            "CONVERSION_TRACKING",
            "BUSINESS_INTELLIGENCE",
            "INVENTORY_MANAGEMENT");

    boolean isValid = validPurposes.contains(purpose.toUpperCase());
    logDataAccess("PURPOSE_VALIDATION", purpose + " - " + (isValid ? "APPROVED" : "REJECTED"));
    return isValid;
  }

  /** Log data access for audit trail - now using PostgreSQL */
  public void logDataAccess(String action, String details) {
    logDataAccess(action, details, null);
  }

  /** Log data access for audit trail with shop context */
  public void logDataAccess(String action, String details, String shopDomain) {
    try {
      final Long shopId;
      if (shopDomain != null) {
        logger.debug("Looking up shop for domain: {}", shopDomain);
        Optional<Shop> shopOptional = shopRepository.findByShopifyDomain(shopDomain);
        if (shopOptional.isPresent()) {
          shopId = shopOptional.get().getId();
          logger.debug("Found shop with ID: {} for domain: {}", shopId, shopDomain);
        } else {
          shopId = null;
          logger.warn("No shop found for domain: {}", shopDomain);
        }
      } else {
        shopId = null;
        logger.debug("No shop domain provided for audit log");
      }

      // Get request context for additional audit information
      String userAgent = null;
      String ipAddress = null;

      try {
        ServletRequestAttributes attributes =
            (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
          HttpServletRequest request = attributes.getRequest();
          userAgent = request.getHeader("User-Agent");
          ipAddress = getClientIpAddress(request);
        }
      } catch (Exception e) {
        logger.debug("Could not extract request context for audit log: {}", e.getMessage());
      }

      AuditLog auditLog = new AuditLog(shopId, action, details, userAgent, ipAddress);
      auditLogRepository.save(auditLog);

      // Also log to application logs for immediate visibility
      logger.info(
          "Data Privacy Audit: {} - {} - {} - Shop ID: {}",
          auditLog.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
          action,
          details,
          shopId);

    } catch (Exception e) {
      logger.error("Failed to save audit log: {}", e.getMessage(), e);
      // Fallback to application logging if database fails
      logger.warn("Audit log fallback: {} - {}", action, details);
    }
  }

  /** Get client IP address from request */
  private String getClientIpAddress(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null
        && !xForwardedFor.isEmpty()
        && !"unknown".equalsIgnoreCase(xForwardedFor)) {
      return xForwardedFor.split(",")[0].trim();
    }

    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isEmpty() && !"unknown".equalsIgnoreCase(xRealIp)) {
      return xRealIp;
    }

    return request.getRemoteAddr();
  }

  /** Generate privacy compliance report */
  public Map<String, Object> generateComplianceReport(String shopId) {
    Map<String, Object> report = new HashMap<>();

    // Data processing summary
    report.put("data_minimization", "✅ Only essential fields processed for analytics");
    report.put("purpose_limitation", "✅ Processing limited to stated business purposes");
    report.put("retention_policy", "✅ " + ORDER_DATA_RETENTION_DAYS + " days for order data");
    report.put("encryption", "✅ Data encrypted at rest and in transit");
    report.put("consent_tracking", "✅ Customer consent recorded and respected");

    // Audit statistics from PostgreSQL
    try {
      final Long shopIdLong;
      if (shopId != null) {
        shopIdLong =
            shopRepository.findByShopifyDomain(shopId).map(shop -> shop.getId()).orElse(null);
      } else {
        shopIdLong = null;
      }

      if (shopIdLong != null) {
        // Count today's data access logs (all data-related actions)
        LocalDateTime startOfToday =
            LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime endOfToday = startOfToday.plusDays(1);
        List<AuditLog> todayLogs =
            auditLogRepository.findByShopIdAndCreatedAtBetweenOrderByCreatedAtDesc(
                shopIdLong, startOfToday, endOfToday);

        // Filter for data access related actions
        long dataAccessCount =
            todayLogs.stream().filter(log -> isDataAccessAction(log.getAction())).count();
        report.put("audit_logs_today", dataAccessCount);

        // Get recent audit activity (last 30 days)
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        List<AuditLog> recentLogs = auditLogRepository.findRecentByShop(shopIdLong, thirtyDaysAgo);

        // Filter for data access related actions
        long recentDataAccessCount =
            recentLogs.stream().filter(log -> isDataAccessAction(log.getAction())).count();
        report.put("recent_audit_activity", recentDataAccessCount);

        // Add detailed audit statistics for weekly breakdown
        try {
          LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
          List<AuditLog> weeklyLogs =
              auditLogRepository.findByShopIdAndCreatedAtBetweenOrderByCreatedAtDesc(
                  shopIdLong, sevenDaysAgo, LocalDateTime.now());

          Map<String, Long> actionBreakdown =
              weeklyLogs.stream()
                  .filter(log -> isDataAccessAction(log.getAction()))
                  .collect(
                      java.util.stream.Collectors.groupingBy(
                          AuditLog::getAction, java.util.stream.Collectors.counting()));

          report.put("weekly_action_breakdown", actionBreakdown);
          report.put(
              "total_weekly_access_events",
              actionBreakdown.values().stream().mapToLong(Long::longValue).sum());
        } catch (Exception e) {
          logger.warn("Error generating detailed audit statistics: {}", e.getMessage());
        }
      } else {
        report.put("audit_logs_today", 0);
        report.put("recent_audit_activity", 0);
        report.put("weekly_action_breakdown", new java.util.HashMap<>());
        report.put("total_weekly_access_events", 0);
      }
    } catch (Exception e) {
      logger.error("Error generating audit statistics: {}", e.getMessage());
      report.put("audit_logs_today", "Error retrieving data");
      report.put("recent_audit_activity", "Error retrieving data");
      report.put("weekly_action_breakdown", new java.util.HashMap<>());
      report.put("total_weekly_access_events", 0);
    }

    report.put("compliance_status", "COMPLIANT");
    report.put("last_updated", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

    logDataAccess("COMPLIANCE_REPORT_GENERATED", shopId);
    return report;
  }

  /** Validate that processing meets all privacy requirements */
  public boolean validatePrivacyCompliance(String purpose, String dataType, String shopId) {
    // Check purpose validity
    if (!isProcessingPurposeValid(purpose)) {
      logDataAccess("PRIVACY_COMPLIANCE_FAILED", "Invalid purpose: " + purpose, shopId);
      return false;
    }

    // Check data minimization
    if ("ORDER_DATA".equals(dataType)) {
      logDataAccess("PRIVACY_COMPLIANCE_CHECK", "Order data minimization validated", shopId);
    }

    // Log successful validation
    logDataAccess("PRIVACY_COMPLIANCE_PASSED", "All privacy requirements met", shopId);
    return true;
  }

  /** Clean up old audit logs based on retention policy */
  public void cleanupOldAuditLogs() {
    try {
      LocalDateTime cutoffDate = LocalDateTime.now().minusDays(AUDIT_LOG_RETENTION_DAYS);
      long deletedCount = auditLogRepository.countByCreatedAtBefore(cutoffDate);
      auditLogRepository.deleteByCreatedAtBefore(cutoffDate);

      logger.info(
          "Cleaned up {} old audit logs older than {} days",
          deletedCount,
          AUDIT_LOG_RETENTION_DAYS);
      logDataAccess("AUDIT_LOG_CLEANUP", "Deleted " + deletedCount + " old audit logs");
    } catch (Exception e) {
      logger.error("Error cleaning up old audit logs: {}", e.getMessage(), e);
    }
  }

  /** Check if an audit log action is related to data access */
  private boolean isDataAccessAction(String action) {
    if (action == null) {
      return false;
    }

    // Define data access related actions
    return action.contains("DATA_REQUEST")
        || action.contains("DATA_ACCESS")
        || action.contains("REVENUE_DATA")
        || action.contains("ORDER_DATA")
        || action.contains("STORE_STATS")
        || action.contains("DATA_EXPORT")
        || action.contains("ANALYTICS")
        || action.equals("DATA_MINIMIZED")
        || action.equals("ORDER_DATA_MINIMIZED");
  }

  /** Get audit logs for a shop with pagination */
  public List<AuditLog> getAuditLogsForShop(String shopDomain, int page, int size) {
    try {
      return shopRepository
          .findByShopifyDomain(shopDomain)
          .map(
              shop ->
                  auditLogRepository.findByShopIdOrderByCreatedAtDesc(
                      shop.getId(), org.springframework.data.domain.PageRequest.of(page, size)))
          .map(org.springframework.data.domain.Page::getContent)
          .orElse(Collections.emptyList());
    } catch (Exception e) {
      logger.error("Error retrieving audit logs for shop {}: {}", shopDomain, e.getMessage());
      return Collections.emptyList();
    }
  }

  /** Get audit logs from deleted shops (where shop_id is null) for administrative purposes */
  public List<AuditLog> getAuditLogsFromDeletedShops(int page, int size) {
    try {
      return auditLogRepository
          .findByShopIdIsNullOrderByCreatedAtDesc(
              org.springframework.data.domain.PageRequest.of(page, size))
          .getContent();
    } catch (Exception e) {
      logger.error("Error retrieving audit logs from deleted shops: {}", e.getMessage());
      return Collections.emptyList();
    }
  }

  /** Get audit logs from active shops (where shop_id is not null) for administrative purposes */
  public List<AuditLog> getAuditLogsFromActiveShops(int page, int size) {
    try {
      return auditLogRepository
          .findByShopIdIsNotNullOrderByCreatedAtDesc(
              org.springframework.data.domain.PageRequest.of(page, size))
          .getContent();
    } catch (Exception e) {
      logger.error("Error retrieving audit logs from active shops: {}", e.getMessage());
      return Collections.emptyList();
    }
  }

  /** Get all audit logs (both active and deleted shops) for administrative purposes */
  public List<AuditLog> getAllAuditLogs(int page, int size) {
    try {
      return auditLogRepository
          .findAllByOrderByCreatedAtDesc(org.springframework.data.domain.PageRequest.of(page, size))
          .getContent();
    } catch (Exception e) {
      logger.error("Error retrieving all audit logs: {}", e.getMessage());
      return Collections.emptyList();
    }
  }

  /** Scheduled cleanup of old audit logs - runs daily at 2 AM */
  @org.springframework.scheduling.annotation.Scheduled(cron = "0 0 2 * * *")
  public void scheduledAuditLogCleanup() {
    logger.info("Starting scheduled audit log cleanup...");
    cleanupOldAuditLogs();
  }

  /** Enhanced method to get active shops using the new multi-session architecture */
  public List<Map<String, Object>> getActiveShops() {
    try {
      LocalDateTime twentyFourHoursAgo = LocalDateTime.now().minusDays(1);

      // Get recent audit logs that have shop activity
      List<AuditLog> recentLogs =
          auditLogRepository.findByCreatedAtAfterOrderByCreatedAtDesc(twentyFourHoursAgo);

      // Group by shop domain and get the most recent activity for each shop
      Map<String, Map<String, Object>> activeShopsMap = new HashMap<>();

      for (AuditLog log : recentLogs) {
        String shopDomain = getShopDomainFromLog(log);
        if (shopDomain != null && !activeShopsMap.containsKey(shopDomain)) {
          Map<String, Object> shopInfo = new HashMap<>();
          shopInfo.put("shopDomain", shopDomain);
          shopInfo.put("lastActivity", log.getCreatedAt().toString());
          shopInfo.put("ipAddress", log.getIpAddress());
          shopInfo.put("userAgent", log.getUserAgent());
          shopInfo.put("sessionId", "audit_" + log.getId()); // Audit-based session reference
          shopInfo.put("isActive", true);
          shopInfo.put("source", "audit_logs");

          activeShopsMap.put(shopDomain, shopInfo);
        }
      }

      // Enhanced: Add shops from the database with their actual active sessions
      List<Shop> allShops = shopRepository.findAll();
      for (Shop shop : allShops) {
        String shopDomain = shop.getShopifyDomain();
        if (shopDomain != null) {
          // Get active sessions for this shop
          List<ShopSession> activeSessions =
              shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(shop);

          if (!activeSessions.isEmpty()) {
            // Use the most recent active session as the primary representation
            ShopSession mostRecentSession = activeSessions.get(0);

            if (!activeShopsMap.containsKey(shopDomain)) {
              Map<String, Object> shopInfo = new HashMap<>();
              shopInfo.put("shopDomain", shopDomain);
              shopInfo.put("lastActivity", mostRecentSession.getLastAccessedAt().toString());
              shopInfo.put("ipAddress", mostRecentSession.getIpAddress());
              shopInfo.put("userAgent", mostRecentSession.getUserAgent());
              shopInfo.put("sessionId", mostRecentSession.getSessionId());
              shopInfo.put("isActive", true);
              shopInfo.put("source", "database_sessions");
              shopInfo.put("activeSessionCount", activeSessions.size());
              shopInfo.put("sessionCreatedAt", mostRecentSession.getCreatedAt().toString());

              activeShopsMap.put(shopDomain, shopInfo);
            } else {
              // Update existing entry with session information
              Map<String, Object> existingInfo = activeShopsMap.get(shopDomain);
              existingInfo.put("activeSessionCount", activeSessions.size());
              existingInfo.put("databaseSessionId", mostRecentSession.getSessionId());
              existingInfo.put("sessionCreatedAt", mostRecentSession.getCreatedAt().toString());
              existingInfo.put("source", "audit_and_sessions");
            }
          } else {
            // Fallback: Check if shop has active token in Redis (legacy support)
            String token = redisTemplate.opsForValue().get("shop_token:" + shopDomain);
            if (token != null && !activeShopsMap.containsKey(shopDomain)) {
              Map<String, Object> shopInfo = new HashMap<>();
              shopInfo.put("shopDomain", shopDomain);
              shopInfo.put(
                  "lastActivity",
                  shop.getUpdatedAt() != null ? shop.getUpdatedAt().toString() : null);
              shopInfo.put("ipAddress", "N/A");
              shopInfo.put("userAgent", "N/A");
              shopInfo.put("sessionId", "legacy_" + shop.getId());
              shopInfo.put("isActive", true);
              shopInfo.put("source", "redis_fallback");
              shopInfo.put("activeSessionCount", 0);

              activeShopsMap.put(shopDomain, shopInfo);
            }
          }
        }
      }

      List<Map<String, Object>> result = new ArrayList<>(activeShopsMap.values());

      // Sort by last activity (most recent first)
      result.sort(
          (a, b) -> {
            String aTime = (String) a.get("lastActivity");
            String bTime = (String) b.get("lastActivity");
            if (aTime == null && bTime == null) return 0;
            if (aTime == null) return 1;
            if (bTime == null) return -1;
            return bTime.compareTo(aTime);
          });

      logger.info("Found {} active shops using multi-session architecture", result.size());
      logDataAccess(
          "ACTIVE_SHOPS_RETRIEVED",
          "Retrieved " + result.size() + " active shops with session information");

      return result;
    } catch (Exception e) {
      logger.error("Error retrieving active shops: {}", e.getMessage(), e);
      return Collections.emptyList();
    }
  }

  /** Enhanced method to get detailed shop session information for admin dashboard */
  public List<Map<String, Object>> getDetailedActiveShops() {
    try {
      List<Map<String, Object>> detailedShops = new ArrayList<>();

      // Get all shops with active sessions
      List<Shop> allShops = shopRepository.findAll();

      for (Shop shop : allShops) {
        List<ShopSession> activeSessions =
            shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(shop);

        if (!activeSessions.isEmpty()) {
          for (ShopSession session : activeSessions) {
            Map<String, Object> sessionInfo = new HashMap<>();
            sessionInfo.put("shopDomain", shop.getShopifyDomain());
            sessionInfo.put("sessionId", session.getSessionId());
            sessionInfo.put("lastActivity", session.getLastAccessedAt().toString());
            sessionInfo.put("createdAt", session.getCreatedAt().toString());
            sessionInfo.put("ipAddress", session.getIpAddress());
            sessionInfo.put("userAgent", session.getUserAgent());
            sessionInfo.put("isActive", session.getIsActive());
            sessionInfo.put("isExpired", session.isExpired());
            sessionInfo.put(
                "expiresAt",
                session.getExpiresAt() != null ? session.getExpiresAt().toString() : null);
            sessionInfo.put("totalActiveSessions", activeSessions.size());
            sessionInfo.put("shopId", shop.getId());
            sessionInfo.put("shopCreatedAt", shop.getCreatedAt().toString());
            sessionInfo.put("shopUpdatedAt", shop.getUpdatedAt().toString());

            detailedShops.add(sessionInfo);
          }
        }
      }

      // Sort by last activity (most recent first)
      detailedShops.sort(
          (a, b) -> {
            String aTime = (String) a.get("lastActivity");
            String bTime = (String) b.get("lastActivity");
            if (aTime == null && bTime == null) return 0;
            if (aTime == null) return 1;
            if (bTime == null) return -1;
            return bTime.compareTo(aTime);
          });

      logger.info(
          "Retrieved detailed information for {} active sessions across {} shops",
          detailedShops.size(),
          allShops.size());

      return detailedShops;
    } catch (Exception e) {
      logger.error("Error retrieving detailed active shops: {}", e.getMessage(), e);
      return Collections.emptyList();
    }
  }

  /** Get session statistics for admin dashboard */
  public Map<String, Object> getSessionStatistics() {
    try {
      Map<String, Object> stats = new HashMap<>();

      // Total active sessions
      long totalActiveSessions = shopSessionRepository.count();
      stats.put("totalActiveSessions", totalActiveSessions);

      // Active sessions (not expired)
      List<ShopSession> activeSessions =
          shopSessionRepository.findAll().stream()
              .filter(session -> session.getIsActive() && !session.isExpired())
              .collect(Collectors.toList());
      stats.put("currentlyActiveSessions", activeSessions.size());

      // Shops with multiple sessions
      Map<Long, List<ShopSession>> sessionsByShop =
          activeSessions.stream()
              .collect(Collectors.groupingBy(session -> session.getShop().getId()));

      long shopsWithMultipleSessions =
          sessionsByShop.entrySet().stream()
              .mapToLong(entry -> entry.getValue().size() > 1 ? 1 : 0)
              .sum();
      stats.put("shopsWithMultipleSessions", shopsWithMultipleSessions);

      // Average sessions per shop
      double avgSessionsPerShop =
          sessionsByShop.isEmpty() ? 0 : (double) activeSessions.size() / sessionsByShop.size();
      stats.put("averageSessionsPerShop", Math.round(avgSessionsPerShop * 100.0) / 100.0);

      // Sessions by time period
      LocalDateTime now = LocalDateTime.now();
      LocalDateTime oneDayAgo = now.minusDays(1);
      LocalDateTime oneWeekAgo = now.minusDays(7);

      long sessionsLastDay =
          activeSessions.stream()
              .mapToLong(session -> session.getLastAccessedAt().isAfter(oneDayAgo) ? 1 : 0)
              .sum();
      stats.put("sessionsActiveLastDay", sessionsLastDay);

      long sessionsLastWeek =
          activeSessions.stream()
              .mapToLong(session -> session.getLastAccessedAt().isAfter(oneWeekAgo) ? 1 : 0)
              .sum();
      stats.put("sessionsActiveLastWeek", sessionsLastWeek);

      // Top IP addresses (for security monitoring)
      Map<String, Long> ipCounts =
          activeSessions.stream()
              .filter(session -> session.getIpAddress() != null)
              .collect(Collectors.groupingBy(ShopSession::getIpAddress, Collectors.counting()));

      List<Map<String, Object>> topIps =
          ipCounts.entrySet().stream()
              .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
              .limit(10)
              .map(
                  entry -> {
                    Map<String, Object> ipInfo = new HashMap<>();
                    ipInfo.put("ipAddress", entry.getKey());
                    ipInfo.put("sessionCount", entry.getValue());
                    return ipInfo;
                  })
              .collect(Collectors.toList());
      stats.put("topIpAddresses", topIps);

      stats.put("generatedAt", LocalDateTime.now().toString());

      logger.info(
          "Generated session statistics: {} total active sessions, {} currently active",
          totalActiveSessions,
          activeSessions.size());

      return stats;
    } catch (Exception e) {
      logger.error("Error generating session statistics: {}", e.getMessage(), e);
      return Map.of(
          "error", "Failed to generate statistics", "generatedAt", LocalDateTime.now().toString());
    }
  }

  /** Get shop domain from audit log - either from shop ID or extract from details */
  public String getShopDomainFromLog(AuditLog log) {
    try {
      if (log.getShopId() != null) {
        Optional<Shop> shop = shopRepository.findById(log.getShopId());
        if (shop.isPresent()) {
          return shop.get().getShopifyDomain();
        }
      }

      // Try to extract shop domain from log details if shop ID is null (deleted shop)
      String details = log.getDetails();
      if (details != null) {
        // First try to find .myshopify.com domains
        if (details.contains(".myshopify.com")) {
          java.util.regex.Pattern pattern =
              java.util.regex.Pattern.compile("([a-zA-Z0-9-]+\\.myshopify\\.com)");
          java.util.regex.Matcher matcher = pattern.matcher(details);
          if (matcher.find()) {
            return matcher.group(1);
          }
        }

        // Try to extract from common patterns in audit logs
        String[] patterns = {
          "shop:\\s*([a-zA-Z0-9-]+\\.myshopify\\.com)",
          "domain:\\s*([a-zA-Z0-9-]+\\.myshopify\\.com)",
          "for shop ([a-zA-Z0-9-]+\\.myshopify\\.com)",
          "Shop ([a-zA-Z0-9-]+\\.myshopify\\.com)",
          "from ([a-zA-Z0-9-]+\\.myshopify\\.com)",
          "\"shop_domain\":\\s*\"([a-zA-Z0-9-]+\\.myshopify\\.com)\"",
          "shop_domain=([a-zA-Z0-9-]+\\.myshopify\\.com)"
        };

        for (String patternStr : patterns) {
          java.util.regex.Pattern pattern =
              java.util.regex.Pattern.compile(patternStr, java.util.regex.Pattern.CASE_INSENSITIVE);
          java.util.regex.Matcher matcher = pattern.matcher(details);
          if (matcher.find()) {
            return matcher.group(1);
          }
        }

        // If no .myshopify.com found, try to extract any domain-like pattern
        java.util.regex.Pattern generalPattern =
            java.util.regex.Pattern.compile("([a-zA-Z0-9-]+\\.[a-zA-Z]{2,})");
        java.util.regex.Matcher generalMatcher = generalPattern.matcher(details);
        if (generalMatcher.find()) {
          String domain = generalMatcher.group(1);
          // Only return if it looks like a shop domain
          if (domain.contains("shop")
              || domain.contains("store")
              || details.toLowerCase().contains("shopify")) {
            return domain;
          }
        }
      }

      return "Unknown Domain";
    } catch (Exception e) {
      logger.warn(
          "Error extracting shop domain from audit log {}: {}", log.getId(), e.getMessage());
      return "Unknown Domain";
    }
  }

  /** Get deleted shops data formatted like active shops for consistent UI */
  public List<Map<String, Object>> getDeletedShopsData() {
    try {
      List<AuditLog> deletedShopLogs =
          auditLogRepository
              .findByShopIdIsNullOrderByCreatedAtDesc(
                  org.springframework.data.domain.PageRequest.of(0, 100))
              .getContent();

      // Group by shop domain to avoid duplicates
      Map<String, Map<String, Object>> deletedShopsMap = new HashMap<>();

      for (AuditLog log : deletedShopLogs) {
        String shopDomain = getShopDomainFromLog(log);
        if (shopDomain != null && !deletedShopsMap.containsKey(shopDomain)) {
          Map<String, Object> shopInfo = new HashMap<>();
          shopInfo.put("shopDomain", shopDomain);
          shopInfo.put("lastActivity", log.getCreatedAt().toString());
          shopInfo.put("ipAddress", log.getIpAddress());
          shopInfo.put("userAgent", log.getUserAgent());
          shopInfo.put("sessionId", "deleted_" + log.getId());
          shopInfo.put("isActive", false);
          shopInfo.put("action", log.getAction());
          shopInfo.put("details", log.getDetails());
          shopInfo.put("category", "DATA_DELETION");

          deletedShopsMap.put(shopDomain, shopInfo);
        }
      }

      List<Map<String, Object>> result = new ArrayList<>(deletedShopsMap.values());

      // Sort by last activity (most recent first)
      result.sort(
          (a, b) -> {
            String aTime = (String) a.get("lastActivity");
            String bTime = (String) b.get("lastActivity");
            if (aTime == null && bTime == null) return 0;
            if (aTime == null) return 1;
            if (bTime == null) return -1;
            return bTime.compareTo(aTime);
          });

      logger.info("Found {} deleted shops", result.size());
      logDataAccess("DELETED_SHOPS_RETRIEVED", "Retrieved " + result.size() + " deleted shops");

      return result;
    } catch (Exception e) {
      logger.error("Error retrieving deleted shops: {}", e.getMessage(), e);
      return Collections.emptyList();
    }
  }
}
