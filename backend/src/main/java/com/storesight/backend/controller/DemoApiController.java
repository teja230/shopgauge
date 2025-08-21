package com.storesight.backend.controller;

import com.storesight.backend.service.DemoModeService;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Demo API Controller
 * 
 * Provides demo data endpoints that don't require authentication
 * These endpoints serve realistic demo data for the demo mode experience
 */
@RestController
@RequestMapping("/api/demo")
public class DemoApiController {

  private static final Logger logger = LoggerFactory.getLogger(DemoApiController.class);

  @Autowired private DemoModeService demoModeService;

  /**
   * Get demo analytics insights
   */
  @GetMapping("/analytics/insights")
  public ResponseEntity<?> getDemoInsights() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo analytics insights");

    Map<String, Object> insights = new HashMap<>();
    insights.put("conversionRate", 2.50);
    insights.put("conversionRateDelta", 0.3);
    insights.put("topSellingProducts", Arrays.asList(
        Map.of("title", "Premium Wireless Headphones", "sales", 145, "delta", 23),
        Map.of("title", "Smart Fitness Tracker", "sales", 98, "delta", 15),
        Map.of("title", "Bluetooth Speaker", "sales", 76, "delta", 8)
    ));
    insights.put("abandonedCartCount", 12);
    insights.put("insightText", "Your conversion rate increased by 0.3% this week. " +
        "Premium Wireless Headphones are your top performer with 23 additional sales.");

