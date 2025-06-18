package com.storesight.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class InsightsController {
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private ObjectMapper objectMapper;

  @GetMapping("/insights")
  public InsightDto getInsights() throws Exception {
    Map<String, Object> row =
        jdbcTemplate.queryForMap(
            "SELECT * FROM daily_metrics WHERE shop_id=1 ORDER BY date DESC LIMIT 1");
    double conversionRate =
        row.get("conversion_rate") != null
            ? ((Number) row.get("conversion_rate")).doubleValue()
            : 0.0;
    int abandonedCartCount =
        row.get("abandoned_cart_count") != null
            ? ((Number) row.get("abandoned_cart_count")).intValue()
            : 0;
    String topSellingProductsRaw =
        row.get("top_selling_products") != null ? row.get("top_selling_products").toString() : "[]";
    List<Map<String, Object>> topSellingProducts =
        objectMapper.readValue(
            topSellingProductsRaw, new TypeReference<List<Map<String, Object>>>() {});
    // For MVP, hard-code conversionRateDelta and insightText
    double conversionRateDelta = 0.0;
    String insightText =
        String.format(
            "Your CR is %.2f%%, below the 1.5%% benchmark—consider optimizing product pages or running a promotion.",
            conversionRate);
    return new InsightDto(
        conversionRate, conversionRateDelta, topSellingProducts, abandonedCartCount, insightText);
  }

  public static class InsightDto {
    public double conversionRate;
    public double conversionRateDelta;
    public List<Map<String, Object>> topSellingProducts;
    public int abandonedCartCount;
    public String insightText;

    public InsightDto(
        double conversionRate,
        double conversionRateDelta,
        List<Map<String, Object>> topSellingProducts,
        int abandonedCartCount,
        String insightText) {
      this.conversionRate = conversionRate;
      this.conversionRateDelta = conversionRateDelta;
      this.topSellingProducts = topSellingProducts;
      this.abandonedCartCount = abandonedCartCount;
      this.insightText = insightText;
    }
  }
}
