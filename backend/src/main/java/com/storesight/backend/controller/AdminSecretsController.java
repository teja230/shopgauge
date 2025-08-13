package com.storesight.backend.controller;

import com.storesight.backend.service.SecretService;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin-refactor/secrets")
public class AdminSecretsController {

  @Autowired private SecretService secretService;

  @PostMapping
  public ResponseEntity<Map<String, String>> createOrUpdateSecret(
      @RequestBody Map<String, String> request) {
    String key = request.get("key");
    String value = request.get("value");
    secretService.putSecret(key, value);
    return ResponseEntity.ok(Map.of("status", "Secret saved successfully"));
  }

  @GetMapping("/{key}")
  public ResponseEntity<Map<String, String>> getSecret(@PathVariable String key) {
    return secretService
        .getSecret(key)
        .map(value -> ResponseEntity.ok(Map.of("value", value)))
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{key}")
  public ResponseEntity<Map<String, String>> deleteSecret(@PathVariable String key) {
    secretService.deleteSecret(key);
    return ResponseEntity.ok(Map.of("status", "Secret deleted successfully"));
  }

  @GetMapping
  public ResponseEntity<List<Map<String, String>>> listSecrets() {
    Map<String, String> map = secretService.listSecrets();
    List<Map<String, String>> list = new ArrayList<>();
    map.forEach((k, v) -> list.add(Map.of("key", k, "value", v)));
    return ResponseEntity.ok(list);
  }
}
