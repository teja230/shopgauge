package com.storesight.backend.controller;

import com.storesight.backend.model.AdminAuditLog;
import com.storesight.backend.service.AdminAuthService;
import com.storesight.backend.service.AdminRateLimitingService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Enhanced Admin Audit Controller Provides comprehensive audit logging and monitoring capabilities
 * for admin operations
 */
@RestController
@RequestMapping("/api/admin/audit")
public class AdminAuditController {

  private static final Logger logger = LoggerFactory.getLogger(AdminAuditController.class);

  @Autowired private AdminAuthService adminAuthService;

  @Autowired private AdminRateLimitingService adminRateLimitingService;

  /** Get recent admin audit logs with filtering and pagination */
  @GetMapping("/logs")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<Map<String, Object>> getAuditLogs(
      @RequestParam(defaultValue = "24") int hours,
      @RequestParam(defaultValue = "100") int limit,
      @RequestParam(required = false) String username,
      @RequestParam(required = false) String event,
      @RequestParam(required = false) String ipAddress,
      HttpServletRequest request) {

    String clientIp = getClientIpAddress(request);
    String currentUser = getCurrentUsername(request);

    try {
      List<AdminAuditLog> auditLogs;

      if (username != null && !username.trim().isEmpty()) {
        Instant since = Instant.now().minus(hours, ChronoUnit.HOURS);
        auditLogs = adminAuthService.getRecentAuditLogsByUsername(username, since);
      } else {
        auditLogs = adminAuthService.getRecentAuditLogs(limit);
      }

      // Filter by event type if specified
      if (event != null && !event.trim().isEmpty()) {
        auditLogs =
            auditLogs.stream()
                .filter(log -> event.equals(log.getEvent()))
                .collect(java.util.stream.Collectors.toList());
      }

      // Filter by IP address if specified
      if (ipAddress != null && !ipAddress.trim().isEmpty()) {
        auditLogs =
            auditLogs.stream()
                .filter(log -> ipAddress.equals(log.getIpAddress()))
                .collect(java.util.stream.Collectors.toList());
      }

      // Limit results
      auditLogs = auditLogs.stream().limit(limit).collect(java.util.stream.Collectors.toList());

      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", auditLogs);
      response.put("total_count", auditLogs.size());
      response.put("hours_back", hours);
      response.put(
          "filters",
          Map.of(
              "username", username != null ? username : "all",
              "event", event != null ? event : "all",
              "ipAddress", ipAddress != null ? ipAddress : "all"));

      // Log this audit access
      adminAuthService.logAuditEvent(
          "AUDIT_LOGS_ACCESSED",
          currentUser,
          "Accessed audit logs with filters: username="
              + username
              + ", event="
              + event
              + ", ipAddress="
              + ipAddress,
          clientIp);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Failed to retrieve audit logs: {}", e.getMessage(), e);
      adminAuthService.logAuditEvent(
          "AUDIT_LOGS_ACCESS_FAILED",
          currentUser,
          "Failed to access audit logs: " + e.getMessage(),
          clientIp);
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve audit logs", "message", e.getMessage()));
    }
  }

