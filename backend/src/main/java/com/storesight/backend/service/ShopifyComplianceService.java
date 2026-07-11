package com.storesight.backend.service;

import com.storesight.backend.dto.ShopifyCompliancePayloads.CustomerDataRequest;
import com.storesight.backend.dto.ShopifyCompliancePayloads.CustomerRedactRequest;
import com.storesight.backend.dto.ShopifyCompliancePayloads.ShopRedactRequest;
import com.storesight.backend.model.PrivacyRequest;
import com.storesight.backend.model.Shop;
import com.storesight.backend.repository.PrivacyRequestRepository;
import com.storesight.backend.repository.ShopRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.LocalDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShopifyComplianceService {
  private static final Logger logger = LoggerFactory.getLogger(ShopifyComplianceService.class);
  private final ShopRepository shopRepository;
  private final PrivacyRequestRepository privacyRequestRepository;
  private final DataPrivacyService dataPrivacyService;
  private final DashboardCacheService dashboardCacheService;
  private final MeterRegistry meterRegistry;

  public ShopifyComplianceService(
      ShopRepository shopRepository,
      PrivacyRequestRepository privacyRequestRepository,
      DataPrivacyService dataPrivacyService,
      DashboardCacheService dashboardCacheService,
      MeterRegistry meterRegistry) {
    this.shopRepository = shopRepository;
    this.privacyRequestRepository = privacyRequestRepository;
    this.dataPrivacyService = dataPrivacyService;
    this.dashboardCacheService = dashboardCacheService;
    this.meterRegistry = meterRegistry;
  }

  @Transactional
  public void acceptDataRequest(CustomerDataRequest payload) {
    Shop shop = findShop(payload.shopDomain());
    if (shop == null) {
      recordMetric("customers_data_request", "no_local_shop");
      return;
    }
    PrivacyRequest request =
        new PrivacyRequest(
            shop.getId(), PrivacyRequest.RequestType.EXPORT, "shopify_webhook", null);
    request.setStatus(PrivacyRequest.Status.COMPLETED);
    request.setProcessedAt(LocalDateTime.now());
    request.setCompletedAt(LocalDateTime.now());
    request.setRequestDetails("{\"source\":\"customers/data_request\"}");
    request.setProcessingLog(
        "Request recorded; StoreSight does not persist customer PII or order-level customer data");
    privacyRequestRepository.save(request);
    dataPrivacyService.logDataAccess(
        "SHOPIFY_CUSTOMER_DATA_REQUEST", "Compliance request accepted", payload.shopDomain());
    recordMetric("customers_data_request", "accepted");
  }

  @Transactional
  public void redactCustomer(CustomerRedactRequest payload) {
    dashboardCacheService.invalidateShopCache(payload.shopDomain());
    Shop shop = findShop(payload.shopDomain());
    if (shop == null) {
      recordMetric("customers_redact", "already_absent");
      return;
    }
    PrivacyRequest request =
        new PrivacyRequest(
            shop.getId(), PrivacyRequest.RequestType.DELETE, "shopify_webhook", null);
    request.setStatus(PrivacyRequest.Status.COMPLETED);
    request.setProcessedAt(LocalDateTime.now());
    request.setCompletedAt(LocalDateTime.now());
    request.setRequestDetails("{\"source\":\"customers/redact\"}");
    request.setProcessingLog(
        "Customer-bearing transient analytics caches invalidated; no customer PII is persisted");
    privacyRequestRepository.save(request);
    dataPrivacyService.logDataAccess(
        "SHOPIFY_CUSTOMER_REDACT", "Transient customer data invalidated", payload.shopDomain());
    recordMetric("customers_redact", "completed");
  }

  @Transactional
  public void redactShop(ShopRedactRequest payload) {
    dashboardCacheService.invalidateShopCache(payload.shopDomain());
    Shop shop = findShop(payload.shopDomain());
    if (shop == null) {
      recordMetric("shop_redact", "already_absent");
      return;
    }
    PrivacyRequest request =
        new PrivacyRequest(
            shop.getId(), PrivacyRequest.RequestType.DELETE, "shopify_webhook", null);
    request.setStatus(PrivacyRequest.Status.PROCESSING);
    request.setProcessedAt(LocalDateTime.now());
    request.setRequestDetails("{\"source\":\"shop/redact\"}");
    privacyRequestRepository.save(request);
    dataPrivacyService
        .deleteShopData(shop.getId(), "Shopify shop/redact compliance webhook")
        .thenAccept(
            report -> {
              request.setStatus(
                  Boolean.TRUE.equals(report.get("success"))
                      ? PrivacyRequest.Status.COMPLETED
                      : PrivacyRequest.Status.FAILED);
              request.setCompletedAt(LocalDateTime.now());
              request.setProcessingLog("Shop redaction finished");
              privacyRequestRepository.save(request);
            });
    shop.softDelete("Shopify shop/redact compliance webhook");
    shopRepository.save(shop);
    recordMetric("shop_redact", "accepted");
  }

  private Shop findShop(String shopDomain) {
    if (shopDomain == null || shopDomain.isBlank()) return null;
    return shopRepository.findByShopifyDomain(shopDomain).orElse(null);
  }

  private void recordMetric(String topic, String outcome) {
    Counter.builder("storesight.shopify.compliance.webhook")
        .tag("topic", topic)
        .tag("outcome", outcome)
        .register(meterRegistry)
        .increment();
    logger.info("Processed Shopify compliance webhook topic={} outcome={}", topic, outcome);
  }
}
