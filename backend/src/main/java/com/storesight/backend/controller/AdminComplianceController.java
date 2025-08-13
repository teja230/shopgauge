package com.storesight.backend.controller;

import com.storesight.backend.compliance.PIIInventoryService;
import com.storesight.backend.service.DataRetentionService;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/compliance")
@PreAuthorize("hasRole('ADMIN')")
public class AdminComplianceController {

  private final PIIInventoryService piiInventoryService;
  private final DataRetentionService dataRetentionService;

  public AdminComplianceController(
      PIIInventoryService piiInventoryService, DataRetentionService dataRetentionService) {
    this.piiInventoryService = piiInventoryService;
    this.dataRetentionService = dataRetentionService;
  }

  @GetMapping("/pii-inventory")
  public ResponseEntity<List<Map<String, Object>>> getPiiInventory() {
    return ResponseEntity.ok(piiInventoryService.scan("com.storesight.backend.model"));
  }

  @PostMapping("/run-retention")
  public ResponseEntity<Map<String, Object>> runRetention() {
    return ResponseEntity.ok(dataRetentionService.performManualCleanup("admin-triggered"));
  }
}
