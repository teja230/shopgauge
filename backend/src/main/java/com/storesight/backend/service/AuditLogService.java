package com.storesight.backend.service;

import com.storesight.backend.model.AuditLog;
import com.storesight.backend.model.Shop;
import com.storesight.backend.repository.AuditLogRepository;
import com.storesight.backend.repository.ShopRepository;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AuditLogService {

  @Autowired private AuditLogRepository auditLogRepository;

  @Autowired private ShopRepository shopRepository;

  public void saveAuditLog(AuditLog auditLog) {
    auditLogRepository.save(auditLog);
  }

  public void logExportAction(
      String shopDomain, String action, String type, Map<String, Object> details) {
    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopDomain);
      if (shopOpt.isPresent()) {
        AuditLog auditLog = new AuditLog();
        auditLog.setShopId(shopOpt.get().getId());
        auditLog.setAction(action + "_" + type);
        auditLog.setDetails(details != null ? details.toString() : null);
        auditLog.setCreatedAt(LocalDateTime.now());

        auditLogRepository.save(auditLog);
      }
    } catch (Exception e) {
      // Log error but don't fail the operation
      System.err.println("Failed to log audit action: " + e.getMessage());
    }
  }

  public void logShareAction(String shopDomain, String platform, Map<String, Object> details) {
    logExportAction(shopDomain, "share", platform, details);
  }

  public Map<String, Object> getExportStats(String shopDomain) {
    Map<String, Object> stats = new HashMap<>();

    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopDomain);
      if (shopOpt.isPresent()) {
        Long shopId = shopOpt.get().getId();

        // Get export counts by type (using existing methods)
        Long pngExports = auditLogRepository.countByShopIdAndAction(shopId, "export_png");
        Long pdfExports = auditLogRepository.countByShopIdAndAction(shopId, "export_pdf");
        Long excelExports = auditLogRepository.countByShopIdAndAction(shopId, "export_excel");

        // Get share counts
        Long linkedinShares = auditLogRepository.countByShopIdAndAction(shopId, "share_linkedin");
        Long twitterShares = auditLogRepository.countByShopIdAndAction(shopId, "share_twitter");
        Long emailShares = auditLogRepository.countByShopIdAndAction(shopId, "share_email");

        // Get recent activity (last 30 days) - using existing method
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        Long recentActivity =
            (long) auditLogRepository.findRecentByShop(shopId, thirtyDaysAgo).size();

        stats.put(
            "exports",
            Map.of(
                "png", pngExports,
                "pdf", pdfExports,
                "excel", excelExports,
                "total", pngExports + pdfExports + excelExports));

        stats.put(
            "shares",
            Map.of(
                "linkedin", linkedinShares,
                "twitter", twitterShares,
                "email", emailShares,
                "total", linkedinShares + twitterShares + emailShares));

        stats.put("recentActivity", recentActivity);
        stats.put("success", true);
      } else {
        stats.put("error", "Shop not found");
        stats.put("success", false);
      }
    } catch (Exception e) {
      stats.put("error", "Failed to get stats: " + e.getMessage());
      stats.put("success", false);
    }

    return stats;
  }
}
