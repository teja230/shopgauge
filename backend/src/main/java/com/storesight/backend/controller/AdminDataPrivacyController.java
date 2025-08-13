package com.storesight.backend.controller;

import com.storesight.backend.model.AuditLog;
import com.storesight.backend.service.DataPrivacyService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin-refactor/privacy")
public class AdminDataPrivacyController {
  private static final Logger logger = LoggerFactory.getLogger(AdminDataPrivacyController.class);
  private final DataPrivacyService dataPrivacyService;

  @Autowired
  public AdminDataPrivacyController(DataPrivacyService dataPrivacyService) {
    this.dataPrivacyService = dataPrivacyService;
  }

  @GetMapping("/audit-logs/deleted-shops")
  public ResponseEntity<Map<String, Object>> getAuditLogsFromDeletedShops(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
    try {
      List<AuditLog> auditLogs = dataPrivacyService.getAuditLogsFromDeletedShops(page, size);
      List<Map<String, Object>> mappedLogs =
          auditLogs.stream()
              .map(
                  log -> {
                    Map<String, Object> logMap = new HashMap<>();
                    logMap.put("id", log.getId());
                    logMap.put("shopId", log.getShopId());
                    logMap.put("action", log.getAction());
                    logMap.put("details", log.getDetails());
                    logMap.put("userAgent", log.getUserAgent());
                    logMap.put("ipAddress", log.getIpAddress());
                    logMap.put("createdAt", log.getCreatedAt());
                    logMap.put("timestamp", log.getCreatedAt());
                    String shopDomain = dataPrivacyService.getShopDomainFromLog(log);
                    logMap.put("shopDomain", shopDomain);
                    return logMap;
                  })
              .collect(java.util.stream.Collectors.toList());
      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", mappedLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", mappedLogs.size());
      response.put("note", "These are audit logs from shops that have been deleted");
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error",
                  "Failed to retrieve audit logs from deleted shops",
                  "message",
                  e.getMessage()));
    }
  }

  @GetMapping("/audit-logs/active-shops")
  public ResponseEntity<Map<String, Object>> getAuditLogsFromActiveShops(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
    try {
      List<AuditLog> auditLogs = dataPrivacyService.getAuditLogsFromActiveShops(page, size);
      List<Map<String, Object>> mappedLogs =
          auditLogs.stream()
              .map(
                  log -> {
                    Map<String, Object> logMap = new HashMap<>();
                    logMap.put("id", log.getId());
                    logMap.put("shopId", log.getShopId());
                    logMap.put("action", log.getAction());
                    logMap.put("details", log.getDetails());
                    logMap.put("userAgent", log.getUserAgent());
                    logMap.put("ipAddress", log.getIpAddress());
                    logMap.put("createdAt", log.getCreatedAt());
                    logMap.put("timestamp", log.getCreatedAt());
                    String shopDomain = dataPrivacyService.getShopDomainFromLog(log);
                    logMap.put("shopDomain", shopDomain);
                    return logMap;
                  })
              .collect(java.util.stream.Collectors.toList());
      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", mappedLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", mappedLogs.size());
      response.put("note", "These are audit logs from active shops (shops that still exist)");
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error",
                  "Failed to retrieve audit logs from active shops",
                  "message",
                  e.getMessage()));
    }
  }

  @GetMapping("/active-shops")
  public ResponseEntity<Map<String, Object>> getActiveShops() {
    try {
      List<Map<String, Object>> activeShops = dataPrivacyService.getActiveShops();
      Map<String, Object> response = new HashMap<>();
      response.put("active_shops", activeShops);
      response.put("total_count", activeShops.size());
      response.put(
          "note",
          "Shops that are currently active or have recent activity (enhanced with multi-session support)");
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve active shops", "message", e.getMessage()));
    }
  }

  @GetMapping("/active-shops/detailed")
  public ResponseEntity<Map<String, Object>> getDetailedActiveShops() {
    try {
      List<Map<String, Object>> detailedShops = dataPrivacyService.getDetailedActiveShops();
      Map<String, Object> response = new HashMap<>();
      response.put("detailed_shops", detailedShops);
      response.put("total_sessions", detailedShops.size());
      response.put(
          "unique_shops",
          detailedShops.stream().map(shop -> shop.get("shopDomain")).distinct().count());
      response.put("note", "Detailed information about all active sessions for each shop");
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error", "Failed to retrieve detailed active shops", "message", e.getMessage()));
    }
  }

  @GetMapping("/deleted-shops")
  public ResponseEntity<Map<String, Object>> getDeletedShops() {
    try {
      List<Map<String, Object>> deletedShops = dataPrivacyService.getDeletedShopsData();
      Map<String, Object> response = new HashMap<>();
      response.put("deleted_shops", deletedShops);
      response.put("total_count", deletedShops.size());
      response.put("note", "Shops that have been deleted with extracted domain information");
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve deleted shops", "message", e.getMessage()));
    }
  }

  @GetMapping("/session-statistics")
  public ResponseEntity<Map<String, Object>> getSessionStatistics() {
    try {
      Map<String, Object> statistics = dataPrivacyService.getSessionStatistics();
      Map<String, Object> response = new HashMap<>();
      response.put("statistics", statistics);
      response.put(
          "note", "Comprehensive session statistics for monitoring multi-session architecture");
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of("error", "Failed to retrieve session statistics", "message", e.getMessage()));
    }
  }
}

