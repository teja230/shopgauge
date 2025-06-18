package com.storesight.backend.controller;

import com.storesight.backend.service.NotificationService;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/auth/shopify")
public class ShopifyAuthController {
  private static final Logger log = LoggerFactory.getLogger(ShopifyAuthController.class);

  @Value("${shopify.api_key:YOUR_SHOPIFY_API_KEY}")
  private String shopifyApiKey;

  @Value("${shopify.api_secret:YOUR_SHOPIFY_API_SECRET}")
  private String shopifyApiSecret;

  @Value("${shopify.scopes:read_products,read_orders}")
  private String shopifyScopes;

  @Value("${shopify.redirect_uri:http://localhost:8080/api/auth/shopify/callback}")
  private String shopifyRedirectUri;

  private final WebClient webClient = WebClient.create();

  @Autowired private StringRedisTemplate redisTemplate;
  @Autowired private NotificationService notificationService;

  @GetMapping
  public Mono<Void> root(ServerHttpResponse response) {
    log.info("Root endpoint accessed - Redirecting to frontend");
    response.setStatusCode(HttpStatus.FOUND);
    response.getHeaders().set(HttpHeaders.LOCATION, "http://localhost:5173");
    return response.setComplete();
  }

  @GetMapping("/login")
  public Mono<Void> login(
      @RequestParam(value = "shop", required = false) String shop, ServerHttpResponse response) {
    // Log the received shop parameter
    log.info("Login attempt - Received shop parameter: {}", shop);

    if (shop == null || shop.isEmpty()) {
      log.warn("Login failed - Missing shop parameter");
      response.setStatusCode(HttpStatus.BAD_REQUEST);
      return response.writeWith(
          Mono.just(
              response
                  .bufferFactory()
                  .wrap(
                      "Please provide your Shopify store domain (e.g. mystore.myshopify.com)"
                          .getBytes())));
    }

    // Validate shop domain format
    if (!shop.endsWith(".myshopify.com")) {
      log.warn("Login failed - Invalid shop domain format: {}", shop);
      response.setStatusCode(HttpStatus.BAD_REQUEST);
      return response.writeWith(
          Mono.just(
              response
                  .bufferFactory()
                  .wrap(
                      "Invalid shop domain. Please enter a valid Shopify domain (e.g. mystore.myshopify.com)"
                          .getBytes())));
    }

    try {
      String redirectUrl =
          "https://"
              + shop
              + "/admin/oauth/authorize?"
              + "client_id="
              + shopifyApiKey
              + "&scope="
              + URLEncoder.encode(shopifyScopes, StandardCharsets.UTF_8)
              + "&redirect_uri="
              + URLEncoder.encode(shopifyRedirectUri, StandardCharsets.UTF_8)
              + "&state=nonce&grant_options[]=";

      log.info("Login successful - Redirecting to: {}", redirectUrl);
      response.setStatusCode(HttpStatus.FOUND);
      response.getHeaders().set(HttpHeaders.LOCATION, redirectUrl);
      return response.setComplete();
    } catch (Exception e) {
      log.error("Login failed - Error constructing redirect URL: {}", e.getMessage(), e);
      response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
      return response.writeWith(
          Mono.just(
              response
                  .bufferFactory()
                  .wrap(
                      "An error occurred while processing your request. Please try again."
                          .getBytes())));
    }
  }

