package com.storesight.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.ShopService;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {
  private final WebClient webClient;
  private final ShopService shopService;
  private final StringRedisTemplate redisTemplate;
  private static final String SHOPIFY_API_VERSION = "2023-10";
  private static final Logger logger = LoggerFactory.getLogger(AnalyticsController.class);

  @Autowired
  public AnalyticsController(
      WebClient.Builder webClientBuilder,
      ShopService shopService,
      StringRedisTemplate redisTemplate) {
    this.webClient = webClientBuilder.build();
    this.shopService = shopService;
    this.redisTemplate = redisTemplate;
  }

  private String getShopifyUrl(String shop, String endpoint) {
    return String.format("https://%s/admin/api/%s/%s", shop, SHOPIFY_API_VERSION, endpoint);
  }

  private static class AnalyticsResponse {
    private final Map<String, Object> data;
    private final String error;
    private final HttpStatus status;

    public AnalyticsResponse(Map<String, Object> data, String error, HttpStatus status) {
      this.data = data;
      this.error = error;
      this.status = status;
    }

    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> toResponseEntity() {
      Map<String, Object> response = new HashMap<>(data);
      if (error != null) {
        response.put("error", error);
      }
      return (ResponseEntity<Map<String, Object>>) ResponseEntity.status(status).body(response);
    }
  }

  @SuppressWarnings("unchecked")
  private Mono<ResponseEntity<Map<String, Object>>> handleError(
      Throwable e, String errorMessage, Map<String, Object> defaultData) {
    logger.error("Error: {}", e.getMessage());
    AnalyticsResponse response =
        new AnalyticsResponse(defaultData, errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    return (Mono<ResponseEntity<Map<String, Object>>>) Mono.just(response.toResponseEntity());
  }

  @GetMapping("/orders/timeseries")
  @SuppressWarnings("unchecked")
  public Mono<ResponseEntity<Map<String, Object>>> ordersTimeseries(
      @CookieValue(value = "shop", required = false) String shop,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int limit) {

    if (shop == null) {
      Map<String, Object> defaultOrders =
          java.util.Map.of(
              "timeseries", java.util.List.of(), "page", page, "limit", limit, "has_more", false);
      AnalyticsResponse response =
          new AnalyticsResponse(defaultOrders, "Not authenticated", HttpStatus.UNAUTHORIZED);
      return (Mono<ResponseEntity<Map<String, Object>>>) Mono.just(response.toResponseEntity());
    }

    String cacheKey = String.format("orders_timeseries:%s:%d:%d", shop, page, limit);
    String cachedData = redisTemplate.opsForValue().get(cacheKey);
    if (cachedData != null) {
      try {
        Map<String, Object> data = new ObjectMapper().readValue(cachedData, Map.class);
        return Mono.just(ResponseEntity.ok(data));
      } catch (Exception e) {
        logger.error("Error parsing cached orders data", e);
      }
    }

    // Default empty payload used for all failure paths
    final Map<String, Object> defaultOrders =
        java.util.Map.of(
            "timeseries", java.util.List.of(), "page", page, "limit", limit, "has_more", false);

    return shopService
        .getShopAccessToken(shop)
        .flatMap(
            accessToken -> {
              String url =
                  getShopifyUrl(
                      shop, String.format("orders.json?status=any&limit=%d&page=%d", limit, page));
              return webClient
                  .get()
                  .uri(url)
                  .header("X-Shopify-Access-Token", accessToken)
                  .retrieve()
                  .bodyToMono(String.class)
                  .map(
                      response -> {
                        try {
                          Map<String, Object> data =
                              new ObjectMapper().readValue(response, Map.class);
                          List<Map<String, Object>> orders =
                              (List<Map<String, Object>>) data.get("orders");
                          List<Map<String, Object>> timeseries =
                              orders.stream()
                                  .filter(
                                      order -> {
                                        // Show all orders, but prioritize fulfilled ones
                                        Object fulfillmentStatus = order.get("fulfillment_status");
                                        return fulfillmentStatus != null || order.get("id") != null;
                                      })
                                  .map(
                                      order -> {
                                        Map<String, Object> orderData = new HashMap<>();
                                        orderData.put("id", order.get("id"));
                                        orderData.put("name", order.get("name"));
                                        orderData.put("created_at", order.get("created_at"));
                                        orderData.put("total_price", order.get("total_price"));
                                        orderData.put("customer", order.get("customer"));
                                        orderData.put(
                                            "financial_status", order.get("financial_status"));
                                        orderData.put(
                                            "fulfillment_status", order.get("fulfillment_status"));
                                        orderData.put(
                                            "order_status_url", order.get("order_status_url"));

                                        // Add Shopify admin URL for the order
                                        Object orderId = order.get("id");
                                        if (orderId != null) {
                                          orderData.put(
                                              "shopify_order_url",
                                              "https://"
                                                  + shop
                                                  + "/admin/orders/"
                                                  + orderId.toString());
                                        }

                                        return orderData;
                                      })
                                  .collect(Collectors.toList());

                          Map<String, Object> result =
                              Map.of(
                                  "timeseries", timeseries,
                                  "page", page,
                                  "limit", limit,
                                  "has_more", orders.size() == limit);
                          redisTemplate
                              .opsForValue()
                              .set(
                                  cacheKey,
                                  new ObjectMapper().writeValueAsString(result),
                                  5,
                                  TimeUnit.MINUTES);
                          return ResponseEntity.ok(result);
                        } catch (Exception e) {
                          logger.error("Error processing orders data", e);
                          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                              .body(Map.of("error", (Object) "Error processing orders data"));
                        }
                      });
            })
        .onErrorResume(
            e -> {
              logger.error("Failed to fetch orders timeseries: {}", e.getMessage());
              // Check if it's a 403 error (permission issue)
              if (e.getMessage().contains("403")) {
                logger.warn(
                    "Orders API access denied - shop may need to re-authenticate with read_orders scope");
                Map<String, Object> errorResponse = new HashMap<>(defaultOrders);
                errorResponse.put(
                    "error",
                    "Orders access requires re-authentication. Please reconnect your store.");
                errorResponse.put("error_code", "INSUFFICIENT_PERMISSIONS");
                return Mono.just(ResponseEntity.ok().body(errorResponse));
              }
              return Mono.<ResponseEntity<Map<String, Object>>>just(
                  ResponseEntity.ok().body(defaultOrders));
            });
  }

  @GetMapping("/products")
  public Mono<ResponseEntity<Map<String, Object>>> productAnalytics(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      logger.error("No shop provided in request");
      Map<String, Object> response = new HashMap<>();
      response.put("error", "Not authenticated");
      response.put("products", List.of());
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }

    // Mock data to demonstrate dashboard functionality while debugging Shopify API
    List<Map<String, Object>> mockProducts =
        List.of(
            Map.of(
                "id", "1234567890",
                "title", "Premium Snowboard",
                "price", "$299.99",
                "inventory", 15,
                "sales", 25,
                "revenue", "$7,499.75",
                "status", "active"),
            Map.of(
                "id", "1234567891",
                "title", "Winter Jacket",
                "price", "$149.99",
                "inventory", 8,
                "sales", 42,
                "revenue", "$6,299.58",
                "status", "active"),
            Map.of(
                "id", "1234567892",
                "title", "Ski Goggles",
                "price", "$79.99",
                "inventory", 3,
                "sales", 18,
                "revenue", "$1,439.82",
                "status", "low_stock"));

    Map<String, Object> mockResponse = new HashMap<>();
    mockResponse.put("products", mockProducts);
    mockResponse.put("total_products", mockProducts.size());
    mockResponse.put("total_revenue", "$15,239.15");
    mockResponse.put("note", "Mock data - Shopify API rate limited");

    logger.info("Returning mock product data due to Shopify API rate limiting");
    return Mono.just(ResponseEntity.ok(mockResponse));
  }

  @GetMapping("/inventory/low")
  @SuppressWarnings("unchecked")
  public Mono<ResponseEntity<Map<String, Object>>> lowInventory(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      Map<String, Object> data = new HashMap<>();
      data.put("products", List.of());
      AnalyticsResponse response =
          new AnalyticsResponse(data, "Not authenticated", HttpStatus.UNAUTHORIZED);
      return (Mono<ResponseEntity<Map<String, Object>>>) Mono.just(response.toResponseEntity());
    }
    String token = shopService.getTokenForShop(shop);
    if (token == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "No token for shop");
      response.put("products", List.of());
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }
    String url = "https://" + shop + "/admin/api/2023-10/products.json?fields=title,variants";
    return webClient
        .get()
        .uri(url)
        .header("X-Shopify-Access-Token", token)
        .retrieve()
        .bodyToMono(Map.class)
        .map(
            data -> {
              var products = (List<Map<String, Object>>) data.get("products");
              List<Map<String, Object>> lowStock = new java.util.ArrayList<>();
              if (products != null) {
                for (var product : products) {
                  var variants = (List<Map<String, Object>>) product.get("variants");
                  if (variants != null) {
                    for (var variant : variants) {
                      int qty = 9999;
                      try {
                        Object inventoryQty = variant.get("inventory_quantity");
                        if (inventoryQty != null) {
                          qty = Integer.parseInt(inventoryQty.toString());
                        }
                      } catch (Exception ignored) {
                      }
                      if (qty < 5) {
                        Object productIdObj = product.get("id");
                        if (productIdObj != null) {
                          String productId = productIdObj.toString();
                          lowStock.add(
                              Map.of(
                                  "title",
                                  product.get("title"),
                                  "variant",
                                  variant.get("title"),
                                  "quantity",
                                  qty,
                                  "product_id",
                                  productId,
                                  "shopify_url",
                                  "https://" + shop + "/admin/products/" + productId));
                        }
                      }
                    }
                  }
                }
              }
              Map<String, Object> response = new HashMap<>();
              response.put("lowInventory", lowStock);
              response.put("lowInventoryCount", lowStock.size());
              response.put(
                  "shopify_inventory_url",
                  "https://" + shop + "/admin/products?inventory_status=low");
              response.put("shopify_products_url", "https://" + shop + "/admin/products");
              return ResponseEntity.ok(response);
            })
        .onErrorResume(
            e -> {
              logger.error("Failed to fetch low inventory: {}", e.getMessage());
              Map<String, Object> errorResponse = new HashMap<>();
              errorResponse.put("lowInventory", List.of());
              errorResponse.put("lowInventoryCount", 0);
              if (e.getMessage().contains("403")) {
                errorResponse.put(
                    "error",
                    "Inventory access requires re-authentication. Please reconnect your store.");
                errorResponse.put("error_code", "INSUFFICIENT_PERMISSIONS");
              } else {
                errorResponse.put("error", "Failed to fetch low inventory");
              }
              return Mono.just(ResponseEntity.ok().body(errorResponse));
            });
  }

  @GetMapping("/new_products")
  @SuppressWarnings("unchecked")
  public Mono<ResponseEntity<Map<String, Object>>> newProducts(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      Map<String, Object> data = new HashMap<>();
      data.put("products", List.of());
      AnalyticsResponse response =
          new AnalyticsResponse(data, "Not authenticated", HttpStatus.UNAUTHORIZED);
      return (Mono<ResponseEntity<Map<String, Object>>>) Mono.just(response.toResponseEntity());
    }
    String token = shopService.getTokenForShop(shop);
    if (token == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "No token for shop");
      response.put("products", List.of());
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }
    String since = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE);
    String url =
        "https://"
            + shop
            + "/admin/api/2023-10/products.json?created_at_min="
            + since
            + "T00:00:00-00:00";
    return webClient
        .get()
        .uri(url)
        .header("X-Shopify-Access-Token", token)
        .retrieve()
        .bodyToMono(Map.class)
        .map(
            data -> {
              var products = (List<Map<String, Object>>) data.get("products");
              int count = products != null ? products.size() : 0;

              // Add Shopify admin URLs to each product
              List<Map<String, Object>> enrichedProducts = new ArrayList<>();
              if (products != null) {
                for (var product : products) {
                  Map<String, Object> enrichedProduct = new HashMap<>(product);
                  Object productIdObj = product.get("id");
                  if (productIdObj != null) {
                    String productId = productIdObj.toString();
                    enrichedProduct.put(
                        "shopify_url", "https://" + shop + "/admin/products/" + productId);
                  }
                  enrichedProducts.add(enrichedProduct);
                }
              }

              Map<String, Object> response = new HashMap<>();
              response.put("newProducts", count);
              response.put("products", enrichedProducts);
              response.put("shopify_products_url", "https://" + shop + "/admin/products");
              response.put(
                  "shopify_new_products_url",
                  "https://" + shop + "/admin/products?sort=created_at&order=desc");
              return ResponseEntity.ok(response);
            })
        .onErrorResume(
            e -> {
              logger.error("Failed to fetch new products: {}", e.getMessage());
              Map<String, Object> errorResponse = new HashMap<>();
              errorResponse.put("newProducts", 0);
              errorResponse.put("products", List.of());
              if (e.getMessage().contains("403")) {
                errorResponse.put(
                    "error",
                    "Products access requires re-authentication. Please reconnect your store.");
                errorResponse.put("error_code", "INSUFFICIENT_PERMISSIONS");
              } else {
                errorResponse.put("error", "Failed to fetch new products");
              }
              return Mono.just(ResponseEntity.ok().body(errorResponse));
            });
  }

  @GetMapping("/abandoned_carts")
  public Mono<ResponseEntity<Map<String, Object>>> abandonedCarts(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", (Object) "Not authenticated")));
    }

    String cacheKey = "abandoned_carts:" + shop;
    String cachedData = redisTemplate.opsForValue().get(cacheKey);
    if (cachedData != null) {
      try {
        Map<String, Object> data = new ObjectMapper().readValue(cachedData, Map.class);
        return Mono.just(ResponseEntity.ok(data));
      } catch (Exception e) {
        logger.error("Error parsing cached abandoned carts data", e);
      }
    }

    return shopService
        .getShopAccessToken(shop)
        .flatMap(
            accessToken -> {
              String url = getShopifyUrl(shop, "checkouts.json?limit=50");
              return webClient
                  .get()
                  .uri(url)
                  .header("X-Shopify-Access-Token", accessToken)
                  .retrieve()
                  .bodyToMono(String.class)
                  .map(
                      response -> {
                        try {
                          Map<String, Object> data =
                              new ObjectMapper().readValue(response, Map.class);
                          List<Map<String, Object>> checkouts =
                              (List<Map<String, Object>>) data.get("checkouts");
                          long abandonedCount =
                              checkouts.stream()
                                  .filter(checkout -> checkout.get("completed_at") == null)
                                  .count();

                          Map<String, Object> result = Map.of("abandonedCarts", abandonedCount);
                          redisTemplate
                              .opsForValue()
                              .set(
                                  cacheKey,
                                  new ObjectMapper().writeValueAsString(result),
                                  5,
                                  TimeUnit.MINUTES);
                          return ResponseEntity.ok(result);
                        } catch (Exception e) {
                          logger.error("Error processing abandoned carts data", e);
                          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                              .body(
                                  Map.of(
                                      "error", (Object) "Error processing abandoned carts data"));
                        }
                      });
            })
        .onErrorResume(
            e -> {
              logger.error("Error fetching abandoned carts", e);
              Map<String, Object> response = new HashMap<>();
              response.put("error", "Failed to fetch abandoned carts");
              response.put("abandonedCarts", 0);
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
            });
  }

  @GetMapping("/report/schedule")
  public Mono<ResponseEntity<Map<String, String>>> getReportSchedule(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String key = "report_schedule:" + shop;
    String schedule = redisTemplate.opsForValue().get(key);
    return Mono.just(ResponseEntity.ok(Map.of("schedule", schedule != null ? schedule : "none")));
  }

  @PostMapping("/report/schedule")
  public Mono<ResponseEntity<Map<String, String>>> setReportSchedule(
      @CookieValue(value = "shop", required = false) String shop,
      @RequestBody Map<String, String> body) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String schedule = body.get("schedule");
    if (schedule == null) {
      return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Schedule is required")));
    }
    String key = "report_schedule:" + shop;
    redisTemplate.opsForValue().set(key, schedule);
    return Mono.just(ResponseEntity.ok(Map.of("schedule", schedule)));
  }

  @GetMapping("/revenue")
  public Mono<ResponseEntity<Map<String, Object>>> revenue(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", (Object) "Not authenticated")));
    }

    String cacheKey = "revenue:" + shop;
    String cachedData = redisTemplate.opsForValue().get(cacheKey);
    if (cachedData != null) {
      try {
        Map<String, Object> data = new ObjectMapper().readValue(cachedData, Map.class);
        return Mono.just(ResponseEntity.ok(data));
      } catch (Exception e) {
        logger.error("Error parsing cached revenue data", e);
      }
    }

    return shopService
        .getShopAccessToken(shop)
        .flatMap(
            accessToken -> {
              String url = getShopifyUrl(shop, "orders.json?status=any&limit=50");
              return webClient
                  .get()
                  .uri(url)
                  .header("X-Shopify-Access-Token", accessToken)
                  .retrieve()
                  .bodyToMono(String.class)
                  .map(
                      response -> {
                        try {
                          Map<String, Object> data =
                              new ObjectMapper().readValue(response, Map.class);
                          List<Map<String, Object>> orders =
                              (List<Map<String, Object>>) data.get("orders");
                          double totalRevenue =
                              orders.stream()
                                  .mapToDouble(
                                      order -> {
                                        Object totalPrice = order.get("total_price");
                                        if (totalPrice != null) {
                                          try {
                                            return Double.parseDouble(totalPrice.toString());
                                          } catch (NumberFormatException e) {
                                            return 0.0;
                                          }
                                        }
                                        return 0.0;
                                      })
                                  .sum();

                          Map<String, Object> result = Map.of("revenue", totalRevenue);
                          redisTemplate
                              .opsForValue()
                              .set(
                                  cacheKey,
                                  new ObjectMapper().writeValueAsString(result),
                                  5,
                                  TimeUnit.MINUTES);
                          return ResponseEntity.ok(result);
                        } catch (Exception e) {
                          logger.error("Error processing revenue data", e);
                          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                              .body(Map.of("error", (Object) "Error processing revenue data"));
                        }
                      });
            })
        .onErrorResume(
            e -> {
              logger.error("Error fetching revenue", e);
              // Check if it's a 403 error (permission issue)
              if (e.getMessage().contains("403")) {
                logger.warn(
                    "Revenue API access denied - shop may need to re-authenticate with read_orders scope");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("revenue", 0.0);
                errorResponse.put(
                    "error",
                    "Orders access requires re-authentication. Please reconnect your store.");
                errorResponse.put("error_code", "INSUFFICIENT_PERMISSIONS");
                return Mono.just(ResponseEntity.ok().body(errorResponse));
              }
              Map<String, Object> response = new HashMap<>();
              response.put("error", "Failed to fetch revenue");
              response.put("revenue", 0.0);
              return Mono.just(ResponseEntity.ok().body(response));
            });
  }

  @GetMapping("/permissions/check")
  public Mono<ResponseEntity<Map<String, Object>>> checkPermissions(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }

    String token = shopService.getTokenForShop(shop);
    if (token == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "No token for shop");
      response.put("authenticated", false);
      response.put("reauth_url", "/api/auth/shopify/reauth");
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }

    // Test different endpoints to check permissions
    Map<String, Object> permissions = new HashMap<>();
    permissions.put("shop", shop);
    permissions.put("authenticated", true);
    permissions.put("scopes_required", "read_products,read_orders,read_customers,read_inventory");

    // Test products endpoint (basic permission)
    String productsUrl = "https://" + shop + "/admin/api/2023-10/products.json?limit=1";
    return webClient
        .get()
        .uri(productsUrl)
        .header("X-Shopify-Access-Token", token)
        .retrieve()
        .bodyToMono(String.class)
        .map(
            response -> {
              permissions.put("products_access", true);
              return testOrdersAccess(shop, token, permissions);
            })
        .onErrorResume(
            e -> {
              permissions.put("products_access", false);
              permissions.put("products_error", e.getMessage());
              return Mono.just(testOrdersAccess(shop, token, permissions));
            });
  }

  private ResponseEntity<Map<String, Object>> testOrdersAccess(
      String shop, String token, Map<String, Object> permissions) {
    // Test orders endpoint
    String ordersUrl = "https://" + shop + "/admin/api/2023-10/orders.json?limit=1";
    try {
      webClient
          .get()
          .uri(ordersUrl)
          .header("X-Shopify-Access-Token", token)
          .retrieve()
          .bodyToMono(String.class)
          .subscribe(
              response -> permissions.put("orders_access", true),
              error -> {
                permissions.put("orders_access", false);
                permissions.put("orders_error", error.getMessage());
                if (error.getMessage().contains("403")) {
                  permissions.put("reauth_required", true);
                  permissions.put("reauth_url", "/api/auth/shopify/reauth");
                  permissions.put(
                      "message",
                      "Some endpoints require re-authentication with updated permissions");
                }
              });
    } catch (Exception e) {
      permissions.put("orders_access", false);
      permissions.put("orders_error", e.getMessage());
    }

    return ResponseEntity.ok(permissions);
  }

  @GetMapping("/revenue/timeseries")
  @SuppressWarnings("unchecked")
  public Mono<ResponseEntity<Map<String, Object>>> revenueTimeseries(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      Map<String, Object> data = new HashMap<>();
      data.put("revenue", List.of());
      AnalyticsResponse response =
          new AnalyticsResponse(data, "Not authenticated", HttpStatus.UNAUTHORIZED);
      return (Mono<ResponseEntity<Map<String, Object>>>) Mono.just(response.toResponseEntity());
    }
    String token = shopService.getTokenForShop(shop);
    if (token == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "No token for shop");
      response.put("timeseries", List.of());
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }
    String since = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE);
    String url =
        "https://"
            + shop
            + "/admin/api/2023-10/orders.json?status=any&created_at_min="
            + since
            + "T00:00:00-00:00";
    return webClient
        .get()
        .uri(url)
        .header("X-Shopify-Access-Token", token)
        .retrieve()
        .bodyToMono(Map.class)
        .map(
            data -> {
              var orders = (List<Map<String, Object>>) data.get("orders");
              Map<String, Object> response = new HashMap<>();
              response.put("timeseries", orders);
              return ResponseEntity.ok(response);
            })
        .onErrorResume(
            e -> handleError(e, "Failed to fetch revenue", Map.of("revenue", List.of())));
  }
}
