package com.storesight.backend.controller;

import com.storesight.backend.service.DataPrivacyService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin-refactor/data-privacy")
public class AdminDataPrivacyController {

  @Autowired private DataPrivacyService dataPrivacyService;

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
