package com.storesight.backend.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RootController {

  private static final Logger logger = LoggerFactory.getLogger(RootController.class);

  @GetMapping("/")
  public ResponseEntity<Map<String, Object>> getRoot() {
    logger.info("Root endpoint accessed");

    Map<String, Object> response = new HashMap<>();
    response.put("message", "ShopGauge API");
    response.put("version", "1.0.0");
    response.put("status", "operational");
    response.put("documentation", "https://www.shopgaugeai.com");
    response.put("timestamp", LocalDateTime.now().toString());
    response.put(
        "endpoints",
        Map.of(
            "health", "/api/health/summary",
            "auth", "/api/auth/shopify",
            "analytics", "/api/analytics",
            "competitors", "/api/competitors"));

    return ResponseEntity.ok(response);
  }
}
