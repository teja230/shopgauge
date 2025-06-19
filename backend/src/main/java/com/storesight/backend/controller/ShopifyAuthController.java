package com.storesight.backend.controller;

import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.service.NotificationService;
import com.storesight.backend.service.SecretService;
import com.storesight.backend.service.ShopService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    // Fallback to Redis-stored secrets if env vars are not provided
    if (apiKey == null || apiKey.isBlank()) {
      secretService
          .getSecret("shopify_api_key")
          .ifPresent(
              val -> {
                this.apiKey = val;
                logger.info("Loaded Shopify API key from Redis secret store");
              });
    }
    if (apiSecret == null || apiSecret.isBlank()) {
      secretService
          .getSecret("shopify_api_secret")
          .ifPresent(
              val -> {
                this.apiSecret = val;
                logger.info("Loaded Shopify API secret from Redis secret store");
              });
    }
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

    if (shop == null || code == null) {
      response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing required parameters");
      return;
    }

    try {
      String accessToken = exchangeCodeForAccessToken(shop, code);
      logger.info("Access token obtained for shop: {}", shop);
      shopService.saveShop(shop, accessToken);

      // Set cookie with proper attributes
      Cookie shopCookie = new Cookie("shop", shop);
      shopCookie.setPath("/");
      shopCookie.setMaxAge((int) java.time.Duration.ofDays(30).getSeconds());
      shopCookie.setHttpOnly(false); // Set to false for development
      shopCookie.setSecure(false);
      response.addCookie(shopCookie);

      logger.info("Setting cookie for shop: {}", shop);
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
      @RequestParam(required = false) String type) {
    if (shop == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    String token = shopService.getTokenForShop(shop);
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
      @CookieValue(value = "shop", required = false) String shop) {
    if (shop == null) {
      Map<String, Object> response = new HashMap<>();
      response.put("error", "Not authenticated");
      response.put("notifications", List.of());
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }
    return notificationService
        .getNotifications(shop)
        .map(
            notifications -> {
              Map<String, Object> response = new HashMap<>();
              response.put("notifications", notifications);
              return ResponseEntity.ok(response);
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
      @RequestBody Map<String, String> body) {
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
    return notificationService
        .markAsRead(shop, notificationId)
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

    String token = shopService.getTokenForShop(shop);
    if (token == null) {
      logger.warn("Auth: No token found for shop: {}", shop);
      response.put("error", "Not authenticated");
      response.put("shop", null);
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }

    logger.info("Auth: Found token for shop: {}", shop);
    response.put("shop", shop);
    return Mono.just(ResponseEntity.ok(response));
  }

  @GetMapping("/reauth")
  public ResponseEntity<?> reauth(
      @CookieValue(value = "shop", required = false) String shop,
      @RequestParam(value = "shop", required = false) String shopParam,
      HttpServletRequest request,
      HttpServletResponse response) {
    logger.info("Re-authentication requested for shop: {}", shop);
    logger.info("Request cookies: {}", Arrays.toString(request.getCookies()));
    logger.info("Request headers: {}", request.getHeaderNames());

    // Fallback: if no shop cookie but query param provided, use it
    if ((shop == null || shop.isBlank()) && shopParam != null && !shopParam.isBlank()) {
      shop = shopParam;
      logger.info("Using shop from query parameter: {}", shop);
    }

    try {
      if (shop == null || shop.trim().isEmpty()) {
        logger.warn("No shop cookie found in re-auth request");
        return ResponseEntity.badRequest()
            .body(Map.of("error", "Shop parameter is required - please log in first"));
      }

      // Validate shop domain format
      if (!shop.matches("^[a-zA-Z0-9][a-zA-Z0-9-]*\\.myshopify\\.com$")) {
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid shop domain format"));
      }

      String state = generateState();
      // Invalidate existing token so that new one is issued with updated scopes
      shopService.removeToken(shop);
      String url =
          String.format(
              "https://%s/admin/oauth/authorize?client_id=%s&scope=%s&redirect_uri=%s&state=%s",
              shop,
              apiKey,
              URLEncoder.encode(scopes, StandardCharsets.UTF_8),
              URLEncoder.encode(redirectUri, StandardCharsets.UTF_8),
              state);
      logger.info("Re-authentication: Redirecting to Shopify OAuth URL: {}", url);
      response.sendRedirect(url);
      return null; // Response is already sent
    } catch (Exception e) {
      logger.error("Error in re-authentication endpoint for shop: {}", shop, e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to process re-authentication request"));
    }
  }

  @PostMapping("/profile/disconnect")
  public ResponseEntity<Map<String, String>> disconnect(
      @CookieValue(value = "shop", required = false) String shop, HttpServletResponse response) {
    logger.info("Auth: Disconnecting shop: {}", shop);

    if (shop != null) {
      // Clear the shop cookie
      Cookie shopCookie = new Cookie("shop", null);
      shopCookie.setPath("/");
      shopCookie.setMaxAge(0);
      shopCookie.setHttpOnly(false);
      shopCookie.setSecure(false);
      response.addCookie(shopCookie);

      logger.info("Auth: Cleared shop cookie for: {}", shop);
    }

    return ResponseEntity.ok(Map.of("status", "success"));
  }
}
