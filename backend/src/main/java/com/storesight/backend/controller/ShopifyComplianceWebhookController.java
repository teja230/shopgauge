package com.storesight.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.dto.ShopifyCompliancePayloads.CustomerDataRequest;
import com.storesight.backend.dto.ShopifyCompliancePayloads.CustomerRedactRequest;
import com.storesight.backend.dto.ShopifyCompliancePayloads.ShopRedactRequest;
import com.storesight.backend.service.ShopifyComplianceService;
import com.storesight.backend.service.ShopifyWebhookVerifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/webhooks/shopify")
public class ShopifyComplianceWebhookController {
  private final ObjectMapper objectMapper;
  private final ShopifyWebhookVerifier verifier;
  private final ShopifyComplianceService complianceService;

  public ShopifyComplianceWebhookController(
      ObjectMapper objectMapper,
      ShopifyWebhookVerifier verifier,
      ShopifyComplianceService complianceService) {
    this.objectMapper = objectMapper;
    this.verifier = verifier;
    this.complianceService = complianceService;
  }

  @PostMapping("/customers/data-request")
  public ResponseEntity<Void> customerDataRequest(
      @RequestBody String rawBody,
      @RequestHeader(value = "X-Shopify-Hmac-Sha256", required = false) String hmac)
      throws Exception {
    if (!verifier.isValid(rawBody, hmac))
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    complianceService.acceptDataRequest(objectMapper.readValue(rawBody, CustomerDataRequest.class));
    return ResponseEntity.ok().build();
  }

  @PostMapping("/customers/redact")
  public ResponseEntity<Void> customerRedact(
      @RequestBody String rawBody,
      @RequestHeader(value = "X-Shopify-Hmac-Sha256", required = false) String hmac)
      throws Exception {
    if (!verifier.isValid(rawBody, hmac))
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    complianceService.redactCustomer(objectMapper.readValue(rawBody, CustomerRedactRequest.class));
    return ResponseEntity.ok().build();
  }

  @PostMapping("/shop/redact")
  public ResponseEntity<Void> shopRedact(
      @RequestBody String rawBody,
      @RequestHeader(value = "X-Shopify-Hmac-Sha256", required = false) String hmac)
      throws Exception {
    if (!verifier.isValid(rawBody, hmac))
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    complianceService.redactShop(objectMapper.readValue(rawBody, ShopRedactRequest.class));
    return ResponseEntity.ok().build();
  }
}
