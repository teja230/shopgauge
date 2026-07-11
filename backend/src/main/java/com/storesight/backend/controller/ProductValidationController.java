package com.storesight.backend.controller;

import com.storesight.backend.dto.ProductInterestRequest;
import com.storesight.backend.dto.ProductInterestResponse;
import com.storesight.backend.service.ProductValidationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/product-validation")
public class ProductValidationController {
  private final ProductValidationService productValidationService;

  public ProductValidationController(ProductValidationService productValidationService) {
    this.productValidationService = productValidationService;
  }

  @PostMapping("/interest")
  public ResponseEntity<ProductInterestResponse> recordInterest(
      @Valid @RequestBody ProductInterestRequest request) {
    productValidationService.recordInterest(request);
    return ResponseEntity.accepted()
        .body(
            new ProductInterestResponse(
                true,
                request.plan(),
                "Preference recorded; no subscription or charge was created"));
  }
}