  @GetMapping("/callback")
  @SuppressWarnings("unchecked")
  public Mono<Void> callback(
      @RequestParam(value = "code", required = false) String code,
      @RequestParam(value = "hmac", required = false) String hmac,
      @RequestParam(value = "shop", required = false) String shop,
      @RequestParam(value = "state", required = false) String state,
      @RequestParam(value = "timestamp", required = false) String timestamp,
      ServerHttpResponse response) {

    // Log all received parameters
    log.info(
        "Callback received with parameters: code={}, hmac={}, shop={}, state={}, timestamp={}",
        code != null ? "present" : "missing",
        hmac != null ? "present" : "missing",
        shop,
        state,
        timestamp);

    // Check for missing parameters
    if (code == null || hmac == null || shop == null || state == null || timestamp == null) {
      StringBuilder errorMsg = new StringBuilder("Missing required parameters: ");
      if (code == null) errorMsg.append("code ");
      if (hmac == null) errorMsg.append("hmac ");
      if (shop == null) errorMsg.append("shop ");
      if (state == null) errorMsg.append("state ");
      if (timestamp == null) errorMsg.append("timestamp ");

      log.warn("Callback failed - {}", errorMsg.toString());
      response.setStatusCode(HttpStatus.BAD_REQUEST);
      return response.writeWith(
          Mono.just(
              response
                  .bufferFactory()
                  .wrap(("Authentication failed: " + errorMsg.toString()).getBytes())));
    }

    // Validate HMAC
    Map<String, String> params = new TreeMap<>();
    params.put("code", code);
    params.put("shop", shop);
    params.put("state", state);
    params.put("timestamp", timestamp);

    String message =
        params.entrySet().stream()
            .map(e -> e.getKey() + "=" + e.getValue())
            .collect(Collectors.joining("&"));

    log.debug("HMAC validation - Message string: {}", message);

    String calcHmac;
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(shopifyApiSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      calcHmac =
          Base64.getEncoder().encodeToString(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
      log.debug("HMAC validation - Calculated HMAC: {}", calcHmac);
      log.debug("HMAC validation - Received HMAC: {}", hmac);
    } catch (Exception e) {
      log.error("HMAC validation failed - Error: {}", e.getMessage(), e);
      response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
      return response.writeWith(
          Mono.just(
              response
                  .bufferFactory()
                  .wrap(
                      "An error occurred while validating the request. Please try again."
                          .getBytes())));
    }

    if (!hmac.equals(calcHmac)) {
      log.warn("HMAC validation failed - HMAC mismatch");
      response.setStatusCode(HttpStatus.UNAUTHORIZED);
      return response.writeWith(
          Mono.just(
              response
                  .bufferFactory()
                  .wrap("Authentication failed: Invalid request signature".getBytes())));
    }

    // Exchange code for access token
    String tokenUrl = "https://" + shop + "/admin/oauth/access_token";
    log.info("Exchanging code for access token at: {}", tokenUrl);

    return webClient
        .post()
        .uri(tokenUrl)
        .bodyValue(
            Map.of(
                "client_id", shopifyApiKey,
                "client_secret", shopifyApiSecret,
                "code", code))
        .retrieve()
        .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
        .flatMap(
            body -> {
              String accessToken = (String) body.get("access_token");
              if (accessToken != null) {
                log.info("Access token obtained successfully for shop: {}", shop);
                storeToken(shop, accessToken);
                response
                    .getHeaders()
                    .add(
                        HttpHeaders.SET_COOKIE,
                        "shop=" + shop + "; Path=/; HttpOnly; SameSite=Lax");
                response.setStatusCode(HttpStatus.FOUND);
                response.getHeaders().set(HttpHeaders.LOCATION, "http://localhost:5173/dashboard");
              } else {
                log.warn("Failed to obtain access token for shop: {}", shop);
                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                return response.writeWith(
                    Mono.just(
                        response
                            .bufferFactory()
                            .wrap("Failed to obtain access token. Please try again.".getBytes())));
              }
              return response.setComplete();
            })
        .onErrorResume(
            e -> {
              log.error("Error exchanging code for token: {}", e.getMessage(), e);
              response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
              return response.writeWith(
                  Mono.just(
                      response
                          .bufferFactory()
                          .wrap(
                              "An error occurred while authenticating. Please try again."
                                  .getBytes())));
            });
  }

  @GetMapping("/me")
  public ResponseEntity<String> me(@CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Not authenticated");
    }
    return ResponseEntity.ok(shop);
  }