    return ResponseEntity.ok(insights);
  }

  /**
   * Get demo products data
   */
  @GetMapping("/analytics/products")
  public ResponseEntity<?> getDemoProducts() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo products data");

    Map<String, Object> response = new HashMap<>();
    response.put("products", Arrays.asList(
        Map.of(
            "id", 1L,
            "title", "Premium Wireless Headphones",
            "handle", "premium-wireless-headphones",
            "vendor", "AudioTech",
            "productType", "Electronics",
            "status", "active",
            "totalSales", 145,
            "totalRevenue", 14500.0,
            "averagePrice", 100.0
        ),
        Map.of(
            "id", 2L,
            "title", "Smart Fitness Tracker",
            "handle", "smart-fitness-tracker",
            "vendor", "FitLife",
            "productType", "Wearables",
            "status", "active",
            "totalSales", 98,
            "totalRevenue", 7840.0,
            "averagePrice", 80.0
        ),
        Map.of(
            "id", 3L,
            "title", "Bluetooth Speaker",
            "handle", "bluetooth-speaker",
            "vendor", "SoundWave",
            "productType", "Electronics",
            "status", "active",
            "totalSales", 76,
            "totalRevenue", 4560.0,
            "averagePrice", 60.0
        )
    ));

    return ResponseEntity.ok(response);
  }

  /**
   * Get demo orders data
   */
  @GetMapping("/analytics/orders")
  public ResponseEntity<?> getDemoOrders() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo orders data");

    Map<String, Object> response = new HashMap<>();
    response.put("orders", Arrays.asList(
        Map.of(
            "id", 1001L,
            "orderNumber", "DM-1001",
            "customerEmail", "demo.customer1@example.com",
            "totalPrice", 180.0,
            "lineItems", Arrays.asList(
                Map.of("title", "Premium Wireless Headphones", "quantity", 1, "price", 100.0),
                Map.of("title", "Smart Fitness Tracker", "quantity", 1, "price", 80.0)
            ),
            "createdAt", "2024-08-20T10:30:00Z",
            "financialStatus", "paid",
            "fulfillmentStatus", "fulfilled"
        ),
        Map.of(
            "id", 1002L,
            "orderNumber", "DM-1002",
            "customerEmail", "demo.customer2@example.com",
            "totalPrice", 120.0,
            "lineItems", Arrays.asList(
                Map.of("title", "Bluetooth Speaker", "quantity", 2, "price", 60.0)
            ),
            "createdAt", "2024-08-20T14:15:00Z",
            "financialStatus", "paid",
            "fulfillmentStatus", "pending"
        )
    ));
    
    // Add timeseries data for orders chart
    response.put("timeseries", Arrays.asList(
        Map.of("date", "2024-08-01", "orders", 12, "revenue", 850.0),
        Map.of("date", "2024-08-02", "orders", 14, "revenue", 920.0),
        Map.of("date", "2024-08-03", "orders", 11, "revenue", 780.0),
        Map.of("date", "2024-08-04", "orders", 16, "revenue", 1150.0),
        Map.of("date", "2024-08-05", "orders", 15, "revenue", 1050.0),
        Map.of("date", "2024-08-06", "orders", 13, "revenue", 890.0),
        Map.of("date", "2024-08-07", "orders", 18, "revenue", 1200.0),
        Map.of("date", "2024-08-08", "orders", 14, "revenue", 950.0),
        Map.of("date", "2024-08-09", "orders", 16, "revenue", 1080.0),
        Map.of("date", "2024-08-10", "orders", 13, "revenue", 940.0),
        Map.of("date", "2024-08-11", "orders", 17, "revenue", 1150.0),
        Map.of("date", "2024-08-12", "orders", 19, "revenue", 1300.0),
        Map.of("date", "2024-08-13", "orders", 16, "revenue", 1100.0),
        Map.of("date", "2024-08-14", "orders", 14, "revenue", 980.0),
        Map.of("date", "2024-08-15", "orders", 18, "revenue", 1250.0),
        Map.of("date", "2024-08-16", "orders", 17, "revenue", 1180.0),
        Map.of("date", "2024-08-17", "orders", 15, "revenue", 1050.0),
        Map.of("date", "2024-08-18", "orders", 20, "revenue", 1400.0),
        Map.of("date", "2024-08-19", "orders", 19, "revenue", 1350.0),
        Map.of("date", "2024-08-20", "orders", 21, "revenue", 1450.0)
    ));

    return ResponseEntity.ok(response);
  }

  /**
   * Get demo revenue metrics
   */
  @GetMapping("/analytics/revenue")
  public ResponseEntity<?> getDemoRevenue() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo revenue data");

    Map<String, Object> response = new HashMap<>();
    response.put("totalRevenue", 26900.0);
    response.put("todayRevenue", 540.0);
    response.put("conversionRate", 2.50);
    response.put("averageOrderValue", 89.67);
    response.put("totalOrders", 300);
    response.put("monthlyGrowth", 12.5);
    
    // Add timeseries data for revenue chart
    response.put("timeseries", Arrays.asList(
        Map.of("date", "2024-08-01", "revenue", 850.0, "orders", 12),
        Map.of("date", "2024-08-02", "revenue", 920.0, "orders", 14),
        Map.of("date", "2024-08-03", "revenue", 780.0, "orders", 11),
        Map.of("date", "2024-08-04", "revenue", 1150.0, "orders", 16),
        Map.of("date", "2024-08-05", "revenue", 1050.0, "orders", 15),
        Map.of("date", "2024-08-06", "revenue", 890.0, "orders", 13),
        Map.of("date", "2024-08-07", "revenue", 1200.0, "orders", 18),
        Map.of("date", "2024-08-08", "revenue", 950.0, "orders", 14),
        Map.of("date", "2024-08-09", "revenue", 1080.0, "orders", 16),
        Map.of("date", "2024-08-10", "revenue", 940.0, "orders", 13),
        Map.of("date", "2024-08-11", "revenue", 1150.0, "orders", 17),
        Map.of("date", "2024-08-12", "revenue", 1300.0, "orders", 19),
        Map.of("date", "2024-08-13", "revenue", 1100.0, "orders", 16),
        Map.of("date", "2024-08-14", "revenue", 980.0, "orders", 14),
        Map.of("date", "2024-08-15", "revenue", 1250.0, "orders", 18),
        Map.of("date", "2024-08-16", "revenue", 1180.0, "orders", 17),
        Map.of("date", "2024-08-17", "revenue", 1050.0, "orders", 15),
        Map.of("date", "2024-08-18", "revenue", 1400.0, "orders", 20),
        Map.of("date", "2024-08-19", "revenue", 1350.0, "orders", 19),
        Map.of("date", "2024-08-20", "revenue", 1450.0, "orders", 21)
    ));

    return ResponseEntity.ok(response);
  }

  /**
   * Get demo inventory data
   */
  @GetMapping("/analytics/inventory")
  public ResponseEntity<?> getDemoInventory() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo inventory data");

    Map<String, Object> response = new HashMap<>();
    response.put("lowStockItems", Arrays.asList(
        Map.of("title", "Premium Wireless Headphones", "currentStock", 5, "threshold", 10),
        Map.of("title", "Smart Fitness Tracker", "currentStock", 3, "threshold", 8)
    ));
    response.put("outOfStockCount", 2);
    response.put("lowStockCount", 2);
    response.put("totalProducts", 25);

    return ResponseEntity.ok(response);
  }
}
