package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Service for managing demo data in Redis cache Ensures demo store works seamlessly with existing
 * endpoints
 */
@Service
public class DemoDataService {

  private static final Logger logger = LoggerFactory.getLogger(DemoDataService.class);

  private static final String DEMO_STORE_DOMAIN = "demo-shopgauge.myshopify.com";
  private static final String REDIS_DEMO_PREFIX = "demo:";
  private static final String REDIS_PRODUCTS_KEY = "products:";
  private static final String REDIS_ANALYTICS_KEY = "analytics:";
  private static final String REDIS_COMPETITORS_KEY = "competitors:";
  private static final int DEMO_CACHE_TTL_HOURS = 24;

  @Autowired private StringRedisTemplate redisTemplate;

  @Autowired private ObjectMapper objectMapper;

  /** Seed Redis with demo data for analytics, products, and competitors */
  public void seedDemoData() {
    try {
      logger.info("Seeding demo data in Redis for store: {}", DEMO_STORE_DOMAIN);

      seedDemoProducts();
      seedDemoAnalytics();
      seedDemoCompetitors();
      seedDemoMetrics();

      logger.info("Demo data seeding completed successfully");

    } catch (Exception e) {
      logger.error("Error seeding demo data", e);
    }
  }

  /** Seed demo products in Redis */
  private void seedDemoProducts() {
    try {
      String productsKey = REDIS_DEMO_PREFIX + REDIS_PRODUCTS_KEY + DEMO_STORE_DOMAIN;

      // Create demo product data - more diverse and realistic product catalog
      Map<String, Object> products = new HashMap<>();
      // Electronics Category
      products.put(
          "demo_prod_1", createDemoProduct("Premium Wireless Headphones", 149.99, "Electronics"));
      products.put("demo_prod_2", createDemoProduct("Smart Fitness Tracker", 89.99, "Electronics"));
      products.put(
          "demo_prod_4", createDemoProduct("Portable Power Bank 20000mAh", 39.99, "Electronics"));
      products.put(
          "demo_prod_7", createDemoProduct("Bluetooth Speaker Waterproof", 79.99, "Electronics"));
      products.put("demo_prod_9", createDemoProduct("Wireless Charging Pad", 34.99, "Electronics"));
      products.put("demo_prod_10", createDemoProduct("USB-C Hub 7-in-1", 59.99, "Electronics"));
      products.put("demo_prod_11", createDemoProduct("Smart Home Camera", 129.99, "Electronics"));
      products.put("demo_prod_12", createDemoProduct("Gaming Mouse RGB", 79.99, "Electronics"));

      // Furniture & Home
      products.put("demo_prod_3", createDemoProduct("Ergonomic Office Chair", 299.99, "Furniture"));
      products.put("demo_prod_6", createDemoProduct("LED Desk Lamp with USB", 49.99, "Lighting"));
      products.put(
          "demo_prod_8", createDemoProduct("Laptop Stand Adjustable", 69.99, "Accessories"));
      products.put(
          "demo_prod_13", createDemoProduct("Standing Desk Converter", 199.99, "Furniture"));
      products.put(
          "demo_prod_14", createDemoProduct("Decorative Wall Art Set", 89.99, "Home Decor"));
      products.put("demo_prod_15", createDemoProduct("Memory Foam Pillow", 49.99, "Bedding"));

      // Kitchen & Appliances
      products.put(
          "demo_prod_5", createDemoProduct("Professional Coffee Maker", 189.99, "Appliances"));
      products.put(
          "demo_prod_16", createDemoProduct("Stainless Steel Water Bottle", 24.99, "Kitchen"));
      products.put("demo_prod_17", createDemoProduct("Air Fryer 6-Quart", 149.99, "Appliances"));
      products.put("demo_prod_18", createDemoProduct("Bamboo Cutting Board Set", 39.99, "Kitchen"));

      // Fitness & Health
      products.put("demo_prod_19", createDemoProduct("Yoga Mat Extra Thick", 34.99, "Fitness"));
      products.put("demo_prod_20", createDemoProduct("Resistance Bands Set", 29.99, "Fitness"));
      products.put("demo_prod_21", createDemoProduct("Foam Roller Massage", 44.99, "Fitness"));

      // Fashion & Accessories
      products.put("demo_prod_22", createDemoProduct("Premium Leather Wallet", 79.99, "Fashion"));
      products.put("demo_prod_23", createDemoProduct("Sunglasses Polarized", 119.99, "Fashion"));
      products.put("demo_prod_24", createDemoProduct("Crossbody Travel Bag", 89.99, "Fashion"));

      // Store in Redis
      redisTemplate.opsForHash().putAll(productsKey, convertToStringMap(products));
      redisTemplate.expire(productsKey, Duration.ofHours(DEMO_CACHE_TTL_HOURS));

      logger.debug("Demo products seeded: {} products", products.size());

    } catch (Exception e) {
      logger.error("Error seeding demo products", e);
    }
  }

