package com.storesight.backend.controller;

import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.service.NotificationService;
import com.storesight.backend.service.SecretService;
import com.storesight.backend.service.ShopService;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/auth/shopify")
public class ShopifyAuthController {
  private static final Logger logger = LoggerFactory.getLogger(ShopifyAuthController.class);
  private final WebClient webClient;
  private final ShopService shopService;
  private final NotificationService notificationService;
  private final StringRedisTemplate redisTemplate;
  private final ShopRepository shopRepository;
  private final SecretService secretService;

  @Value("${shopify.api.key:}")
  private String apiKey;

  @Value("${shopify.api.secret:}")
  private String apiSecret;

  @Value("${shopify.scopes}")
  private String scopes;

  @Value("${shopify.redirect_uri}")
  private String redirectUri;

  @Value("${frontend.url}")
  private String frontendUrl;

  @Autowired
  public ShopifyAuthController(
      WebClient.Builder webClientBuilder,
      ShopService shopService,
      NotificationService notificationService,
      StringRedisTemplate redisTemplate,
      ShopRepository shopRepository,
      SecretService secretService) {
    this.webClient = webClientBuilder.build();
    this.shopService = shopService;
    this.notificationService = notificationService;
    this.redisTemplate = redisTemplate;
    this.shopRepository = shopRepository;
    this.secretService = secretService;
    logger.info("ShopifyAuthController initialized with API key: {}", apiKey);
  }

  @PostConstruct
  public void initializeSecrets() {
    // Fallback to Redis-stored secrets if env vars are not provided
    if (apiKey == null || apiKey.isBlank()) {
      secretService
          .getSecret("shopify.api.key")
          .ifPresent(
              val -> {
                this.apiKey = val;
                logger.info("Loaded Shopify API key from Redis secret store");
              });
    }
    if (apiSecret == null || apiSecret.isBlank()) {
      secretService
          .getSecret("shopify.api.secret")
          .ifPresent(
              val -> {
                this.apiSecret = val;
                logger.info("Loaded Shopify API secret from Redis secret store");
              });
    }

    // Log final state
    logger.info(
        "Final ShopifyAuthController state - API key: {}, API secret: {}",
        apiKey != null ? apiKey.substring(0, Math.min(8, apiKey.length())) + "..." : "null",
        apiSecret != null
            ? apiSecret.substring(0, Math.min(8, apiSecret.length())) + "..."
            : "null");
  }

  @GetMapping("/login")
  public ResponseEntity<?> login(@RequestParam String shop, HttpServletResponse response) {
    logger.info("Login endpoint called with shop: {}", shop);
    try {
      if (shop == null || shop.trim().isEmpty()) {
        logger.warn("Shop parameter is empty");
        return ResponseEntity.badRequest().body(Map.of("error", "Shop parameter is required"));
      }

      // Validate shop domain format
      if (!shop.matches("^[a-zA-Z0-9][a-zA-Z0-9-]*\\.myshopify\\.com$")) {
        logger.warn("Invalid shop domain format: {}", shop);
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid shop domain format"));
      }

      // Redirect to install endpoint with the full path
      String redirectUrl =
          "/api/auth/shopify/install?shop=" + URLEncoder.encode(shop, StandardCharsets.UTF_8);
      logger.info("Redirecting to: {}", redirectUrl);
      response.sendRedirect(redirectUrl);
      return null; // Response is already sent
    } catch (Exception e) {
      logger.error("Error in login endpoint for shop: {}", shop, e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to process login request"));
    }
  }

  @GetMapping("/install")
  public ResponseEntity<?> install(@RequestParam String shop, HttpServletResponse response) {
    try {
      logger.info("Install attempt for shop: {}", shop);
      if (shop == null || shop.trim().isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "Shop parameter is required"));
      }

      // Validate shop domain format
      if (!shop.matches("^[a-zA-Z0-9][a-zA-Z0-9-]*\\.myshopify\\.com$")) {
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid shop domain format"));
      }

      String state = generateState();
      String url =
          String.format(
              "https://%s/admin/oauth/authorize?client_id=%s&scope=%s&redirect_uri=%s&state=%s",
              shop,
              apiKey,
              URLEncoder.encode(scopes, StandardCharsets.UTF_8),
              URLEncoder.encode(redirectUri, StandardCharsets.UTF_8),
              state);
      logger.info("Redirecting to Shopify OAuth URL: {}", url);
      response.sendRedirect(url);
      return null; // Response is already sent
    } catch (Exception e) {
      logger.error("Error in install endpoint for shop: {}", shop, e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to process install request"));
    }
  }

