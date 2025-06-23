package com.storesight.backend.controller;

import com.storesight.backend.service.InsightsService;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class InsightsController {
  private static final Logger logger = LoggerFactory.getLogger(InsightsController.class);

  @Autowired private InsightsService insightsService;

  @GetMapping("/insights")
  public Map<String, Object> getInsights(
      @CookieValue(value = "shop", required = false) String shop) {
    logger.info("Getting insights for shop: {}", shop);
    if (shop == null) {
      logger.warn("No shop cookie found - providing default insights");
      return Map.of(
          "conversionRate",
          2.5,
          "conversionRateDelta",
          0.0,
          "topSellingProducts",
          java.util.List.of(),
          "abandonedCartCount",
          0,
          "insightText",
          "Please connect your Shopify store to view personalized insights.");
    }

    try {
      return insightsService.getInsights(shop);
    } catch (Exception e) {
      logger.error("Failed to get insights for shop: {}, providing fallback", shop, e);
      return Map.of(
          "conversionRate",
          2.5,
          "conversionRateDelta",
          0.0,
          "topSellingProducts",
          java.util.List.of(),
          "abandonedCartCount",
          0,
          "insightText",
          "Dashboard is loading. Industry average conversion rate is 2.5%.");
    }
  }
}
