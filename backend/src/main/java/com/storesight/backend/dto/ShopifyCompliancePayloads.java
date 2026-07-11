package com.storesight.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public final class ShopifyCompliancePayloads {
  private ShopifyCompliancePayloads() {}

  public record CustomerReference(Long id, String email, String phone) {}

  public record CustomerDataRequest(
      @JsonProperty("shop_id") Long shopId,
      @JsonProperty("shop_domain") String shopDomain,
      CustomerReference customer,
      @JsonProperty("orders_requested") List<Long> ordersRequested) {}

  public record CustomerRedactRequest(
      @JsonProperty("shop_id") Long shopId,
      @JsonProperty("shop_domain") String shopDomain,
      CustomerReference customer,
      @JsonProperty("orders_to_redact") List<Long> ordersToRedact) {}

  public record ShopRedactRequest(
      @JsonProperty("shop_id") Long shopId, @JsonProperty("shop_domain") String shopDomain) {}
}