  @GetMapping("/callback")
  public void handleCallback(
      @RequestParam Map<String, String> params,
      HttpServletResponse response,
      HttpServletRequest request)
      throws IOException {
    String shop = params.get("shop");
    String code = params.get("code");
    logger.info("Callback received - shop: {}, code: {}", shop, code);
    logger.info(
        "Callback - Request headers: {}",
        Collections.list(request.getHeaderNames()).stream()
            .collect(Collectors.toMap(name -> name, request::getHeader)));
    logger.info("Callback - Request cookies: {}", Arrays.toString(request.getCookies()));

    if (shop == null || code == null) {
      response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing required parameters");
      return;
    }

    try {
      String accessToken = exchangeCodeForAccessToken(shop, code);
      logger.info("Access token obtained for shop: {}", shop);
      String sessionId = request.getSession(true).getId();
      shopService.saveShop(shop, accessToken, sessionId);

      // Set cookie with proper attributes
      Cookie shopCookie = new Cookie("shop", shop);
      shopCookie.setPath("/");
      shopCookie.setMaxAge((int) java.time.Duration.ofDays(30).getSeconds());
      shopCookie.setHttpOnly(false); // Set to false for development
      shopCookie.setSecure(false);
      // Add SameSite attribute to prevent browser cookie issues
      String cookieValue =
          shopCookie.getName()
              + "="
              + shopCookie.getValue()
              + "; Path="
              + shopCookie.getPath()
              + "; Max-Age="
              + shopCookie.getMaxAge()
              + "; SameSite=Lax";
      response.addHeader("Set-Cookie", cookieValue);
      // Also add the standard cookie for compatibility
      response.addCookie(shopCookie);

      logger.info("Setting cookie for shop: {}", shop);
      logger.info("Cookie value being set: {}", cookieValue);
      response.sendRedirect(frontendUrl + "/dashboard");
    } catch (Exception e) {
      logger.error("Error in callback for shop: {}", shop, e);
      response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error in callback");
    }
  }

