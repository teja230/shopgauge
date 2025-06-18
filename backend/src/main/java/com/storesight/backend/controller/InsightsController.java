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
      logger.warn("No shop cookie found");
      throw new RuntimeException("Not authenticated");
    }
    return insightsService.getInsights(shop);
  }
}
