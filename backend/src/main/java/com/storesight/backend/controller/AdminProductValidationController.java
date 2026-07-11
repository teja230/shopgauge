package com.storesight.backend.controller;

import com.storesight.backend.service.ProductValidationService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/product-validation")
public class AdminProductValidationController {
  private final ProductValidationService productValidationService;

  public AdminProductValidationController(ProductValidationService productValidationService) {
    this.productValidationService = productValidationService;
  }

  @GetMapping("/summary")
  public ResponseEntity<Map<String, Long>> getTodaySummary() {
    return ResponseEntity.ok(productValidationService.getTodaySummary());
  }
}