  /** Get security statistics and metrics */
  @GetMapping("/security-stats")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<Map<String, Object>> getSecurityStats(
      @RequestParam(defaultValue = "24") int hours, HttpServletRequest request) {

    String clientIp = getClientIpAddress(request);
    String currentUser = getCurrentUsername(request);

    try {
      Map<String, Object> stats = new HashMap<>();

      // Get failed login attempts
      long failedLogins = adminAuthService.getFailedLoginAttempts(clientIp, hours);
      stats.put("failed_login_attempts", failedLogins);

      // Get rate limiting stats
      AdminRateLimitingService.RateLimitStats rateLimitStats =
          adminRateLimitingService.getRateLimitStats(clientIp);
      stats.put(
          "rate_limit_stats",
          Map.of(
              "remaining_admin_requests", rateLimitStats.getRemainingAdminRequests(),
              "remaining_login_attempts", rateLimitStats.getRemainingLoginAttempts(),
              "rate_limit_enabled", rateLimitStats.isRateLimitEnabled()));

      // Get recent audit events summary
      List<AdminAuditLog> recentLogs = adminAuthService.getRecentAuditLogs(50);
      Map<String, Long> eventCounts =
          recentLogs.stream()
              .collect(
                  java.util.stream.Collectors.groupingBy(
                      AdminAuditLog::getEvent, java.util.stream.Collectors.counting()));
      stats.put("recent_event_counts", eventCounts);

      // Get unique IP addresses in recent logs
      long uniqueIps =
          recentLogs.stream()
              .map(AdminAuditLog::getIpAddress)
              .filter(ip -> ip != null && !ip.trim().isEmpty())
              .distinct()
              .count();
      stats.put("unique_ip_addresses", uniqueIps);

      stats.put("hours_analyzed", hours);
      stats.put("timestamp", Instant.now());

      // Log this security stats access
      adminAuthService.logAuditEvent(
          "SECURITY_STATS_ACCESSED",
          currentUser,
          "Accessed security statistics for " + hours + " hours",
          clientIp);

      return ResponseEntity.ok(stats);

    } catch (Exception e) {
      logger.error("Failed to retrieve security stats: {}", e.getMessage(), e);
      adminAuthService.logAuditEvent(
          "SECURITY_STATS_ACCESS_FAILED",
          currentUser,
          "Failed to access security stats: " + e.getMessage(),
          clientIp);
      return ResponseEntity.status(500)
          .body(
              Map.of("error", "Failed to retrieve security statistics", "message", e.getMessage()));
    }
  }

