package com.storesight.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.service.NotificationService;
import com.storesight.backend.service.OAuthRecoveryService;
import com.storesight.backend.service.SecretService;
import com.storesight.backend.service.ShopService;
import com.storesight.backend.service.ShopifyGraphqlClient;
import com.storesight.backend.service.ShopifyOAuthSecurityService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
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
  private final OAuthRecoveryService oAuthRecoveryService;
  private final ShopifyGraphqlClient shopifyGraphqlClient;
  private final ObjectMapper objectMapper;
  private final ShopifyOAuthSecurityService oauthSecurityService;

  // Redis key prefix for tracking used authorization codes
  private static final String USED_CODE_PREFIX = "oauth:used_code:";
  private static final int CODE_TTL_SECONDS = 60 * 60; // 1 hour - match shop token TTL
  private static final int SHOP_TOKEN_TTL_MINUTES = 60; // 1 hour - consistent with session TTL

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
      SecretService secretService,
      OAuthRecoveryService oAuthRecoveryService,
      ShopifyOAuthSecurityService oauthSecurityService,
      ShopifyGraphqlClient shopifyGraphqlClient,
      ObjectMapper objectMapper) {

    // Use the globally configured WebClient.Builder
    this.webClient = webClientBuilder.build();

    this.shopService = shopService;
    this.notificationService = notificationService;
    this.redisTemplate = redisTemplate;
    this.shopRepository = shopRepository;
    this.secretService = secretService;
    this.oAuthRecoveryService = oAuthRecoveryService;
    this.oauthSecurityService = oauthSecurityService;
    this.shopifyGraphqlClient = shopifyGraphqlClient;
    this.objectMapper = objectMapper;
  }

  @PostConstruct
  public void initializeSecrets() {
    try {
      // Load secrets from environment or secret service
      String envApiKey = System.getenv("SHOPIFY_API_KEY");
      String envApiSecret = System.getenv("SHOPIFY_API_SECRET");

      if (envApiKey != null && !envApiKey.isBlank()) {
        this.apiKey = envApiKey;
        logger.info("Loaded Shopify API key from environment");
      } else {
        logger.warn("Shopify API key not found in environment");
      }

      if (envApiSecret != null && !envApiSecret.isBlank()) {
        this.apiSecret = envApiSecret;
        logger.info("Loaded Shopify API secret from environment");
      } else {
        logger.warn("Shopify API secret not found in environment");
      }

      logger.info(
          "ShopifyAuthController initialized with API key: {}",
          apiKey != null ? apiKey.substring(0, Math.min(8, apiKey.length())) + "..." : "null");
    } catch (Exception e) {
      logger.error("Error initializing secrets: {}", e.getMessage(), e);
    }
  }

  @PreDestroy
  public void cleanup() {
    // Cleanup logic if needed
  }

  private boolean isCodeSuccessfullyProcessed(String code) {
    if (code == null) return false;

    String redisKey = USED_CODE_PREFIX + code;

    // Check if code has been successfully processed
    String processedValue = redisTemplate.opsForValue().get(redisKey);
    if (processedValue != null && processedValue.equals("SUCCESS")) {
      logger.info(
          "Authorization code already successfully processed: {}",
          code.substring(0, Math.min(8, code.length())) + "...");
      return true;
    }

    return false;
  }

  private void markCodeAsSuccessfullyProcessed(String code) {
    if (code == null) return;

    String redisKey = USED_CODE_PREFIX + code;

    // Mark code as successfully processed with TTL
    redisTemplate
        .opsForValue()
        .set(redisKey, "SUCCESS", java.time.Duration.ofSeconds(CODE_TTL_SECONDS));
    logger.info(
        "Marked authorization code as successfully processed: {}",
        code.substring(0, Math.min(8, code.length())) + "...");
  }

  private long getUsedCodesCount() {
    try {
      Set<String> keys = redisTemplate.keys(USED_CODE_PREFIX + "*");
      return keys != null ? keys.size() : 0;
    } catch (Exception e) {
      logger.warn("Error getting used codes count: {}", e.getMessage());
      return 0;
    }
  }

  private List<Map<String, Object>> getUsedCodesDetails() {
    try {
      Set<String> keys = redisTemplate.keys(USED_CODE_PREFIX + "*");
      if (keys == null || keys.isEmpty()) {
        return List.of();
      }

      return keys.stream()
          .map(
              key -> {
                String code = key.substring(USED_CODE_PREFIX.length());
                String usedTimeStr = redisTemplate.opsForValue().get(key);
                Long usedTime = usedTimeStr != null ? Long.parseLong(usedTimeStr) : null;

                Map<String, Object> codeInfo = new HashMap<>();
                codeInfo.put("code_preview", code.substring(0, Math.min(8, code.length())) + "...");
                codeInfo.put("used_at", usedTime);
                if (usedTime != null) {
                  codeInfo.put(
                      "age_minutes", (System.currentTimeMillis() - usedTime) / (1000 * 60));
                }
                return codeInfo;
              })
          .collect(Collectors.toList());
    } catch (Exception e) {
      logger.warn("Error getting used codes details: {}", e.getMessage());
      return List.of();
    }
  }

  @GetMapping("/login")
  public ResponseEntity<?> login(
      @RequestParam String shop,
      @RequestParam(required = false) String return_url,
      HttpServletResponse response) {
    logger.info("Login endpoint called with shop: {} and return_url: {}", shop, return_url);
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

      // Redirect to install endpoint with the full path and return_url if provided
      String redirectUrl =
          "/api/auth/shopify/install?shop=" + URLEncoder.encode(shop, StandardCharsets.UTF_8);
      if (return_url != null && !return_url.isBlank()) {
        String normalizedReturnUrl = oauthSecurityService.normalizeReturnUrl(return_url);
        redirectUrl +=
            "&return_url=" + URLEncoder.encode(normalizedReturnUrl, StandardCharsets.UTF_8);
      }
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
  public ResponseEntity<?> install(
      @RequestParam String shop,
      @RequestParam(required = false) String return_url,
      HttpServletResponse response) {
    try {
      logger.info("Install attempt for shop: {} with return_url: {}", shop, return_url);
      if (shop == null || shop.trim().isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "Shop parameter is required"));
      }

      // Validate shop domain format
      if (!shop.matches("^[a-zA-Z0-9][a-zA-Z0-9-]*\\.myshopify\\.com$")) {
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid shop domain format"));
      }

      String state = oauthSecurityService.createState(shop, return_url);

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
    try {
      String shop = params.get("shop");
      String code = params.get("code");
      String error = params.get("error");
      String errorDescription = params.get("error_description");
      String hmac = params.get("hmac");
      String state = params.get("state");
      String timestamp = params.get("timestamp");

      logger.info(
          "Shopify callback received - shop: {}, error: {}, signed: {}, state_present: {}, timestamp: {}",
          shop,
          error,
          hmac != null,
          state != null,
          timestamp);
      logger.debug("OAuth callback received with expected Shopify parameters");

      if (shop == null || hmac == null || state == null) {
        logger.error("OAuth callback is missing required signed parameters");
        response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid OAuth callback");
        return;
      }
      if (!oauthSecurityService.verifyHmac(params, apiSecret)) {
        logger.error("Shopify OAuth callback HMAC validation failed for shop: {}", shop);
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid Shopify signature");
        return;
      }
      ShopifyOAuthSecurityService.OAuthState oauthState;
      try {
        oauthState = oauthSecurityService.consumeState(state, shop);
      } catch (SecurityException invalidState) {
        logger.error("Shopify OAuth state validation failed for shop: {}", shop);
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid OAuth state");
        return;
      }

      // Check for Shopify error response
      if (error != null) {
        logger.error("Shopify OAuth error: {} - {}", error, errorDescription);
        String redirectUrl =
            frontendUrl
                + "/?error=oauth_error&error_message="
                + java.net.URLEncoder.encode(
                    "OAuth error: "
                        + error
                        + " - "
                        + (errorDescription != null ? errorDescription : "Unknown error"),
                    "UTF-8");
        logger.info("Redirecting to frontend with OAuth error: {}", redirectUrl);
        response.sendRedirect(redirectUrl);
        return;
      }

      if (code == null || code.isBlank()) {
        logger.error("Shopify OAuth callback did not include an authorization code");
        response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Authorization code is required");
        return;
      }

      // Check if authorization code has already been successfully processed
      if (isCodeSuccessfullyProcessed(code)) {
        logger.info(
            "Authorization code already successfully processed for shop: {}, redirecting to frontend",
            shop);
        String redirectUrl = frontendUrl + "/?shop=" + java.net.URLEncoder.encode(shop, "UTF-8");
        logger.info("Redirecting to frontend: {}", redirectUrl);
        response.sendRedirect(redirectUrl);
        return;
      }

      logger.info("Starting token exchange process for shop: {}", shop);
      String accessToken = exchangeCodeForAccessToken(shop, code);
      logger.info("Access token obtained for shop: {}", shop);

      // Create session more carefully with Redis fallback
      // For OAuth callback, we'll use a more robust session creation approach
      String sessionId;

      try {
        // For OAuth callback, always create a fresh session to avoid conflicts
        // First invalidate any existing session to prevent conflicts
        var existingSession = request.getSession(false);
        if (existingSession != null) {
          try {
            logger.info("Invalidating existing session before OAuth: {}", existingSession.getId());
            existingSession.invalidate();
          } catch (Exception invalidateError) {
            logger.warn("Error invalidating existing session: {}", invalidateError.getMessage());
          }
        }

        // Create new session for OAuth
        var newSession = request.getSession(true);
        sessionId = newSession.getId();
        logger.info("New server-backed OAuth session created successfully");

        // Set a marker to indicate this is an OAuth session
        newSession.setAttribute("oauth_session", true);
        newSession.setAttribute("shop", shop);

      } catch (Exception sessionError) {
        logger.error("Failed to create server-backed OAuth session", sessionError);
        throw new IllegalStateException("Session service is unavailable", sessionError);
      }

      logger.info("Saving authenticated shop data for shop: {}", shop);

      // Clear any stuck session markers for OAuth to ensure clean state
      shopService.clearOAuthSessionMarkers(sessionId);

      // SECURE: Don't store business data in Spring Session to avoid conflicts
      // Spring Session should only handle HTTP session state, not business logic
      // Our custom session layer (PostgreSQL + Redis) handles business data

      try {
        // Save shop data with session ID using our custom session layer
        // Use OAuth mode to skip session limit enforcement during callback
        shopService.saveShop(shop, accessToken, sessionId, request, true);
        logger.info("Shop data saved successfully to custom session layer (OAuth mode)");

        // Execute post-save operations (caching, cleanup) outside transaction
        shopService.postSaveShopOperations(shop, sessionId, accessToken);
        logger.debug("Post-save operations completed for shop: {}", shop);

        // Simple verification that the session was saved (skip complex validation for OAuth)
        logger.info("OAuth session creation completed for shop: {}", shop);

        // Reduced delay to minimize timing window for concurrent requests
        try {
          Thread.sleep(100); // Reduced to 100ms delay
          logger.debug("OAuth session establishment delay completed for shop: {}", shop);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          logger.warn("OAuth session delay interrupted for shop: {}", shop);
        }

      } catch (Exception saveError) {
        logger.error("Failed to save shop data: {}", saveError.getMessage(), saveError);

        // SECURE: Handle session creation failures appropriately
        if (saveError.getMessage() != null
            && saveError.getMessage().contains("Failed to save session")) {
          // Session creation failed - this is a critical error
          logger.error("Critical: Session creation failed for shop: {}", shop);
          response.sendError(
              HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
              "Failed to create session. Please try again.");
          return;
        }

        // Other save errors - still critical for business logic
        response.sendError(
            HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
            "Failed to save shop data. Please try again.");
        return;
      }

      // Set the shop cookie with proper domain configuration for Render
      Cookie shopCookie = new Cookie("shop", shop);
      shopCookie.setPath("/");

      // Configure cookie for shopgaugeai.com domain
      boolean isProduction = frontendUrl != null && frontendUrl.contains("shopgaugeai.com");
      if (isProduction) {
        // For production, set domain to allow sharing between subdomains
        shopCookie.setSecure(true);
        logger.info("Production environment detected - using secure host-only cookies");
      } else {
        // Development environment - localhost doesn't need domain
        shopCookie.setSecure(false); // HTTP allowed in development
        logger.info("Development environment detected - using local cookie settings");
      }

      shopCookie.setHttpOnly(true);
      shopCookie.setMaxAge(60 * 60 * 24 * 7); // 7 days

      // Add cookie to response
      response.addCookie(shopCookie);

      // Also set cookie using header for better control over SameSite attribute
      // For same-site requests (both www and api on shopgaugeai.com), use Lax
      String sameSiteValue = isProduction ? "Lax" : "Lax";
      response.addHeader(
          "Set-Cookie",
          String.format(
              "%s=%s; Path=%s; Max-Age=%d; HttpOnly; SameSite=%s; %s",
              shopCookie.getName(),
              shopCookie.getValue(),
              shopCookie.getPath(),
              shopCookie.getMaxAge(),
              sameSiteValue,
              isProduction ? "Secure;" : ""));

      // CRITICAL: Also set a session cookie for immediate authentication
      // This ensures that the /me endpoint works immediately after OAuth
      if (isProduction) {
        response.addHeader(
            "Set-Cookie",
            String.format(
                "JSESSIONID=%s; Path=/; Max-Age=%d; SameSite=Lax; Secure; HttpOnly",
                sessionId, 60 * 60 * 24)); // 24 hours for session
      }

      logger.info(
          "OAuth cookies configured: secure={}, path={}, SameSite={}",
          isProduction,
          shopCookie.getPath(),
          sameSiteValue);

      // Mark the authorization code as successfully processed
      markCodeAsSuccessfullyProcessed(code);

      String returnUrl = oauthState.returnUrl();

      String redirectUrl;
      if (returnUrl != null && !returnUrl.isBlank()) {
        // Use custom return URL if provided
        redirectUrl = returnUrl;
        logger.info("Using custom return URL: {}", redirectUrl);
      } else {
        // Default redirect with shop parameter
        redirectUrl = frontendUrl + "/?shop=" + java.net.URLEncoder.encode(shop, "UTF-8");
        logger.info("Using default redirect URL: {}", redirectUrl);
      }

      logger.info("Cookie set successfully, redirecting to: {}", redirectUrl);

      // Minimal delay to ensure session is established
      try {
        Thread.sleep(50); // Reduced to 50ms delay
        logger.info("Session establishment delay completed");
      } catch (InterruptedException e) {
        logger.warn("Session establishment delay was interrupted");
        Thread.currentThread().interrupt();
      }

      response.sendRedirect(redirectUrl);
    } catch (Exception e) {
      logger.error("Error in callback - Error details: {}", e.getMessage(), e);

      // Provide more specific error messages and redirect to frontend
      String errorMessage = "Authentication failed";
      String errorCode = "auth_failed";

      if (e.getMessage().contains("Authorization code has already been used")) {
        errorMessage =
            "This authorization link has already been used or has expired. Please start the installation process again.";
        errorCode = "code_used";
      } else if (e.getMessage().contains("API key")) {
        errorMessage = "Shopify API configuration error. Please contact support.";
        errorCode = "config_error";
      } else if (e.getMessage().contains("access_token")) {
        errorMessage = "Failed to obtain access token from Shopify. Please try again.";
        errorCode = "token_error";
      } else if (e.getMessage().contains("network") || e.getMessage().contains("connection")) {
        errorMessage =
            "Network error during authentication. Please check your connection and try again.";
        errorCode = "network_error";
      } else if (e.getMessage().contains("Invalid OAuth request")) {
        errorMessage = "Invalid OAuth request. Please check your Shopify app configuration.";
        errorCode = "oauth_error";
      }

      // Redirect to frontend with error parameters instead of returning JSON
      String redirectUrl =
          frontendUrl
              + "/?error="
              + java.net.URLEncoder.encode(errorCode, "UTF-8")
              + "&error_message="
              + java.net.URLEncoder.encode(errorMessage, "UTF-8");

      logger.info("Redirecting to frontend with error: {}", redirectUrl);
      response.sendRedirect(redirectUrl);
    }
  }

  private String exchangeCodeForAccessToken(String shop, String code) {
    logger.info("Exchanging Shopify authorization code for shop: {}", shop);
    logger.debug("Using configured Shopify application credentials for token exchange");

    if (apiKey == null || apiKey.isBlank()) {
      logger.error("Shopify API key is missing or empty");
      throw new RuntimeException("Shopify API key is not configured");
    }

    if (apiSecret == null || apiSecret.isBlank()) {
      logger.error("Shopify API secret is missing or empty");
      throw new RuntimeException("Shopify API secret is not configured");
    }

    String url = "https://" + shop + "/admin/oauth/access_token";
    Map<String, String> body =
        Map.of("client_id", apiKey, "client_secret", apiSecret, "code", code);

    logger.info("Making token exchange request to: {}", url);
    logger.info(
        "Request body parameters: client_id={}, client_secret={}, code={}",
        apiKey.substring(0, Math.min(8, apiKey.length())) + "...",
        apiSecret.substring(0, Math.min(8, apiSecret.length())) + "...",
        code != null ? code.substring(0, Math.min(8, code.length())) + "..." : "null");

    // Single attempt - no retries since authorization codes are single-use
    try {
      logger.info("Making single token exchange attempt");

      return webClient
          .post()
          .uri(url)
          .bodyValue(body)
          .retrieve()
          .bodyToMono(Map.class)
          .timeout(java.time.Duration.ofSeconds(30)) // 30 second timeout
          .map(
              response -> {
                logger.info("Token exchange response: {}", response);
                String accessToken = (String) response.get("access_token");
                if (accessToken == null || accessToken.isBlank()) {
                  logger.error("No access token in response: {}", response);
                  throw new RuntimeException("No access token received from Shopify");
                }
                logger.info("Successfully obtained access token");
                return accessToken;
              })
          .onErrorMap(
              WebClientResponseException.class,
              ex -> {
                String responseBody = ex.getResponseBodyAsString();
                logger.error(
                    "Shopify OAuth error - Status: {}, Body: {}", ex.getStatusCode(), responseBody);

                // Provide more specific error messages based on the response
                String errorMessage;
                if (responseBody.contains("authorization code was not found or was already used")) {
                  errorMessage =
                      "Authorization code has already been used or has expired. Please try the installation process again.";
                } else if (responseBody.contains("invalid_request")) {
                  errorMessage =
                      "Invalid OAuth request. Please check your Shopify app configuration.";
                } else if (responseBody.contains("unauthorized_client")) {
                  errorMessage = "Unauthorized client. Please check your Shopify API credentials.";
                } else if (responseBody.contains("invalid_grant")) {
                  errorMessage =
                      "Invalid authorization grant. Please try the installation process again.";
                } else {
                  errorMessage =
                      "Shopify OAuth failed: " + ex.getStatusCode() + " - " + responseBody;
                }

                return new RuntimeException(errorMessage, ex);
              })
          .block();

    } catch (Exception e) {
      logger.error("Error during token exchange for shop: {}", shop, e);
      throw new RuntimeException("Failed to exchange code for access token: " + e.getMessage(), e);
    }
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

    Mono<Map<String, Object>> export;
    if ("products".equals(type)) {
      export = shopifyGraphqlClient.fetchProducts(shop, token, 250, null);
    } else if ("orders".equals(type)) {
      export = shopifyGraphqlClient.fetchOrders(shop, token, 250, null, null);
    } else {
      return Mono.just(ResponseEntity.badRequest().build());
    }

    return export.map(
        data -> {
          String filename = type + "_" + LocalDate.now() + ".json";
          try {
            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    ContentDisposition.attachment().filename(filename).build().toString())
                .body(objectMapper.writeValueAsBytes(data));
          } catch (Exception serializationError) {
            throw new IllegalStateException(
                "Unable to serialize Shopify export", serializationError);
          }
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
        .getNotificationsWithCleanup(shop, sessionId)
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

  @PostMapping("/notifications")
  public Mono<ResponseEntity<Map<String, Object>>> createNotification(
      @CookieValue(value = "shop", required = false) String shop,
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }

    String message = body.get("message");
    String type = body.get("type");
    String category = body.get("category");
    String scope = body.get("scope");
    String sessionId = request.getSession(false) != null ? request.getSession(false).getId() : null;

    if (message == null || message.trim().isEmpty()) {
      return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Message is required")));
    }

    if (type == null || type.trim().isEmpty()) {
      type = "info"; // Default type
    }

    if (scope == null || scope.trim().isEmpty()) {
      scope = "personal"; // Default scope
    }

    // Create session-specific notification
    return notificationService
        .createNotification(
            shop, sessionId, message, type, category != null ? category : "General", scope)
        .map(
            notification -> {
              Map<String, Object> response = new HashMap<>();
              response.put("id", notification.getId());
              response.put("message", notification.getMessage());
              response.put("type", notification.getType());
              response.put("read", notification.isRead());
              response.put("createdAt", notification.getCreatedAt().toString());
              response.put("category", notification.getCategory());
              response.put("shop", notification.getShop());
              response.put("sessionId", notification.getSessionId());
              response.put("scope", notification.getScope());
              return ResponseEntity.status(HttpStatus.CREATED).body(response);
            })
        .onErrorResume(
            e -> {
              Map<String, Object> errorResponse = new HashMap<>();
              errorResponse.put("error", "Failed to create notification");
              errorResponse.put("message", e.getMessage());
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse));
            });
  }

  @DeleteMapping("/notifications/{notificationId}")
  public Mono<ResponseEntity<Map<String, String>>> deleteNotification(
      @CookieValue(value = "shop", required = false) String shop,
      @PathVariable String notificationId,
      HttpServletRequest request) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }

    String sessionId = request.getSession(false) != null ? request.getSession(false).getId() : null;
    return notificationService
        .deleteNotification(shop, notificationId, sessionId)
        .then(Mono.just(ResponseEntity.ok(Map.of("status", "success"))))
        .onErrorResume(
            e ->
                Mono.just(
                    ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to delete notification"))));
  }

  @PostMapping("/notifications/cleanup")
  public Mono<ResponseEntity<Map<String, Object>>> triggerCleanup(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {
    if (shop == null) {
      return Mono.just(
          ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Not authenticated")));
    }

    return notificationService
        .cleanupOldNotifications()
        .map(
            deletedCount -> {
              Map<String, Object> response = new HashMap<>();
              response.put("status", "success");
              response.put("deletedCount", deletedCount);
              response.put("message", "Cleanup completed successfully");
              return ResponseEntity.ok(response);
            })
        .onErrorResume(
            e -> {
              Map<String, Object> errorResponse = new HashMap<>();
              errorResponse.put("error", "Failed to trigger cleanup");
              errorResponse.put("message", e.getMessage());
              return Mono.just(
                  ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse));
            });
  }

  @GetMapping("/me")
  public Mono<ResponseEntity<Map<String, Object>>> me(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {
    logger.info("Auth: Checking shop status - shop: {}", shop);

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      logger.debug("Auth: No shop cookie found - user not authenticated");
      response.put("error", "Not authenticated");
      response.put("shop", null);
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }

    String sessionId = request.getSession(false) != null ? request.getSession(false).getId() : null;

    String token =
        (sessionId != null && shop != null) ? shopService.getTokenForShop(shop, sessionId) : null;

    // If no token found with session ID, try to recover from database
    if (token == null && shop != null) {
      logger.warn(
          "Auth: No token with session ID, attempting recovery from database for shop: {}", shop);

      // Try OAuth recovery service first
      if (oAuthRecoveryService.handleAuthFailure(shop, sessionId, "session_expired")) {
        logger.info("Auth: OAuth recovery successful for shop: {}", shop);
        token = shopService.getTokenForShop(shop, sessionId);
      } else {
        // Fallback to direct database lookup
        token = shopService.getTokenForShop(shop, "fallback");
      }

      // If we found a token in database, refresh it in Redis with current session
      if (token != null) {
        // Create new session if needed for recovery
        if (sessionId == null) {
          try {
            sessionId = request.getSession(true).getId();
          } catch (Exception e) {
            logger.warn("Auth: Failed to create new session: {}", e.getMessage());
            return Mono.just(
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Session service is unavailable", "shop", shop)));
          }
        }

        logger.info("Auth: Found token in database, refreshing session for shop: {}", shop);
        try {
          shopService.saveShop(shop, token, sessionId, request);
          logger.info("Auth: Session refreshed successfully for shop: {}", shop);
        } catch (Exception e) {
          logger.error("Auth: Failed to refresh session: {}", e.getMessage());
          // Continue anyway since we have a valid token
        }
      }
    }

    if (token == null) {
      logger.warn("Auth: No token found for shop: {}", shop);

      // Check recovery status
      Map<String, Object> recoveryStatus = oAuthRecoveryService.getRecoveryStatus(shop);
      response.put("recovery_status", recoveryStatus);

      response.put("error", "Session expired - please re-authenticate");
      response.put("shop", null);
      response.put("reauth_url", "/api/auth/shopify/login?shop=" + shop);
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }

    logger.info("Auth: Authenticated session found for shop: {}", shop);
    response.put("shop", shop);
    response.put("authenticated", true);
    response.put("sessionId", sessionId);

    // Reset any failure tracking on successful authentication
    oAuthRecoveryService.resetFailureTracking(shop);

    return Mono.just(ResponseEntity.ok(response));
  }

  /** Refresh authentication for a shop - useful for session recovery */
  @PostMapping("/refresh")
  public Mono<ResponseEntity<Map<String, Object>>> refreshAuth(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {
    logger.info("Auth: Refresh requested for shop: {}", shop);

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      logger.warn("Auth: No shop cookie for refresh");
      response.put("error", "No shop specified");
      response.put("success", false);
      return Mono.just(ResponseEntity.badRequest().body(response));
    }

    // Try to get token from database
    String token = shopService.getTokenForShop(shop, "database-lookup");

    if (token != null) {
      // Refresh session with current session ID
      String sessionId = request.getSession(true).getId(); // Create session if needed
      try {
        shopService.saveShop(shop, token, sessionId);
        logger.info("Auth: Session refreshed for shop: {}", shop);

        response.put("success", true);
        response.put("shop", shop);
        response.put("message", "Authentication refreshed");
        return Mono.just(ResponseEntity.ok(response));

      } catch (Exception e) {
        logger.error("Auth: Failed to refresh session: {}", e.getMessage());
        response.put("error", "Failed to refresh session");
        response.put("success", false);
        return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
      }
    } else {
      logger.warn("Auth: No token found in database for shop: {}", shop);
      response.put("error", "No valid authentication found");
      response.put("success", false);
      response.put("reauth_url", "/api/auth/shopify/login?shop=" + shop);
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }
  }

  @PostMapping("/profile/disconnect")
  public ResponseEntity<Map<String, String>> disconnect(
      @CookieValue(value = "shop", required = false) String shop,
      HttpServletResponse response,
      HttpServletRequest request) {
    logger.info("Auth: Disconnecting shop: {}", shop);

    if (shop != null) {
      // Enhanced cleanup: Clear current session and optionally all sessions
      try {
        String sessionId =
            request.getSession(false) != null ? request.getSession(false).getId() : null;
        if (sessionId != null) {
          // Remove current session from application tracking
          shopService.removeSession(shop, sessionId);
          logger.info("Auth: Cleared current session for shop: {}", shop);

          // Let Spring Session handle session cleanup naturally - no explicit invalidation
          // This prevents "Session was invalidated" errors during request processing
          logger.info("Auth: Session cleanup initiated for shop: {}", shop);
        } else {
          // Fallback: remove all sessions if no current session
          shopService.removeAllSessionsForShop(shop);
          logger.info("Auth: Cleared all sessions for shop: {} (no current session found)", shop);
        }
      } catch (Exception e) {
        logger.error("Auth: Error during enhanced disconnect cleanup for shop: {}", shop, e);
      }

      // Clear the shop cookie with the correct domain setting
      Cookie shopCookie = new Cookie("shop", "");
      shopCookie.setPath("/");
      shopCookie.setMaxAge(0);
      shopCookie.setHttpOnly(false);
      shopCookie.setSecure(true); // Use secure cookies in production
      response.addCookie(shopCookie);

      // Also add a Set-Cookie header to ensure the cookie is cleared
      // Use SameSite=Lax for production since both domains are on shopgaugeai.com
      boolean isProduction = frontendUrl != null && frontendUrl.contains("shopgaugeai.com");
      String sameSiteValue = isProduction ? "Lax" : "Lax";
      String domainAttribute = isProduction ? "Domain=shopgaugeai.com; " : "";
      String clearCookieHeader =
          String.format(
              "shop=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; %sSecure; SameSite=%s",
              domainAttribute, sameSiteValue);
      response.addHeader("Set-Cookie", clearCookieHeader);

      logger.info("Auth: Cleared shop cookie for: {}", shop);
    }

    return ResponseEntity.ok(Map.of("status", "success"));
  }

  @PostMapping("/profile/force-disconnect")
  public ResponseEntity<Map<String, String>> forceDisconnect(
      HttpServletResponse response, HttpServletRequest request, Authentication authentication) {
    logger.info("Auth: Force disconnect requested");

    // Clear all cookies
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (Cookie cookie : cookies) {
        Cookie clearCookie = new Cookie(cookie.getName(), "");
        clearCookie.setPath("/");
        clearCookie.setMaxAge(0);
        clearCookie.setHttpOnly(false);
        clearCookie.setSecure(true);
        response.addCookie(clearCookie);
      }
    }

    // Clear shop cookie specifically
    Cookie shopCookie = new Cookie("shop", "");
    shopCookie.setPath("/");
    shopCookie.setMaxAge(0);
    shopCookie.setHttpOnly(false);
    shopCookie.setSecure(true);
    response.addCookie(shopCookie);

    // Tenant identity comes only from the authenticated security context.
    String shop = authentication != null ? authentication.getName() : null;

    if (shop != null && !shop.isBlank()) {
      // Enhanced force cleanup: Clear ALL sessions and data
      try {
        String sessionId =
            request.getSession(false) != null ? request.getSession(false).getId() : null;

        // Force remove ALL sessions for this shop
        shopService.removeAllSessionsForShop(shop);
        logger.info("Auth: Force cleared ALL sessions for shop: {}", shop);

        // Let Spring Session handle session cleanup naturally - no explicit invalidation
        // This prevents "Session was invalidated" errors during request processing
        if (sessionId != null) {
          logger.info("Auth: Force disconnect session cleanup initiated for shop: {}", shop);
        }

      } catch (Exception e) {
        logger.error("Auth: Error during force disconnect cleanup for shop: {}", shop, e);
      }
    } else {
      logger.warn("Auth: No shop provided for force disconnect");
    }

    logger.info("Auth: Force disconnect completed");
    return ResponseEntity.ok(
        Map.of("status", "force_disconnected", "message", "All cookies and tokens cleared"));
  }
}