  private String generateState() {
    byte[] randomBytes = new byte[32];
    new java.security.SecureRandom().nextBytes(randomBytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
  }

  private String exchangeCodeForAccessToken(String shop, String code) {
    String url = "https://" + shop + "/admin/oauth/access_token";
    Map<String, String> body =
        Map.of("client_id", apiKey, "client_secret", apiSecret, "code", code);
    return webClient
        .post()
        .uri(url)
        .bodyValue(body)
        .retrieve()
        .bodyToMono(Map.class)
        .map(response -> (String) response.get("access_token"))
        .block();
  }

  @GetMapping("/export")
  public Mono<ResponseEntity<byte[]>> exportData(
      @CookieValue(value = "shop", required = false) String shop,
      @RequestParam(required = false) String type,
      HttpServletRequest request) {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    String sessionId = request.getSession(false) != null ? request.getSession(false).getId() : null;
    String token =
        (sessionId != null && shop != null) ? shopService.getTokenForShop(shop, sessionId) : null;
    if (token == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    String url = "https://" + shop + "/admin/api/2023-10/";
    if ("products".equals(type)) {
      url += "products.json";
    } else if ("orders".equals(type)) {
      url += "orders.json?status=any";
    } else {
      return Mono.just(ResponseEntity.badRequest().build());
    }

    return webClient
        .get()
        .uri(url)
        .header("X-Shopify-Access-Token", token)
        .retrieve()
        .bodyToMono(String.class)
        .map(
            data -> {
              String filename = type + "_" + LocalDate.now() + ".json";
              return ResponseEntity.ok()
                  .contentType(MediaType.APPLICATION_JSON)
                  .header(
                      HttpHeaders.CONTENT_DISPOSITION,
                      ContentDisposition.attachment().filename(filename).build().toString())
                  .body(data.getBytes());
            });
  }

  @GetMapping("/notifications")
  public Mono<ResponseEntity<Map<String, Object>>> getNotifications(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {
    if (shop == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "Not authenticated");
      response.put("notifications", List.of());
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }
    String sessionId = request.getSession(false) != null ? request.getSession(false).getId() : null;
    return notificationService
        .getNotifications(shop, sessionId)
        .map(
            notifications -> {
              Map<String, Object> responseMap = new HashMap<>();
              responseMap.put("notifications", notifications);
              return ResponseEntity.ok(responseMap);
            })
        .onErrorResume(
            e -> {
              Map<String, Object> response = new HashMap<>();
              response.put("error", "Failed to fetch notifications");
              response.put("notifications", List.of());
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
            });
  }

  @PostMapping("/notifications/mark-read")
  public Mono<ResponseEntity<Map<String, String>>> markNotificationAsRead(
      @CookieValue(value = "shop", required = false) String shop,
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }
    String notificationId = body.get("id");
    if (notificationId == null) {
      return Mono.just(
          ResponseEntity.badRequest().body(Map.of("error", "Notification ID is required")));
    }
    String sessionId = request.getSession(false) != null ? request.getSession(false).getId() : null;
    return notificationService
        .markAsRead(shop, notificationId, sessionId)
        .then(Mono.just(ResponseEntity.ok(Map.of("status", "success"))))
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to mark notification as read"))));
  }

  @GetMapping("/me")
  public Mono<ResponseEntity<Map<String, Object>>> me(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {
    logger.info("Auth: Checking shop status - shop: {}", shop);
    logger.debug("Auth: Request cookies: {}", Arrays.toString(request.getCookies()));

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      logger.warn("Auth: No shop cookie found");
      response.put("error", "Not authenticated");
      response.put("shop", null);
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }

    String sessionId = request.getSession(false) != null ? request.getSession(false).getId() : null;
    String token =
        (sessionId != null && shop != null) ? shopService.getTokenForShop(shop, sessionId) : null;
    if (token == null) {
      logger.warn("Auth: No token found for shop: {} and session: {}", shop, sessionId);
      response.put("error", "Not authenticated");
      response.put("shop", null);
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }

    logger.info("Auth: Found token for shop: {} and session: {}", shop, sessionId);
    response.put("shop", shop);
    return Mono.just(ResponseEntity.ok(response));
  }

  @PostMapping("/profile/disconnect")
  public ResponseEntity<Map<String, String>> disconnect(
      @CookieValue(value = "shop", required = false) String shop,
      HttpServletResponse response,
      HttpServletRequest request) {
    logger.info("Auth: Disconnecting shop: {}", shop);

    if (shop != null) {
      // Clear the access token from Redis and database
      try {
        String sessionId =
            request.getSession(false) != null ? request.getSession(false).getId() : null;
        if (sessionId != null) {
          shopService.removeToken(shop, sessionId);
          logger.info("Auth: Cleared access token for shop: {} and session: {}", shop, sessionId);
        }
      } catch (Exception e) {
        logger.error("Auth: Error clearing access token for shop: {}", shop, e);
      }

      // Clear the shop cookie with multiple approaches to ensure it's removed
      Cookie shopCookie = new Cookie("shop", "");
      shopCookie.setPath("/");
      shopCookie.setMaxAge(0);
      shopCookie.setHttpOnly(false);
      shopCookie.setSecure(false);
      response.addCookie(shopCookie);

      // Also add a Set-Cookie header to ensure the cookie is cleared
      String clearCookieHeader =
          "shop=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      response.addHeader("Set-Cookie", clearCookieHeader);

      logger.info("Auth: Cleared shop cookie for: {}", shop);
    }

    return ResponseEntity.ok(Map.of("status", "success"));
  }

  @GetMapping("/test-cookie")
  public ResponseEntity<Map<String, Object>> testCookie(
      @CookieValue(value = "shop", required = false) String shop,
      HttpServletRequest request,
      HttpServletResponse response) {

    Map<String, Object> result = new HashMap<>();
    result.put("shop_from_cookie", shop);
    result.put("all_cookies", Arrays.toString(request.getCookies()));
    result.put("user_agent", request.getHeader("User-Agent"));
    result.put("origin", request.getHeader("Origin"));
    result.put("referer", request.getHeader("Referer"));

    // Try to set a test cookie
    Cookie testCookie = new Cookie("test_cookie", "test_value_" + System.currentTimeMillis());
    testCookie.setPath("/");
    testCookie.setMaxAge(300); // 5 minutes
    testCookie.setHttpOnly(false);
    testCookie.setSecure(false);
    response.addCookie(testCookie);

    result.put("test_cookie_set", true);
    result.put("timestamp", System.currentTimeMillis());

    return ResponseEntity.ok(result);
  }

  @PostMapping("/profile/force-disconnect")
  public ResponseEntity<Map<String, String>> forceDisconnect(
      @CookieValue(value = "shop", required = false) String shopCookie,
      @RequestParam(value = "shop", required = false) String shopParam,
      @RequestBody(required = false) Map<String, Object> body,
      HttpServletResponse response,
      HttpServletRequest request) {
    String shop = shopParam != null ? shopParam : shopCookie;
    response.addHeader(
        "Set-Cookie", "shop=; Path=/api; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    response.addHeader(
        "Set-Cookie",
        "shop=; Domain=localhost; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");

    if (shop != null && !shop.isBlank()) {
      // Clear the access token from Redis and database
      try {
        String sessionId =
            request.getSession(false) != null ? request.getSession(false).getId() : null;
        if (sessionId != null) {
          logger.info(
              "Auth: Calling shopService.removeToken for shop: {} and session: {}",
              shop,
              sessionId);
          shopService.removeToken(shop, sessionId);
          logger.info(
              "Auth: Force cleared access token for shop: {} and session: {}", shop, sessionId);
        }
      } catch (Exception e) {
        logger.error("Auth: Error force clearing access token for shop: {}", shop, e);
      }
    } else {
      logger.warn("Auth: No shop provided for force disconnect");
    }

    logger.info("Auth: Force disconnect completed");
    return ResponseEntity.ok(
        Map.of("status", "force_disconnected", "message", "All cookies and tokens cleared"));
  }
}