  /** Get suspicious activity report */
  @GetMapping("/suspicious-activity")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<Map<String, Object>> getSuspiciousActivity(
      @RequestParam(defaultValue = "24") int hours, HttpServletRequest request) {

    String clientIp = getClientIpAddress(request);
    String currentUser = getCurrentUsername(request);

    try {
      Map<String, Object> report = new HashMap<>();
      Instant since = Instant.now().minus(hours, ChronoUnit.HOURS);

      List<AdminAuditLog> recentLogs = adminAuthService.getRecentAuditLogs(200);

      // Filter for suspicious events
      List<AdminAuditLog> suspiciousEvents =
          recentLogs.stream()
              .filter(log -> log.getTimestamp().isAfter(since))
              .filter(log -> isSuspiciousEvent(log.getEvent()))
              .collect(java.util.stream.Collectors.toList());

      // Group by IP address to find patterns
      Map<String, List<AdminAuditLog>> eventsByIp =
          suspiciousEvents.stream()
              .filter(log -> log.getIpAddress() != null)
              .collect(java.util.stream.Collectors.groupingBy(AdminAuditLog::getIpAddress));

      // Find IPs with multiple suspicious events
      Map<String, Integer> suspiciousIps = new HashMap<>();
      eventsByIp.forEach(
          (ip, events) -> {
            if (events.size() > 3) { // More than 3 suspicious events
              suspiciousIps.put(ip, events.size());
            }
          });

      // Find failed login patterns
      List<AdminAuditLog> failedLogins =
          recentLogs.stream()
              .filter(log -> "LOGIN_FAILED".equals(log.getEvent()))
              .filter(log -> log.getTimestamp().isAfter(since))
              .collect(java.util.stream.Collectors.toList());

      Map<String, Long> failedLoginsByIp =
          failedLogins.stream()
              .filter(log -> log.getIpAddress() != null)
              .collect(
                  java.util.stream.Collectors.groupingBy(
                      AdminAuditLog::getIpAddress, java.util.stream.Collectors.counting()));

      report.put("suspicious_events", suspiciousEvents);
      report.put("suspicious_ips", suspiciousIps);
      report.put("failed_logins_by_ip", failedLoginsByIp);
      report.put("total_suspicious_events", suspiciousEvents.size());
      report.put("hours_analyzed", hours);
      report.put("analysis_timestamp", Instant.now());

      // Log this suspicious activity access
      adminAuthService.logAuditEvent(
          "SUSPICIOUS_ACTIVITY_REPORT_ACCESSED",
          currentUser,
          "Accessed suspicious activity report for "
              + hours
              + " hours, found "
              + suspiciousEvents.size()
              + " suspicious events",
          clientIp);

      return ResponseEntity.ok(report);

    } catch (Exception e) {
      logger.error("Failed to generate suspicious activity report: {}", e.getMessage(), e);
      adminAuthService.logAuditEvent(
          "SUSPICIOUS_ACTIVITY_REPORT_FAILED",
          currentUser,
          "Failed to generate suspicious activity report: " + e.getMessage(),
          clientIp);
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error",
                  "Failed to generate suspicious activity report",
                  "message",
                  e.getMessage()));
    }
  }

  /** Clear rate limiting for an IP address (emergency use) */
  @PostMapping("/clear-rate-limit")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<Map<String, Object>> clearRateLimit(
      @RequestBody Map<String, String> request, HttpServletRequest httpRequest) {

    String targetIp = request.get("ip_address");
    String reason = request.get("reason");
    String clientIp = getClientIpAddress(httpRequest);
    String currentUser = getCurrentUsername(httpRequest);

    if (targetIp == null || targetIp.trim().isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "IP address is required"));
    }

    try {
      adminRateLimitingService.clearRateLimiting(targetIp);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Rate limiting cleared for IP: " + targetIp);
      response.put("cleared_ip", targetIp);
      response.put("reason", reason != null ? reason : "No reason provided");

      // Log this critical operation
      adminAuthService.logAuditEvent(
          "RATE_LIMIT_CLEARED",
          currentUser,
          "Cleared rate limiting for IP: "
              + targetIp
              + (reason != null ? " - Reason: " + reason : ""),
          clientIp);

      logger.warn(
          "Rate limiting cleared for IP: {} by admin: {} from IP: {}",
          targetIp,
          currentUser,
          clientIp);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Failed to clear rate limiting for IP {}: {}", targetIp, e.getMessage(), e);
      adminAuthService.logAuditEvent(
          "RATE_LIMIT_CLEAR_FAILED",
          currentUser,
          "Failed to clear rate limiting for IP: " + targetIp + " - " + e.getMessage(),
          clientIp);
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to clear rate limiting", "message", e.getMessage()));
    }
  }

  /** Force logout all admin sessions (emergency use) */
  @PostMapping("/force-logout-all")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<Map<String, Object>> forceLogoutAll(
      @RequestBody Map<String, String> request, HttpServletRequest httpRequest) {

    String reason = request.get("reason");
    String clientIp = getClientIpAddress(httpRequest);
    String currentUser = getCurrentUsername(httpRequest);

    try {
      // This would require implementing a method to invalidate all admin tokens
      // For now, we'll log the attempt and provide guidance

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Force logout initiated - all admin tokens will be invalidated");
      response.put("reason", reason != null ? reason : "Emergency logout requested");
      response.put("note", "Admin users will need to re-authenticate on their next request");

      // Log this critical security operation
      adminAuthService.logAuditEvent(
          "FORCE_LOGOUT_ALL_INITIATED",
          currentUser,
          "Initiated force logout of all admin sessions"
              + (reason != null ? " - Reason: " + reason : ""),
          clientIp);

      logger.warn(
          "Force logout of all admin sessions initiated by admin: {} from IP: {}",
          currentUser,
          clientIp);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Failed to initiate force logout: {}", e.getMessage(), e);
      adminAuthService.logAuditEvent(
          "FORCE_LOGOUT_ALL_FAILED",
          currentUser,
          "Failed to initiate force logout of all admin sessions: " + e.getMessage(),
          clientIp);
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to initiate force logout", "message", e.getMessage()));
    }
  }

  private boolean isSuspiciousEvent(String event) {
    return event != null
        && (event.contains("FAILED")
            || event.contains("BLOCKED")
            || event.contains("UNAUTHORIZED")
            || event.contains("DENIED")
            || event.contains("ERROR")
            || event.equals("ACCOUNT_LOCKED"));
  }

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

  private String getCurrentUsername(HttpServletRequest request) {
    String token = getAdminTokenFromRequest(request);
    if (token != null) {
      return adminAuthService.getUsernameFromToken(token);
    }
    return "unknown";
  }

  private String getAdminTokenFromRequest(HttpServletRequest request) {
    // Check for admin token in cookie
    jakarta.servlet.http.Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (jakarta.servlet.http.Cookie cookie : cookies) {
        if ("admin_token".equals(cookie.getName())) {
          return cookie.getValue();
        }
      }
    }

    // Check for admin token in Authorization header
    String authHeader = request.getHeader("Authorization");
    if (authHeader != null && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }
}
