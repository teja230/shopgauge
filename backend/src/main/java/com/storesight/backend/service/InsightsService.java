package com.storesight.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class InsightsService {
  private static final Logger logger = LoggerFactory.getLogger(InsightsService.class);

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private ObjectMapper objectMapper;

  public Map<String, Object> getInsights(String shop) {
    logger.info("Getting insights for shop: {}", shop);
    try {
      // Get the latest metrics for the shop
      List<Map<String, Object>> rows =
          jdbcTemplate.queryForList(
              "SELECT * FROM daily_metrics WHERE shop_id = (SELECT id FROM shops WHERE shopify_domain = ?) ORDER BY date DESC LIMIT 1",
              shop);

      if (rows.isEmpty()) {
        logger.warn("No metrics found for shop: {}, providing industry benchmarks", shop);
        return Map.of(
            "conversionRate",
            2.5, // Industry average
            "conversionRateDelta",
            0.0,
            "topSellingProducts",
            List.of(),
            "abandonedCartCount",
            0,
            "insightText",
            "Analytics will appear here as your store grows. Industry average conversion rate is 2.5%.");
      }

      Map<String, Object> row = rows.get(0);

      // Process the data with null checks
      double conversionRate =
          row.get("conversion_rate") != null
              ? ((Number) row.get("conversion_rate")).doubleValue()
              : 0.0;

      int abandonedCartCount =
          row.get("abandoned_cart_count") != null
              ? ((Number) row.get("abandoned_cart_count")).intValue()
              : 0;

      String topSellingProductsRaw =
          row.get("top_selling_products") != null
              ? row.get("top_selling_products").toString()
              : "[]";

      List<Map<String, Object>> topSellingProducts;
      try {
        topSellingProducts =
            objectMapper.readValue(
                topSellingProductsRaw, new TypeReference<List<Map<String, Object>>>() {});
      } catch (Exception e) {
        logger.error("Error parsing top selling products for shop: {}", shop, e);
        topSellingProducts = List.of();
      }

      // For MVP, hard-code conversionRateDelta and insightText
      double conversionRateDelta = 0.0;
      String insightText =
          String.format(
              "Your conversion rate is %.2f%%. %s",
              conversionRate,
              conversionRate < 1.5
                  ? "Consider optimizing product pages or running a promotion to improve."
                  : "Great job! Keep up the good work.");

      // Create response
      Map<String, Object> response =
          Map.of(
              "conversionRate", conversionRate,
              "conversionRateDelta", conversionRateDelta,
              "topSellingProducts", topSellingProducts,
              "abandonedCartCount", abandonedCartCount,
              "insightText", insightText);

      logger.info("Successfully retrieved insights for shop: {}", shop);
      return response;

    } catch (Exception e) {
      logger.error("Error getting insights for shop: {}, providing fallback data", shop, e);
      return Map.of(
          "conversionRate",
          2.5, // Industry average
          "conversionRateDelta",
          0.0,
          "topSellingProducts",
          List.of(),
          "abandonedCartCount",
          0,
          "insightText",
          "Dashboard is loading. Industry average conversion rate is 2.5%.");
    }
  }
}

interface IndustryBenchmarkService {
  double getConversionRateBenchmark();
}

@Service
class DefaultIndustryBenchmarkService implements IndustryBenchmarkService {
  @Override
  public double getConversionRateBenchmark() {
    return 1.5; // Hard-coded for MVP
  }
}
