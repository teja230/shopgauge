package com.storesight.backend.controller;

import com.storesight.backend.service.SecretService;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
  private final SecretService secretService;

  @Autowired
  public AdminController(SecretService secretService) {
    this.secretService = secretService;
  }

  @PostMapping("/secrets")
  public ResponseEntity<Map<String, String>> updateSecret(@RequestBody Map<String, String> secret) {
    String key = secret.get("key");
    String value = secret.get("value");

    if (key == null || value == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "Both key and value are required"));
    }

    secretService.storeSecret(key, value);
    return ResponseEntity.ok(Map.of("status", "Secret updated successfully"));
  }

  @GetMapping("/secrets/{key}")
  public ResponseEntity<Map<String, String>> getSecret(@PathVariable String key) {
    return secretService
        .getSecret(key)
        .map(value -> ResponseEntity.ok(Map.of("value", value)))
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/secrets/{key}")
  public ResponseEntity<Map<String, String>> deleteSecret(@PathVariable String key) {
    secretService.deleteSecret(key);
    return ResponseEntity.ok(Map.of("status", "Secret deleted successfully"));
  }

  @GetMapping("/secrets")
  public ResponseEntity<java.util.List<java.util.Map<String, String>>> listSecrets() {
    java.util.Map<String, String> map = secretService.listSecrets();
    java.util.List<java.util.Map<String, String>> list = new java.util.ArrayList<>();
    map.forEach((k, v) -> list.add(java.util.Map.of("key", k, "value", v)));
    return ResponseEntity.ok(list);
  }
}