  /** Seed demo analytics data in Redis */
  private void seedDemoAnalytics() {
    try {
      String analyticsKey = REDIS_DEMO_PREFIX + REDIS_ANALYTICS_KEY + DEMO_STORE_DOMAIN;

      // Create demo analytics data
      Map<String, Object> analytics = new HashMap<>();

      // Revenue data for last 30 days
      analytics.put("total_revenue", 26900.0);
      analytics.put("total_orders", 187);
      analytics.put("average_order_value", 143.85);
      analytics.put("conversion_rate", 2.50);
      analytics.put("returning_customers", 67);

      // Dashboard card metrics - non-zero values
      analytics.put("abandoned_carts", 24);
      analytics.put("low_inventory_items", 8);
      analytics.put("new_products_this_month", 5);

      // Daily revenue trend (last 30 days)
      analytics.put("daily_revenue", generateDemoRevenueTrend());

      // Product performance
      analytics.put(
          "top_products",
          Arrays.asList(
              createProductPerformance("demo_prod_1", "Premium Wireless Headphones", 2849.85, 19),
              createProductPerformance("demo_prod_3", "Ergonomic Office Chair", 2399.92, 8),
              createProductPerformance("demo_prod_5", "Professional Coffee Maker", 1899.90, 10),
              createProductPerformance("demo_prod_2", "Smart Fitness Tracker", 1529.86, 17),
              createProductPerformance(
                  "demo_prod_7", "Bluetooth Speaker Waterproof", 1279.84, 16)));

      // Traffic data
      analytics.put("page_views", 3421);
      analytics.put("unique_visitors", 1243);
      analytics.put("bounce_rate", 42.5);
      analytics.put("average_session_duration", 185); // seconds

      // Store in Redis
      redisTemplate.opsForHash().putAll(analyticsKey, convertToStringMap(analytics));
      redisTemplate.expire(analyticsKey, Duration.ofHours(DEMO_CACHE_TTL_HOURS));

      logger.debug("Demo analytics seeded with {} metrics", analytics.size());

    } catch (Exception e) {
      logger.error("Error seeding demo analytics", e);
    }
  }

  /** Seed demo competitor data in Redis */
  private void seedDemoCompetitors() {
    try {
      String competitorsKey = REDIS_DEMO_PREFIX + REDIS_COMPETITORS_KEY + DEMO_STORE_DOMAIN;

      // Create demo competitor data
      Map<String, Object> competitors = new HashMap<>();

      competitors.put(
          "comp_1",
          createDemoCompetitor(
              "Amazon - Premium Headphones",
              "https://amazon.com/premium-wireless-headphones-demo",
              139.99,
              149.99,
              true,
              "amazon"));

      competitors.put(
          "comp_2",
          createDemoCompetitor(
              "Best Buy - Premium Audio",
              "https://bestbuy.com/premium-headphones-alternative-demo",
              159.99,
              149.99,
              true,
              "bestbuy"));

      competitors.put(
          "comp_3",
          createDemoCompetitor(
              "Amazon - Fitness Tracker",
              "https://amazon.com/smart-fitness-tracker-demo",
              94.99,
              89.99,
              true,
              "amazon"));

      competitors.put(
          "comp_4",
          createDemoCompetitor(
              "Target - Fitness Watch",
              "https://target.com/fitness-tracker-alternative-demo",
              84.99,
              89.99,
              false,
              "target"));

      competitors.put(
          "comp_5",
          createDemoCompetitor(
              "Wayfair - Office Chair",
              "https://wayfair.com/ergonomic-office-chair-demo",
              279.99,
              299.99,
              true,
              "wayfair"));

      competitors.put(
          "comp_6",
          createDemoCompetitor(
              "Amazon - Power Bank",
              "https://amazon.com/portable-power-bank-demo",
              44.99,
              39.99,
              true,
              "amazon"));

      competitors.put(
          "comp_7",
          createDemoCompetitor(
              "Williams Sonoma - Coffee Maker",
              "https://williams-sonoma.com/coffee-maker-demo",
              199.99,
              189.99,
              true,
              "williams-sonoma"));

      competitors.put(
          "comp_8",
          createDemoCompetitor(
              "Amazon - Desk Lamp",
              "https://amazon.com/led-desk-lamp-demo",
              45.99,
              49.99,
              true,
              "amazon"));

      // Store in Redis
      redisTemplate.opsForHash().putAll(competitorsKey, convertToStringMap(competitors));
      redisTemplate.expire(competitorsKey, Duration.ofHours(DEMO_CACHE_TTL_HOURS));

      logger.debug("Demo competitors seeded: {} competitors", competitors.size());

    } catch (Exception e) {
      logger.error("Error seeding demo competitors", e);
    }
  }

