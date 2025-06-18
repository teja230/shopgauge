package com.storesight.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.ShopService;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
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
  private static final String SHOPIFY_API_VERSION = "2024-01";
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

  @GetMapping("/orders/timeseries")
  public Mono<ResponseEntity<Map<String, Object>>> ordersTimeseries(
      @CookieValue(value = "shop", required = false) String shop,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int limit) {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
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
                                  .map(
                                      order ->
                                          Map.of(
                                              "id", order.get("id"),
                                              "name", order.get("name"),
                                              "created_at", order.get("created_at"),
                                              "total_price", order.get("total_price"),
                                              "customer", order.get("customer"),
                                              "financial_status", order.get("financial_status"),
                                              "fulfillment_status", order.get("fulfillment_status"),
                                              "order_status_url", order.get("order_status_url")))
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
                          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
                        }
                      });
            })
        .onErrorResume(
            e -> {
              logger.error("Error fetching orders", e);
              Map<String, Object> response = new HashMap<>();
              response.put("error", "Failed to fetch orders");
              response.put("timeseries", List.of());
              response.put("page", page);
              response.put("limit", limit);
              response.put("has_more", false);
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
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

    logger.info("Fetching product analytics for shop: {}", shop);

    return shopService
        .getShopAccessToken(shop)
        .flatMap(
            accessToken -> {
              if (accessToken == null) {
                logger.error("No access token found for shop: {}", shop);
                return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
              }
              logger.info("Successfully retrieved access token for shop: {}", shop);

              // First get all products
              String productsUrl = getShopifyUrl(shop, "products.json?fields=id,title,variants");
              logger.info("Fetching products from URL: {}", productsUrl);

              return webClient
                  .get()
                  .uri(productsUrl)
                  .header("X-Shopify-Access-Token", accessToken)
                  .retrieve()
                  .bodyToMono(String.class)
                  .flatMap(
                      productsResponse -> {
                        try {
                          Map<String, Object> productsData =
                              new ObjectMapper().readValue(productsResponse, Map.class);
                          List<Map<String, Object>> products =
                              (List<Map<String, Object>>) productsData.get("products");
                          logger.info(
                              "Retrieved {} products from Shopify",
                              products != null ? products.size() : 0);

                          // Then get recent orders to calculate sales
                          String ordersUrl =
                              getShopifyUrl(
                                  shop, "orders.json?status=any&limit=250&fields=id,line_items");
                          logger.info("Fetching orders from URL: {}", ordersUrl);

                          return webClient
                              .get()
                              .uri(ordersUrl)
                              .header("X-Shopify-Access-Token", accessToken)
                              .retrieve()
                              .bodyToMono(String.class)
                              .map(
                                  ordersResponse -> {
                                    try {
                                      Map<String, Object> ordersData =
                                          new ObjectMapper().readValue(ordersResponse, Map.class);
                                      List<Map<String, Object>> orders =
                                          (List<Map<String, Object>>) ordersData.get("orders");
                                      logger.info(
                                          "Retrieved {} orders from Shopify",
                                          orders != null ? orders.size() : 0);

                                      // Calculate sales for each product
                                      Map<String, Map<String, Object>> productSales =
                                          new HashMap<>();

                                      if (orders != null) {
                                        for (Map<String, Object> order : orders) {
                                          List<Map<String, Object>> lineItems =
                                              (List<Map<String, Object>>) order.get("line_items");
                                          if (lineItems != null) {
                                            for (Map<String, Object> item : lineItems) {
                                              if (item.get("product_id") == null) continue;

                                              String productId = item.get("product_id").toString();
                                              int quantity = 0;
                                              double price = 0.0;

                                              try {
                                                quantity =
                                                    Integer.parseInt(
                                                        item.get("quantity").toString());
                                                price =
                                                    Double.parseDouble(
                                                        item.get("price").toString());
                                              } catch (NumberFormatException e) {
                                                logger.warn(
                                                    "Invalid number format for product {}: quantity={}, price={}",
                                                    productId,
                                                    item.get("quantity"),
                                                    item.get("price"));
                                                continue;
                                              }

                                              productSales.computeIfAbsent(
                                                  productId, k -> new HashMap<>());
                                              Map<String, Object> sales =
                                                  productSales.get(productId);

                                              int currentQty =
                                                  ((Number) sales.getOrDefault("quantity", 0))
                                                      .intValue();
                                              double currentTotal =
                                                  ((Number) sales.getOrDefault("total_price", 0.0))
                                                      .doubleValue();

                                              sales.put("quantity", currentQty + quantity);
                                              sales.put(
                                                  "total_price", currentTotal + (quantity * price));
                                            }
                                          }
                                        }
                                      }

                                      logger.info(
                                          "Calculated sales data for {} products",
                                          productSales.size());

                                      // Combine product info with sales data
                                      List<Map<String, Object>> enrichedProducts =
                                          products.stream()
                                              .map(
                                                  product -> {
                                                    String productId = product.get("id").toString();
                                                    Map<String, Object> sales =
                                                        productSales.getOrDefault(
                                                            productId,
                                                            Map.of(
                                                                "quantity", 0, "total_price", 0.0));

                                                    Map<String, Object> enriched =
                                                        new HashMap<>(product);
                                                    enriched.put("quantity", sales.get("quantity"));
                                                    enriched.put(
                                                        "total_price", sales.get("total_price"));
                                                    return enriched;
                                                  })
                                              .sorted(
                                                  (a, b) -> {
                                                    int aQty =
                                                        ((Number) a.get("quantity")).intValue();
                                                    int bQty =
                                                        ((Number) b.get("quantity")).intValue();
                                                    return bQty
                                                        - aQty; // Sort by quantity sold, descending
                                                  })
                                              .collect(Collectors.toList());

                                      logger.info(
                                          "Returning {} enriched products",
                                          enrichedProducts.size());

                                      Map<String, Object> response = new HashMap<>();
                                      response.put("products", enrichedProducts);
                                      return ResponseEntity.ok(response);
                                    } catch (Exception e) {
                                      logger.error(
                                          "Error processing orders data: {}", e.getMessage(), e);
                                      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                          .build();
                                    }
                                  });
                        } catch (Exception e) {
                          logger.error("Error processing products data: {}", e.getMessage(), e);
                          return Mono.just(
                              ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
                        }
                      });
            })
        .onErrorResume(
            e -> {
              logger.error("Error fetching product analytics: {}", e.getMessage(), e);
              Map<String, Object> response = new HashMap<>();
              response.put("error", "Failed to fetch product analytics");
              response.put("products", List.of());
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
            });
  }

  @GetMapping("/inventory/low")
  public Mono<ResponseEntity<Map<String, Object>>> lowInventory(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "Not authenticated");
      response.put("lowInventory", List.of());
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }
    String token = shopService.getTokenForShop(shop);
    if (token == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "No token for shop");
      response.put("lowInventory", List.of());
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
                        qty = Integer.parseInt(variant.get("inventory_quantity").toString());
                      } catch (Exception ignored) {
                      }
                      if (qty < 5) {
                        lowStock.add(
                            Map.of(
                                "title", product.get("title"),
                                "variant", variant.get("title"),
                                "quantity", qty));
                      }
                    }
                  }
                }
              }
              Map<String, Object> response = new HashMap<>();
              response.put("lowInventory", lowStock);
              return ResponseEntity.ok(response);
            })
        .onErrorResume(
            e -> {
              Map<String, Object> response = new HashMap<>();
              response.put("error", "Failed to fetch low inventory");
              response.put("lowInventory", List.of());
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
            });
  }

  @GetMapping("/new_products")
  public Mono<ResponseEntity<Map<String, Object>>> newProducts(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "Not authenticated");
      response.put("products", List.of());
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
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
              Map<String, Object> response = new HashMap<>();
              response.put("newProducts", count);
              response.put("products", products != null ? products : List.of());
              return ResponseEntity.ok(response);
            })
        .onErrorResume(
            e -> {
              Map<String, Object> response = new HashMap<>();
              response.put("error", "Failed to fetch new products");
              response.put("products", List.of());
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
            });
  }

  @GetMapping("/abandoned_carts")
  public Mono<ResponseEntity<Map<String, Object>>> abandonedCarts(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
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
                          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
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
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
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
                                      order ->
                                          Double.parseDouble(order.get("total_price").toString()))
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
                          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
                        }
                      });
            })
        .onErrorResume(
            e -> {
              logger.error("Error fetching revenue", e);
              Map<String, Object> response = new HashMap<>();
              response.put("error", "Failed to fetch revenue");
              response.put("revenue", 0.0);
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
            });
  }

  @GetMapping("/revenue/timeseries")
  public Mono<ResponseEntity<Map<String, Object>>> revenueTimeseries(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "Not authenticated");
      response.put("timeseries", List.of());
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
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
            e -> {
              Map<String, Object> response = new HashMap<>();
              response.put("error", "Failed to fetch revenue timeseries");
              response.put("timeseries", List.of());
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
            });
  }
}
