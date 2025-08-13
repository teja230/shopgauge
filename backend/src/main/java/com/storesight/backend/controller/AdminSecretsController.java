package com.storesight.backend.controller;

import com.storesight.backend.service.SecretService;
import jakarta.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin-refactor/secrets")
@Validated
public class AdminSecretsController {
  private final SecretService secretService;

  @Autowired
  public AdminSecretsController(SecretService secretService) {
    this.secretService = secretService;
  }

  public static class UpdateSecretRequest {
    @NotBlank public String key;
    @NotBlank public String value;
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> updateSecret(
      @RequestBody @Validated UpdateSecretRequest req) {
    secretService.storeSecret(req.key, req.value);
    return ResponseEntity.ok(Map.of("status", "Secret updated successfully"));
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
