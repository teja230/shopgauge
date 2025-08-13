package com.storesight.backend.controller;

import java.util.HashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin-refactor/emergency-status")
public class AdminEmergencyController {

  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> getHealth() {
    Map<String, Object> health = new HashMap<>();
    health.put("status", "OK");
    health.put("uptime", System.currentTimeMillis());
    return ResponseEntity.ok(health);
  }

  @GetMapping("/system-load")
  public Map<String, Object> getSystemLoad() {
    Map<String, Object> load = new HashMap<>();
    load.put("availableProcessors", Runtime.getRuntime().availableProcessors());
    load.put("freeMemory", Runtime.getRuntime().freeMemory());
    load.put("totalMemory", Runtime.getRuntime().totalMemory());
    load.put("maxMemory", Runtime.getRuntime().maxMemory());
    try {
      java.lang.management.OperatingSystemMXBean osBean =
          java.lang.management.ManagementFactory.getOperatingSystemMXBean();
      load.put("systemLoadAverage", osBean.getSystemLoadAverage());
    } catch (Exception e) {
      load.put("systemLoadAverage", "unavailable");
    }
    return load;
  }
}
