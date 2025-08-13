package com.storesight.backend.service;

import com.storesight.backend.model.AdminAuditLog;
import com.storesight.backend.model.AuditLog;
import com.storesight.backend.repository.AdminAuditLogRepository;
import com.storesight.backend.repository.AuditLogRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class CentralAuditWriter {

  @Autowired private AuditLogRepository auditLogRepository;
  @Autowired private AdminAuditLogRepository adminAuditLogRepository;
  @Autowired private AuditMaskingService maskingService;

  public void writeShopAudit(
      Long shopId, String action, Map<String, Object> details, String userAgent, String ipAddress) {
    AuditLog log = new AuditLog();
    log.setShopId(shopId);
    log.setAction(action);
    log.setDetails(
        maskingService.maskMap(details) != null
            ? maskingService.maskMap(details).toString()
            : null);
    log.setUserAgent(maskingService.maskFreeform(userAgent));
    log.setIpAddress(maskingService.maskFreeform(ipAddress));
    log.setCreatedAt(LocalDateTime.now());
    auditLogRepository.save(log);
  }

  public void writeAdminAudit(
      String event, String username, Map<String, Object> details, String ipAddress) {
    AdminAuditLog log = new AdminAuditLog();
    log.setEvent(event);
    log.setUsername(maskingService.maskFreeform(username));
    log.setDetails(
        maskingService.maskMap(details) != null
            ? maskingService.maskMap(details).toString()
            : null);
    log.setIpAddress(maskingService.maskFreeform(ipAddress));
    log.setTimestamp(Instant.now());
    adminAuditLogRepository.save(log);
  }
}