  /** Seed demo metrics and KPIs */
  private void seedDemoMetrics() {
    try {
      String metricsKey = REDIS_DEMO_PREFIX + "metrics:" + DEMO_STORE_DOMAIN;

      Map<String, Object> metrics = new HashMap<>();

      // Competitive metrics
      metrics.put("price_advantage_percentage", 8.5);
      metrics.put("competitors_monitored", 8);
      metrics.put("price_alerts_last_week", 3);
      metrics.put("stock_monitoring_active", true);

      // Performance metrics
      metrics.put("cache_hit_rate", 94.2);
      metrics.put("average_scraping_time", 1250); // milliseconds
      metrics.put("successful_checks_percentage", 97.8);

      // Trend data
      metrics.put("weekly_revenue_growth", 12.3);
      metrics.put("monthly_revenue_growth", 18.7);
      metrics.put("customer_acquisition_rate", 15.2);

      redisTemplate.opsForHash().putAll(metricsKey, convertToStringMap(metrics));
      redisTemplate.expire(metricsKey, Duration.ofHours(DEMO_CACHE_TTL_HOURS));

      logger.debug("Demo metrics seeded with {} KPIs", metrics.size());

    } catch (Exception e) {
      logger.error("Error seeding demo metrics", e);
    }
  }

  /** Clear demo data from Redis */
  public void clearDemoData() {
    try {
      logger.info("Clearing demo data from Redis");

      String pattern = REDIS_DEMO_PREFIX + "*";
      Set<String> keys = redisTemplate.keys(pattern);

      if (keys != null && !keys.isEmpty()) {
        redisTemplate.delete(keys);
        logger.info("Cleared {} demo cache keys", keys.size());
      } else {
        logger.debug("No demo cache keys found to clear");
      }

    } catch (Exception e) {
      logger.error("Error clearing demo data", e);
    }
  }

  /** Check if demo data exists in Redis */
  public boolean hasDemoData() {
    try {
      String pattern = REDIS_DEMO_PREFIX + "*";
      Set<String> keys = redisTemplate.keys(pattern);
      return keys != null && !keys.isEmpty();
    } catch (Exception e) {
      logger.error("Error checking demo data existence", e);
      return false;
    }
  }

  /** Refresh demo data (clear and reseed) */
  public void refreshDemoData() {
    clearDemoData();
    seedDemoData();
  }

  // Helper methods

  private Map<String, Object> createDemoProduct(String title, double price, String category) {
    Map<String, Object> product = new HashMap<>();
    product.put("title", title);
    product.put("price", price);
    product.put("category", category);
    product.put(
        "created_at",
        LocalDateTime.now().minusDays(30).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    product.put("updated_at", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    product.put("status", "active");
    return product;
  }

  private Map<String, Object> createDemoCompetitor(
      String label,
      String url,
      double currentPrice,
      double ourPrice,
      boolean inStock,
      String platform) {
    Map<String, Object> competitor = new HashMap<>();
    competitor.put("label", label);
    competitor.put("url", url);
    competitor.put("current_price", currentPrice);
    competitor.put("our_price", ourPrice);
    competitor.put("price_difference", ourPrice - currentPrice);
    competitor.put("price_difference_percentage", ((ourPrice - currentPrice) / currentPrice) * 100);
    competitor.put("in_stock", inStock);
    competitor.put("platform", platform);
    competitor.put(
        "last_checked", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    competitor.put("status", "active");
    return competitor;
  }

  private Map<String, Object> createProductPerformance(
      String productId, String title, double revenue, int units) {
    Map<String, Object> performance = new HashMap<>();
    performance.put("product_id", productId);
    performance.put("title", title);
    performance.put("revenue", revenue);
    performance.put("units_sold", units);
    performance.put("average_price", revenue / units);
    return performance;
  }

  private List<Map<String, Object>> generateDemoRevenueTrend() {
    List<Map<String, Object>> trend = new ArrayList<>();
    LocalDateTime startDate = LocalDateTime.now().minusDays(30);

    for (int i = 0; i < 30; i++) {
      Map<String, Object> dayData = new HashMap<>();
      LocalDateTime date = startDate.plusDays(i);

      // Generate realistic revenue with some variation
      double baseRevenue = 350 + (Math.random() * 200);
      // Weekend boost
      if (date.getDayOfWeek().getValue() >= 6) {
        baseRevenue *= 1.3;
      }

      dayData.put("date", date.format(DateTimeFormatter.ISO_LOCAL_DATE));
      dayData.put("revenue", Math.round(baseRevenue * 100.0) / 100.0);
      dayData.put("orders", (int) (baseRevenue / 120) + (int) (Math.random() * 3));

      trend.add(dayData);
    }

    return trend;
  }

  private Map<String, String> convertToStringMap(Map<String, Object> objectMap) {
    Map<String, String> stringMap = new HashMap<>();
    objectMap.forEach(
        (key, value) -> {
          try {
            if (value instanceof String) {
              stringMap.put(key, (String) value);
            } else {
              stringMap.put(key, objectMapper.writeValueAsString(value));
            }
          } catch (Exception e) {
            logger.warn("Error converting value to string for key: {}", key, e);
            stringMap.put(key, value.toString());
          }
        });
    return stringMap;
  }
}
