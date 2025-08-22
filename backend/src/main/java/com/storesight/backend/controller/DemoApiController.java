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
 * <p>Provides demo data endpoints that don't require authentication These endpoints serve realistic
 * demo data for the demo mode experience
 */
@RestController
@RequestMapping("/api/demo")
public class DemoApiController {

  private static final Logger logger = LoggerFactory.getLogger(DemoApiController.class);

  @Autowired private DemoModeService demoModeService;

  /** Validate demo session */
  @GetMapping("/validate")
  public ResponseEntity<?> validateDemoSession() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Validating demo session");

    Map<String, Object> response = new HashMap<>();
    response.put("isDemo", true);
    response.put("isValid", true);
    response.put("shop", "demo-shopgauge.myshopify.com");
    response.put("message", "Demo session is valid");

    return ResponseEntity.ok(response);
  }

  /** Get demo analytics insights */
  @GetMapping("/analytics/insights")
  public ResponseEntity<?> getDemoInsights() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo analytics insights");

    Map<String, Object> insights = new HashMap<>();
    insights.put("conversionRate", 2.50);
    insights.put("conversionRateDelta", 0.3);
    insights.put(
        "topSellingProducts",
        Arrays.asList(
            Map.of("title", "Premium Wireless Headphones", "sales", 145, "delta", 23),
            Map.of("title", "Smart Fitness Tracker", "sales", 98, "delta", 15),
            Map.of("title", "Bluetooth Speaker", "sales", 76, "delta", 8)));
    insights.put("abandonedCartCount", 12);
    insights.put(
        "insightText",
        "Your conversion rate increased by 0.3% this week. "
            + "Premium Wireless Headphones are your top performer with 23 additional sales.");

    return ResponseEntity.ok(insights);
  }

  /** Get demo products data */
  @GetMapping("/analytics/products")
  public ResponseEntity<?> getDemoProducts() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo products data");

    Map<String, Object> response = new HashMap<>();
    response.put("total_products", 3);
    response.put("shopify_products_url", "https://demo-shopgauge.myshopify.com/admin/products");
    response.put("note", "Demo data with realistic sample products");
    response.put("total_revenue", "$26,900");
    response.put(
        "products",
        Arrays.asList(
            Map.of(
                "id", "demo-001",
                "title", "Premium Wireless Headphones",
                "handle", "premium-wireless-headphones",
                "shopify_url", "https://demo-shopgauge.myshopify.com/admin/products/demo-001",
                "price", "$149.95",
                "inventory", 25,
                "sales", "145 units",
                "revenue", "$21,743",
                "status", "active"),
            Map.of(
                "id", "demo-002",
                "title", "Smart Fitness Tracker",
                "handle", "smart-fitness-tracker",
                "shopify_url", "https://demo-shopgauge.myshopify.com/admin/products/demo-002",
                "price", "$89.99",
                "inventory", 18,
                "sales", "98 units",
                "revenue", "$8,819",
                "status", "active"),
            Map.of(
                "id", "demo-003",
                "title", "Bluetooth Speaker",
                "handle", "bluetooth-speaker",
                "shopify_url", "https://demo-shopgauge.myshopify.com/admin/products/demo-003",
                "price", "$79.95",
                "inventory", 12,
                "sales", "76 units",
                "revenue", "$6,076",
                "status", "active")));

    return ResponseEntity.ok(response);
  }

  /** Get demo orders data */
  @GetMapping("/analytics/orders")
  public ResponseEntity<?> getDemoOrders() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo orders data");

    Map<String, Object> response = new HashMap<>();
    response.put(
        "orders",
        Arrays.asList(
            Map.of(
                "id", "Temporary-1",
                "order_number", "#DM-1001", 
                "total_price", "$180.00",
                "created_at", "2024-08-20T10:30:00Z",
                "financial_status", "paid",
                "fulfillment_status", "fulfilled",
                "customer", Map.of(
                    "first_name", "John",
                    "last_name", "Demo",
                    "email", "demo.customer1@example.com"
                )),
            Map.of(
                "id", "Temporary-2",
                "order_number", "#DM-1002",
                "total_price", "$120.00", 
                "created_at", "2024-08-20T14:15:00Z",
                "financial_status", "paid",
                "fulfillment_status", "pending",
                "customer", Map.of(
                    "first_name", "Jane",
                    "last_name", "Demo",
                    "email", "demo.customer2@example.com"
                ))));

    // Add timeseries data for orders chart - matching real store format
    response.put(
        "timeseries",
        Arrays.asList(
            Map.of("total_price", 850.0, "created_at", "2024-08-01"),
            Map.of("total_price", 920.0, "created_at", "2024-08-02"),
            Map.of("total_price", 780.0, "created_at", "2024-08-03"),
            Map.of("total_price", 1150.0, "created_at", "2024-08-04"),
            Map.of("total_price", 1050.0, "created_at", "2024-08-05"),
            Map.of("total_price", 890.0, "created_at", "2024-08-06"),
            Map.of("total_price", 1200.0, "created_at", "2024-08-07"),
            Map.of("total_price", 950.0, "created_at", "2024-08-08"),
            Map.of("total_price", 1080.0, "created_at", "2024-08-09"),
            Map.of("total_price", 940.0, "created_at", "2024-08-10"),
            Map.of("total_price", 1150.0, "created_at", "2024-08-11"),
            Map.of("total_price", 1300.0, "created_at", "2024-08-12"),
            Map.of("total_price", 1100.0, "created_at", "2024-08-13"),
            Map.of("total_price", 980.0, "created_at", "2024-08-14"),
            Map.of("total_price", 1250.0, "created_at", "2024-08-15"),
            Map.of("total_price", 1180.0, "created_at", "2024-08-16"),
            Map.of("total_price", 1050.0, "created_at", "2024-08-17"),
            Map.of("total_price", 1400.0, "created_at", "2024-08-18"),
            Map.of("total_price", 1350.0, "created_at", "2024-08-19"),
            Map.of("total_price", 1450.0, "created_at", "2024-08-20")));

    return ResponseEntity.ok(response);
  }

  /** Get demo revenue metrics */
  @GetMapping("/analytics/revenue")
  public ResponseEntity<?> getDemoRevenue() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo revenue data");

    Map<String, Object> response = new HashMap<>();
    response.put("recentRevenue", 2150.0);
    response.put("orders_count", 16);
    response.put("revenue", 26900.0);
    response.put("recentOrders", 8);
    response.put("recentConversionRate", 2.85);
    response.put("totalRevenue", 26900.0);
    response.put("period_days", 60);

    // Add timeseries data for revenue chart - matching real store format
    response.put(
        "timeseries",
        Arrays.asList(
            Map.of("total_price", 850.0, "created_at", "2024-08-01"),
            Map.of("total_price", 920.0, "created_at", "2024-08-02"),
            Map.of("total_price", 780.0, "created_at", "2024-08-03"),
            Map.of("total_price", 1150.0, "created_at", "2024-08-04"),
            Map.of("total_price", 1050.0, "created_at", "2024-08-05"),
            Map.of("total_price", 890.0, "created_at", "2024-08-06"),
            Map.of("total_price", 1200.0, "created_at", "2024-08-07"),
            Map.of("total_price", 950.0, "created_at", "2024-08-08"),
            Map.of("total_price", 1080.0, "created_at", "2024-08-09"),
            Map.of("total_price", 940.0, "created_at", "2024-08-10"),
            Map.of("total_price", 1150.0, "created_at", "2024-08-11"),
            Map.of("total_price", 1300.0, "created_at", "2024-08-12"),
            Map.of("total_price", 1100.0, "created_at", "2024-08-13"),
            Map.of("total_price", 980.0, "created_at", "2024-08-14"),
            Map.of("total_price", 1250.0, "created_at", "2024-08-15"),
            Map.of("total_price", 1180.0, "created_at", "2024-08-16"),
            Map.of("total_price", 1050.0, "created_at", "2024-08-17"),
            Map.of("total_price", 1400.0, "created_at", "2024-08-18"),
            Map.of("total_price", 1350.0, "created_at", "2024-08-19"),
            Map.of("total_price", 1450.0, "created_at", "2024-08-20")));

    return ResponseEntity.ok(response);
  }

  /** Get demo inventory data */
  @GetMapping("/analytics/inventory")
  public ResponseEntity<?> getDemoInventory() {
    if (!demoModeService.isDemoModeEnabled()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Demo mode is not enabled"));
    }

    logger.info("Serving demo inventory data");

    Map<String, Object> response = new HashMap<>();
    response.put(
        "lowStockItems",
        Arrays.asList(
            Map.of("title", "Premium Wireless Headphones", "currentStock", 5, "threshold", 10),
            Map.of("title", "Smart Fitness Tracker", "currentStock", 3, "threshold", 8)));
    response.put("outOfStockCount", 2);
    response.put("lowStockCount", 2);
    response.put("totalProducts", 25);

    return ResponseEntity.ok(response);
  }
}