  @GetMapping("/profile")
  @SuppressWarnings("unchecked")
  public Mono<ResponseEntity<Map<String, Object>>> profile(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "No token for shop")));
    }
    // Fetch real shop info from Shopify API
    return webClient
        .get()
        .uri("https://" + shop + "/admin/api/2023-10/shop.json")
        .header("X-Shopify-Access-Token", token)
        .retrieve()
        .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
        .map(
            shopData -> {
              Map<String, Object> shopInfo = (Map<String, Object>) shopData.get("shop");
              return ResponseEntity.ok(
                  Map.of(
                      "shop", shopInfo.get("myshopify_domain"),
                      "email", shopInfo.get("email"),
                      "plan", shopInfo.get("plan_display_name"),
                      "shop_name", shopInfo.get("name")));
            })
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to fetch shop info"))));
  }

  @PostMapping("/profile/disconnect")
  public Mono<ResponseEntity<Void>> disconnect(
      @CookieValue(value = "shop", required = false) String shop,
      ServerHttpResponse response,
      ServerWebExchange exchange) {
    if (shop != null) {
      removeToken(shop);
      response
          .getHeaders()
          .add(
              HttpHeaders.SET_COOKIE,
              "shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; SameSite=Lax");
    }
    return Mono.just(ResponseEntity.ok().build());
  }

  @SuppressWarnings("unchecked")
  @GetMapping("/analytics/revenue")
  public Mono<ResponseEntity<Map<String, Object>>> revenue(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "No token for shop")));
    }
    String since = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE);
    String url =
        "https://"
            + shop
            + "/admin/api/2023-10/orders.json?status=any&fields=total_price,created_at&created_at_min="
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
              var orders = (java.util.List<Map<String, Object>>) data.get("orders");
              double revenue = 0;
              for (var order : orders) {
                try {
                  revenue += Double.parseDouble(order.get("total_price").toString());
                } catch (Exception ignored) {
                }
              }
              return (ResponseEntity<Map<String, Object>>)
                  (ResponseEntity<?>)
                      ResponseEntity.ok(Map.of("revenue", revenue, "orderCount", orders.size()));
            })
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to fetch revenue"))));
  }

  @SuppressWarnings("unchecked")
  @GetMapping("/analytics/orders")
  public Mono<ResponseEntity<Map<String, Object>>> orders(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "No token for shop")));
    }
    String since = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE);
    String url =
        "https://"
            + shop
            + "/admin/api/2023-10/orders.json?status=any&fields=id,created_at&created_at_min="
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
              var orders = (java.util.List<Map<String, Object>>) data.get("orders");
              return (ResponseEntity<Map<String, Object>>)
                  (ResponseEntity<?>)
                      ResponseEntity.ok(Map.of("orderCount", orders.size(), "orders", orders));
            })
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to fetch orders"))));
  }

  @GetMapping("/analytics/revenue/timeseries")
  public Mono<ResponseEntity<Map<String, Object>>> revenueTimeseries(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "No token for shop")));
    }
    String since = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE);
    String url =
        "https://"
            + shop
            + "/admin/api/2023-10/orders.json?status=any&fields=total_price,created_at&created_at_min="
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
              var orders = (java.util.List<Map<String, Object>>) data.get("orders");
              java.util.Map<String, Double> revenueByDay = new java.util.HashMap<>();
              java.util.Map<String, Integer> countByDay = new java.util.HashMap<>();
              for (var order : orders) {
                String created = order.get("created_at").toString().substring(0, 10);
                double price = 0;
                try {
                  price = Double.parseDouble(order.get("total_price").toString());
                } catch (Exception ignored) {
                }
                revenueByDay.put(created, revenueByDay.getOrDefault(created, 0.0) + price);
                countByDay.put(created, countByDay.getOrDefault(created, 0) + 1);
              }
              java.util.List<Map<String, Object>> timeseries = new java.util.ArrayList<>();
              for (int i = 0; i < 30; i++) {
                String date = LocalDate.now().minusDays(29 - i).format(DateTimeFormatter.ISO_DATE);
                timeseries.add(
                    Map.of(
                        "date", date,
                        "revenue", revenueByDay.getOrDefault(date, 0.0),
                        "orderCount", countByDay.getOrDefault(date, 0)));
              }
              return (ResponseEntity<Map<String, Object>>)
                  (ResponseEntity<?>) ResponseEntity.ok(Map.of("timeseries", timeseries));
            })
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to fetch timeseries"))));
  }

  @GetMapping("/analytics/orders/timeseries")
  public Mono<ResponseEntity<Map<String, Object>>> ordersTimeseries(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "No token for shop")));
    }
    String since = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE);
    String url =
        "https://"
            + shop
            + "/admin/api/2023-10/orders.json?status=any&fields=created_at&created_at_min="
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
              var orders = (java.util.List<Map<String, Object>>) data.get("orders");
              java.util.Map<String, Integer> countByDay = new java.util.HashMap<>();
              for (var order : orders) {
                String created = order.get("created_at").toString().substring(0, 10);
                countByDay.put(created, countByDay.getOrDefault(created, 0) + 1);
              }
              java.util.List<Map<String, Object>> timeseries = new java.util.ArrayList<>();
              for (int i = 0; i < 30; i++) {
                String date = LocalDate.now().minusDays(29 - i).format(DateTimeFormatter.ISO_DATE);
                timeseries.add(
                    Map.of("date", date, "orderCount", countByDay.getOrDefault(date, 0)));
              }
              return (ResponseEntity<Map<String, Object>>)
                  (ResponseEntity<?>) ResponseEntity.ok(Map.of("timeseries", timeseries));
            })
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to fetch timeseries"))));
  }

  @GetMapping("/notifications/settings")
  public Mono<ResponseEntity<Map<String, Object>>> getNotificationSettings(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String key = "notif_settings:" + shop;
    String json = redisTemplate.opsForValue().get(key);
    Map<String, Object> settings = Map.of();
    if (json != null) {
      try {
        settings = new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, Map.class);
      } catch (Exception e) {
        return Mono.just(
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to parse notification settings")));
      }
    }
    return Mono.just(ResponseEntity.ok(settings));
  }

  @PostMapping("/notifications/settings")
  public Mono<ResponseEntity<Void>> setNotificationSettings(
      @CookieValue(value = "shop", required = false) String shop,
      @RequestBody Map<String, Object> settings)
      throws Exception {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    String key = "notif_settings:" + shop;
    String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(settings);
    redisTemplate.opsForValue().set(key, json);
    return Mono.just(ResponseEntity.ok().build());
  }

  @PostMapping("/notifications/test")
  public Mono<ResponseEntity<Void>> testNotification(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    notificationService.sendEmailAlert(
        "demo@storesight.app", "Test Notification", "This is a test alert from StoreSight.");
    return Mono.just(ResponseEntity.ok().build());
  }

  @PostMapping("/notifications/test/slack")
  public Mono<ResponseEntity<Void>> testSlackNotification(
      @CookieValue(value = "shop", required = false) String shop) throws Exception {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    String key = "notif_settings:" + shop;
    String json = redisTemplate.opsForValue().get(key);
    if (json != null) {
      var settings = new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, Map.class);
      String slack = (String) settings.get("slack");
      notificationService.sendSlackAlert(
          slack, "This is a test Slack notification from StoreSight.");
    }
    return Mono.just(ResponseEntity.ok().build());
  }

  @PostMapping("/notifications/test/sms")
  public Mono<ResponseEntity<Void>> testSmsNotification(
      @CookieValue(value = "shop", required = false) String shop) throws Exception {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    String key = "notif_settings:" + shop;
    String json = redisTemplate.opsForValue().get(key);
    if (json != null) {
      var settings = new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, Map.class);
      String sms = (String) settings.get("sms");
      notificationService.sendSmsAlert(sms, "This is a test SMS notification from StoreSight.");
    }
    return Mono.just(ResponseEntity.ok().build());
  }

  @GetMapping("/analytics/products")
  public Mono<ResponseEntity<Map<String, Object>>> productAnalytics(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "No token for shop")));
    }
    String since = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE);
    String url =
        "https://"
            + shop
            + "/admin/api/2023-10/orders.json?status=any&fields=line_items,created_at&created_at_min="
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
              var orders = (java.util.List<Map<String, Object>>) data.get("orders");
              java.util.Map<String, Integer> productSales = new java.util.HashMap<>();
              for (var order : orders) {
                var items = (java.util.List<Map<String, Object>>) order.get("line_items");
                for (var item : items) {
                  String title = item.get("title").toString();
                  int qty = 1;
                  try {
                    qty = Integer.parseInt(item.get("quantity").toString());
                  } catch (Exception ignored) {
                  }
                  productSales.put(title, productSales.getOrDefault(title, 0) + qty);
                }
              }
              var topProducts =
                  productSales.entrySet().stream()
                      .sorted((a, b) -> b.getValue() - a.getValue())
                      .limit(10)
                      .map(e -> Map.of("title", e.getKey(), "quantity", e.getValue()))
                      .toList();
              return (ResponseEntity<Map<String, Object>>)
                  (ResponseEntity<?>) ResponseEntity.ok(Map.of("topProducts", topProducts));
            })
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to fetch product analytics"))));
  }

  @GetMapping("/analytics/abandoned_carts")
  public Mono<ResponseEntity<Map<String, Object>>> abandonedCarts(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "No token for shop")));
    }
    String since = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE);
    String url =
        "https://"
            + shop
            + "/admin/api/2023-10/checkouts.json?created_at_min="
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
              var checkouts = (java.util.List<Map<String, Object>>) data.get("checkouts");
              int count = checkouts != null ? checkouts.size() : 0;
              return (ResponseEntity<Map<String, Object>>)
                  (ResponseEntity<?>) ResponseEntity.ok(Map.of("abandonedCarts", count));
            })
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to fetch abandoned carts"))));
  }

  @GetMapping("/analytics/new_products")
  public Mono<ResponseEntity<Map<String, Object>>> newProducts(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "No token for shop")));
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
              var products = (java.util.List<Map<String, Object>>) data.get("products");
              int count = products != null ? products.size() : 0;
              return (ResponseEntity<Map<String, Object>>)
                  (ResponseEntity<?>)
                      ResponseEntity.ok(Map.of("newProducts", count, "products", products));
            })
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to fetch new products"))));
  }

  @GetMapping("/analytics/inventory/low")
  public Mono<ResponseEntity<Map<String, Object>>> lowInventory(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "No token for shop")));
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
              var products = (java.util.List<Map<String, Object>>) data.get("products");
              java.util.List<Map<String, Object>> lowStock = new java.util.ArrayList<>();
              for (var product : products) {
                var variants = (java.util.List<Map<String, Object>>) product.get("variants");
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
              return (ResponseEntity<Map<String, Object>>)
                  (ResponseEntity<?>) ResponseEntity.ok(Map.of("lowInventory", lowStock));
            })
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to fetch low inventory"))));
  }

  @GetMapping("/analytics/export/csv")
  public Mono<ResponseEntity<byte[]>> exportCsv(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    String token = getTokenForShop(shop);
    if (token == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    // Fetch all analytics in parallel
    String since = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE);
    String ordersUrl =
        "https://"
            + shop
            + "/admin/api/2023-10/orders.json?status=any&fields=total_price,created_at,line_items&created_at_min="
            + since
            + "T00:00:00-00:00";
    String productsUrl =
        "https://" + shop + "/admin/api/2023-10/products.json?fields=title,variants,created_at";
    String checkoutsUrl =
        "https://"
            + shop
            + "/admin/api/2023-10/checkouts.json?created_at_min="
            + since
            + "T00:00:00-00:00";
    return Mono.zip(
            webClient
                .get()
                .uri(ordersUrl)
                .header("X-Shopify-Access-Token", token)
                .retrieve()
                .bodyToMono(Map.class),
            webClient
                .get()
                .uri(productsUrl)
                .header("X-Shopify-Access-Token", token)
                .retrieve()
                .bodyToMono(Map.class),
            webClient
                .get()
                .uri(checkoutsUrl)
                .header("X-Shopify-Access-Token", token)
                .retrieve()
                .bodyToMono(Map.class))
        .map(
            tuple -> {
              var orders = (java.util.List<Map<String, Object>>) tuple.getT1().get("orders");
              var products = (java.util.List<Map<String, Object>>) tuple.getT2().get("products");
              var checkouts = (java.util.List<Map<String, Object>>) tuple.getT3().get("checkouts");
              // Revenue & Orders
              double revenue = 0;
              for (var order : orders) {
                try {
                  revenue += Double.parseDouble(order.get("total_price").toString());
                } catch (Exception ignored) {
                }
              }
              // Top Products
              java.util.Map<String, Integer> productSales = new java.util.HashMap<>();
              for (var order : orders) {
                var items = (java.util.List<Map<String, Object>>) order.get("line_items");
                for (var item : items) {
                  String title = item.get("title").toString();
                  int qty = 1;
                  try {
                    qty = Integer.parseInt(item.get("quantity").toString());
                  } catch (Exception ignored) {
                  }
                  productSales.put(title, productSales.getOrDefault(title, 0) + qty);
                }
              }
              var topProducts =
                  productSales.entrySet().stream()
                      .sorted((a, b) -> b.getValue() - a.getValue())
                      .limit(10)
                      .toList();
              // Low Inventory
              java.util.List<Map<String, Object>> lowStock = new java.util.ArrayList<>();
              for (var product : products) {
                var variants = (java.util.List<Map<String, Object>>) product.get("variants");
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
              // New Products
              java.util.List<Map<String, Object>> newProducts = new java.util.ArrayList<>();
              for (var product : products) {
                String created = product.get("created_at").toString().substring(0, 10);
                if (created.compareTo(since) >= 0) {
                  newProducts.add(product);
                }
              }
              // Abandoned Carts
              int abandonedCarts = checkouts != null ? checkouts.size() : 0;
              // Build CSV
              StringBuilder sb = new StringBuilder();
              sb.append("Metric,Value\n");
              sb.append("Revenue (last 30d)," + revenue + "\n");
              sb.append("Order Count (last 30d)," + orders.size() + "\n");
              sb.append("Abandoned Carts (last 30d)," + abandonedCarts + "\n");
              sb.append("\nTop Products (last 30d)\nProduct,Quantity\n");
              for (var e : topProducts) {
                sb.append(e.getKey() + "," + e.getValue() + "\n");
              }
              sb.append("\nLow Inventory\nProduct,Variant,Quantity\n");
              for (var item : lowStock) {
                sb.append(
                    item.get("title")
                        + ","
                        + item.get("variant")
                        + ","
                        + item.get("quantity")
                        + "\n");
              }
              sb.append("\nNew Products (last 30d)\nProduct,Created At\n");
              for (var item : newProducts) {
                sb.append(
                    item.get("title")
                        + ","
                        + item.get("created_at").toString().substring(0, 10)
                        + "\n");
              }
              byte[] csv = sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
              return ResponseEntity.ok()
                  .header(
                      HttpHeaders.CONTENT_DISPOSITION,
                      ContentDisposition.attachment()
                          .filename("storesight-analytics.csv")
                          .build()
                          .toString())
                  .contentType(MediaType.parseMediaType("text/csv"))
                  .body(csv);
            });
  }

  @GetMapping("/analytics/report/schedule")
  public Mono<ResponseEntity<Map<String, Object>>> getReportSchedule(
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String key = "report_schedule:" + shop;
    String schedule = redisTemplate.opsForValue().get(key);
    return Mono.just(ResponseEntity.ok(Map.of("schedule", schedule == null ? "none" : schedule)));
  }

  @PostMapping("/analytics/report/schedule")
  public Mono<ResponseEntity<Void>> setReportSchedule(
      @CookieValue(value = "shop", required = false) String shop,
      @org.springframework.web.bind.annotation.RequestBody Map<String, String> body) {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    String key = "report_schedule:" + shop;
    String schedule = body.getOrDefault("schedule", "none");
    redisTemplate.opsForValue().set(key, schedule);
    return Mono.just(ResponseEntity.ok().build());
  }

  @GetMapping("/analytics/cohort")
  public Mono<ResponseEntity<Map<String, Object>>> cohortAnalysis(
      @CookieValue(value = "shop", required = false) String shop) {
    // Mock cohort retention data for now
    var cohorts =
        java.util.List.of(
            Map.of("signup", "2024-05-01", "day0", 100, "day7", 60, "day14", 40, "day30", 25),
            Map.of("signup", "2024-05-08", "day0", 80, "day7", 50, "day14", 30, "day30", 18),
            Map.of("signup", "2024-05-15", "day0", 120, "day7", 70, "day14", 45, "day30", 30));
    return Mono.just(ResponseEntity.ok(Map.of("cohorts", cohorts)));
  }

  // Replace in-memory cache with Redis
  private void storeToken(String shop, String token) {
    redisTemplate.opsForValue().set("shop_token:" + shop, token);
  }

  private String getTokenForShop(String shop) {
    return redisTemplate.opsForValue().get("shop_token:" + shop);
  }

  private void removeToken(String shop) {
    redisTemplate.delete("shop_token:" + shop);
  }
}
