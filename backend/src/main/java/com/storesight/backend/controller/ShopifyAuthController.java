package com.storesight.backend.controller;

import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.service.NotificationService;
import com.storesight.backend.service.SecretService;
import com.storesight.backend.service.ShopService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

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

  // Redis key prefix for tracking used authorization codes
  private static final String USED_CODE_PREFIX = "oauth:used_code:";
  private static final int CODE_TTL_SECONDS = 5 * 60; // 5 minutes

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

    // Use the globally configured WebClient.Builder
    this.webClient = webClientBuilder.build();

    this.shopService = shopService;
    this.notificationService = notificationService;
    this.redisTemplate = redisTemplate;
    this.shopRepository = shopRepository;
    this.secretService = secretService;
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

  private boolean isCodeAlreadyUsed(String code) {
    if (code == null) return false;

    String redisKey = USED_CODE_PREFIX + code;

    // Check if code exists in Redis
    Boolean exists = redisTemplate.hasKey(redisKey);
    if (Boolean.TRUE.equals(exists)) {
      logger.warn(
          "Authorization code already used within 5 minutes: {}",
          code.substring(0, Math.min(8, code.length())) + "...");
      return true;
    }

    // Mark code as used with TTL
    redisTemplate
        .opsForValue()
        .set(
            redisKey,
            String.valueOf(System.currentTimeMillis()),
            java.time.Duration.ofSeconds(CODE_TTL_SECONDS));
    logger.debug(
        "Marked authorization code as used: {}",
        code.substring(0, Math.min(8, code.length())) + "...");
    return false;
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
    try {
      String shop = params.get("shop");
      String code = params.get("code");
      String error = params.get("error");
      String errorDescription = params.get("error_description");
      String hmac = params.get("hmac");
      String state = params.get("state");
      String timestamp = params.get("timestamp");

      logger.info(
          "Callback received - shop: {}, code: {}, error: {}, error_description: {}, hmac: {}, state: {}, timestamp: {}",
          shop,
          code != null ? code.substring(0, Math.min(8, code.length())) + "..." : "null",
          error,
          errorDescription,
          hmac != null ? hmac.substring(0, Math.min(8, hmac.length())) + "..." : "null",
          state != null ? state.substring(0, Math.min(8, state.length())) + "..." : "null",
          timestamp);
      logger.info(
          "Callback - Request headers: {}",
          Collections.list(request.getHeaderNames()).stream()
              .collect(Collectors.toMap(name -> name, request::getHeader)));
      logger.info("Callback - Request cookies: {}", Arrays.toString(request.getCookies()));

      // Check for Shopify error response
      if (error != null) {
        logger.error("Shopify OAuth error: {} - {}", error, errorDescription);
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST, "OAuth error: " + error + " - " + errorDescription);
        return;
      }

      if (shop == null || code == null) {
        logger.error("Missing required parameters - shop: {}, code: {}", shop, code);
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST, "Missing required parameters: shop and/or code");
        return;
      }

      // Check if authorization code has already been used
      if (isCodeAlreadyUsed(code)) {
        logger.error("Authorization code already used for shop: {}", shop);
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "Authorization code has already been used or has expired");
        return;
      }

      // Validate HMAC if present (optional but recommended for security)
      if (hmac != null && apiSecret != null) {
        try {
          boolean isValidHmac = validateHmac(params, apiSecret);
          if (!isValidHmac) {
            logger.error("HMAC validation failed for shop: {}", shop);
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "HMAC validation failed");
            return;
          }
          logger.info("HMAC validation successful for shop: {}", shop);
        } catch (Exception hmacError) {
          logger.warn("HMAC validation error (continuing anyway): {}", hmacError.getMessage());
        }
      } else {
        logger.info(
            "Skipping HMAC validation - hmac: {}, apiSecret: {}",
            hmac != null ? "present" : "null",
            apiSecret != null ? "present" : "null");
      }

      logger.info("Starting token exchange process for shop: {}", shop);
      String accessToken = exchangeCodeForAccessToken(shop, code);
      logger.info("Access token obtained for shop: {}", shop);

      // Create session more carefully with Redis fallback
      String sessionId = null;
      try {
        var session = request.getSession(true);
        sessionId = session.getId();
        logger.info("Session created successfully - sessionId: {}", sessionId);
      } catch (Exception sessionError) {
        logger.warn(
            "Failed to create session (likely Redis issue), using fallback approach: {}",
            sessionError.getMessage());
        // Fallback: use a timestamp-based session ID that doesn't require Redis
        sessionId = "fallback_" + System.currentTimeMillis() + "_" + shop.hashCode();
        logger.info("Using fallback sessionId: {}", sessionId);
      }

      logger.info("Saving shop data - shop: {}, sessionId: {}", shop, sessionId);
      try {
        shopService.saveShop(shop, accessToken, sessionId);
        logger.info("Shop data saved successfully");
      } catch (Exception saveError) {
        logger.error("Failed to save shop data to Redis/database: {}", saveError.getMessage());
        // Continue with cookie setting even if save fails
        // The token exchange was successful, so we can still set the cookie
      }

      // Store shop in session as well (as a fallback authentication mechanism)
      if (request.getSession(false) != null) {
        request.getSession().setAttribute("shopDomain", shop);
        logger.info("Stored shop domain in session: {}", shop);
      }

      // Set the shop cookie with proper domain configuration for Render
      Cookie shopCookie = new Cookie("shop", shop);
      shopCookie.setPath("/");

      // Configure cookie for cross-domain access on Render
      boolean isProduction = frontendUrl != null && frontendUrl.contains("onrender.com");
      if (isProduction) {
        // For production, don't set domain (let browser use the current domain)
        // This avoids cross-domain cookie issues
        shopCookie.setSecure(true);
        logger.info("Production environment detected - using secure cookies");
      } else {
        // Development environment - localhost doesn't need domain
        shopCookie.setSecure(false); // HTTP allowed in development
        logger.info("Development environment detected - using local cookie settings");
      }

      shopCookie.setHttpOnly(false); // Allow JavaScript access
      shopCookie.setMaxAge(60 * 60 * 24 * 7); // 7 days

      // Add cookie to response
      response.addCookie(shopCookie);

      // Also set cookie using header for better control over SameSite attribute
      response.addHeader(
          "Set-Cookie",
          String.format(
              "%s=%s; Path=%s; Max-Age=%d; SameSite=Lax; %s",
              shopCookie.getName(),
              shopCookie.getValue(),
              shopCookie.getPath(),
              shopCookie.getMaxAge(),
              isProduction ? "Secure;" : ""));

      logger.info(
          "Cookie configuration: secure={}, path={}, SameSite=Lax",
          isProduction,
          shopCookie.getPath());

      // Always redirect with shop parameter as fallback
      String redirectUrl = frontendUrl + "/?shop=" + java.net.URLEncoder.encode(shop, "UTF-8");

      logger.info(
          "Cookie set successfully, redirecting to frontend with shop parameter: {}", redirectUrl);
      response.sendRedirect(redirectUrl);
    } catch (Exception e) {
      logger.error("Error in callback - Error details: {}", e.getMessage(), e);

      // Provide more specific error messages
      String errorMessage = "Authentication failed";
      if (e.getMessage().contains("API key")) {
        errorMessage = "Shopify API configuration error";
      } else if (e.getMessage().contains("access_token")) {
        errorMessage = "Failed to obtain access token from Shopify";
      } else if (e.getMessage().contains("network") || e.getMessage().contains("connection")) {
        errorMessage = "Network error during authentication";
      }

      // Return a proper error response instead of throwing
      response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
      response.setContentType("application/json");
      response
          .getWriter()
          .write(
              String.format(
                  "{\"error\": \"%s\", \"message\": \"%s\"}", errorMessage, e.getMessage()));
    }
  }

  private String generateState() {
    byte[] randomBytes = new byte[32];
    new java.security.SecureRandom().nextBytes(randomBytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
  }

  private boolean validateHmac(Map<String, String> params, String apiSecret) {
    try {
      // Remove hmac from params for validation
      Map<String, String> paramsForValidation = new HashMap<>(params);
      String receivedHmac = paramsForValidation.remove("hmac");

      if (receivedHmac == null) {
        return false;
      }

      // Sort parameters alphabetically
      String queryString =
          paramsForValidation.entrySet().stream()
              .sorted(Map.Entry.comparingByKey())
              .map(entry -> entry.getKey() + "=" + entry.getValue())
              .collect(Collectors.joining("&"));

      // Create HMAC using SHA256
      javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
      javax.crypto.spec.SecretKeySpec secretKeySpec =
          new javax.crypto.spec.SecretKeySpec(
              apiSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
      mac.init(secretKeySpec);

      byte[] hmacBytes = mac.doFinal(queryString.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder();
      for (byte b : hmacBytes) {
        sb.append(String.format("%02x", b));
      }
      String calculatedHmac = sb.toString();

      logger.debug(
          "HMAC validation - Query string: {}, Calculated HMAC: {}, Received HMAC: {}",
          queryString,
          calculatedHmac,
          receivedHmac);

      return calculatedHmac.equals(receivedHmac);
    } catch (Exception e) {
      logger.error("Error validating HMAC: {}", e.getMessage(), e);
      return false;
    }
  }

  private String exchangeCodeForAccessToken(String shop, String code) {
    logger.info(
        "Exchanging code for access token - shop: {}, code: {}",
        shop,
        code != null ? code.substring(0, Math.min(8, code.length())) + "..." : "null");
    logger.info(
        "Using API credentials - key: {}, secret: {}",
        apiKey != null ? apiKey.substring(0, Math.min(8, apiKey.length())) + "..." : "null",
        apiSecret != null
            ? apiSecret.substring(0, Math.min(8, apiSecret.length())) + "..."
            : "null");

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

    // Retry configuration
    int maxRetries = 3;
    int retryCount = 0;
    long retryDelayMs = 1000; // Start with 1 second

    while (retryCount < maxRetries) {
      try {
        logger.info("Token exchange attempt {} of {}", retryCount + 1, maxRetries);

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
                      "Shopify OAuth error - Status: {}, Body: {}",
                      ex.getStatusCode(),
                      responseBody);

                  // Provide more specific error messages based on the response
                  String errorMessage;
                  if (responseBody.contains(
                      "authorization code was not found or was already used")) {
                    errorMessage =
                        "Authorization code has already been used or has expired. Please try the installation process again.";
                  } else if (responseBody.contains("invalid_request")) {
                    errorMessage =
                        "Invalid OAuth request. Please check your Shopify app configuration.";
                  } else if (responseBody.contains("unauthorized_client")) {
                    errorMessage =
                        "Unauthorized client. Please check your Shopify API credentials.";
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
        retryCount++;
        String errorMessage = e.getMessage();

        // Check if it's a network connectivity issue
        boolean isNetworkError =
            errorMessage != null
                && (errorMessage.contains("Connection reset by peer")
                    || errorMessage.contains("Connection refused")
                    || errorMessage.contains("connect timed out")
                    || errorMessage.contains("read timed out")
                    || errorMessage.contains("Network is unreachable")
                    || errorMessage.contains("No route to host"));

        if (isNetworkError && retryCount < maxRetries) {
          logger.warn(
              "Network error during token exchange (attempt {} of {}): {}. Retrying in {} ms...",
              retryCount,
              maxRetries,
              errorMessage,
              retryDelayMs);

          try {
            Thread.sleep(retryDelayMs);
            retryDelayMs *= 2; // Exponential backoff
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Token exchange interrupted", ie);
          }
          continue;
        }

        // If it's not a network error or we've exhausted retries, throw the exception
        logger.error(
            "Error during token exchange for shop: {} (attempt {} of {})",
            shop,
            retryCount,
            maxRetries,
            e);

        if (isNetworkError) {
          throw new RuntimeException(
              "Network connectivity issue with Shopify servers. Please try again later.", e);
        } else {
          throw new RuntimeException(
              "Failed to exchange code for access token: " + e.getMessage(), e);
        }
      }
    }

    // This should never be reached, but just in case
    throw new RuntimeException(
        "Failed to exchange code for access token after " + maxRetries + " attempts");
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

    // If no token found with session ID, try to recover from database
    if (token == null && shop != null) {
      logger.warn(
          "Auth: No token with session ID, attempting recovery from database for shop: {}", shop);
      token = shopService.getTokenForShop(shop, "fallback");

      // If we found a token in database, refresh it in Redis with current session
      if (token != null && sessionId != null) {
        logger.info("Auth: Found token in database, refreshing session for shop: {}", shop);
        try {
          shopService.saveShop(shop, token, sessionId);
          logger.info("Auth: Session refreshed successfully for shop: {}", shop);
        } catch (Exception e) {
          logger.error("Auth: Failed to refresh session: {}", e.getMessage());
        }
      }
    }

    if (token == null) {
      logger.warn("Auth: No token found for shop: {} and session: {}", shop, sessionId);
      response.put("error", "Session expired - please re-authenticate");
      response.put("shop", null);
      response.put("reauth_url", "/api/auth/shopify/login?shop=" + shop);
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response));
    }

    logger.info("Auth: Found token for shop: {} and session: {}", shop, sessionId);
    response.put("shop", shop);
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
        logger.info("Auth: Session refreshed for shop: {} with session: {}", shop, sessionId);

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

      // Clear the shop cookie with the correct domain setting
      Cookie shopCookie = new Cookie("shop", "");
      shopCookie.setPath("/");
      shopCookie.setMaxAge(0);
      shopCookie.setHttpOnly(false);
      shopCookie.setSecure(true); // Use secure cookies in production
      response.addCookie(shopCookie);

      // Also add a Set-Cookie header to ensure the cookie is cleared
      String clearCookieHeader =
          "shop=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax";
      response.addHeader("Set-Cookie", clearCookieHeader);

      logger.info("Auth: Cleared shop cookie for: {}", shop);
    }

    return ResponseEntity.ok(Map.of("status", "success"));
  }

  @GetMapping("/test-credentials")
  public ResponseEntity<Map<String, Object>> testCredentials() {
    Map<String, Object> result = new HashMap<>();

    result.put("api_key_loaded", apiKey != null && !apiKey.isBlank());
    result.put("api_secret_loaded", apiSecret != null && !apiSecret.isBlank());
    result.put("api_key_length", apiKey != null ? apiKey.length() : 0);
    result.put("api_secret_length", apiSecret != null ? apiSecret.length() : 0);
    result.put(
        "api_key_preview",
        apiKey != null ? apiKey.substring(0, Math.min(8, apiKey.length())) + "..." : "null");
    result.put(
        "api_secret_preview",
        apiSecret != null
            ? apiSecret.substring(0, Math.min(8, apiSecret.length())) + "..."
            : "null");
    result.put("scopes", scopes);
    result.put("redirect_uri", redirectUri);
    result.put("frontend_url", frontendUrl);
    result.put("timestamp", System.currentTimeMillis());

    return ResponseEntity.ok(result);
  }

  @GetMapping("/test-cookie")
  public ResponseEntity<Map<String, Object>> testCookie(
      @CookieValue(value = "shop", required = false) String shop,
      HttpServletRequest request,
      HttpServletResponse response) {

    logger.info("Test cookie endpoint called");
    logger.info("Shop from cookie: {}", shop);
    logger.info("All cookies: {}", Arrays.toString(request.getCookies()));
    logger.info(
        "Request headers: {}",
        Collections.list(request.getHeaderNames()).stream()
            .collect(Collectors.toMap(name -> name, request::getHeader)));

    boolean isProduction = frontendUrl != null && frontendUrl.contains("onrender.com");

    Map<String, Object> result = new HashMap<>();
    result.put("shop_from_cookie", shop);
    result.put("is_production", isProduction);
    result.put("frontend_url", frontendUrl);
    result.put("user_agent", request.getHeader("User-Agent"));
    result.put("origin", request.getHeader("Origin"));
    result.put("referer", request.getHeader("Referer"));
    result.put(
        "all_cookies",
        request.getCookies() != null
            ? Arrays.stream(request.getCookies())
                .collect(Collectors.toMap(Cookie::getName, Cookie::getValue))
            : Collections.emptyMap());

    // Set a test cookie with proper domain configuration
    String testValue = "test_value_" + System.currentTimeMillis();

    if (isProduction) {
      // Production: Use Set-Cookie header with proper domain
      String setCookieHeader =
          String.format(
              "test_cookie=%s; Path=/; Max-Age=300; Domain=.onrender.com; Secure; SameSite=None",
              testValue);
      response.addHeader("Set-Cookie", setCookieHeader);
      result.put("cookie_domain", ".onrender.com");
      result.put("cookie_secure", true);
      result.put("cookie_samesite", "None");
      logger.info("Set production test cookie with header: {}", setCookieHeader);
    } else {
      // Development: Use regular cookie
      Cookie testCookie = new Cookie("test_cookie", testValue);
      testCookie.setPath("/");
      testCookie.setMaxAge(300);
      testCookie.setHttpOnly(false);
      testCookie.setSecure(false);
      response.addCookie(testCookie);
      result.put("cookie_domain", "localhost");
      result.put("cookie_secure", false);
      result.put("cookie_samesite", "Lax");
      logger.info("Set development test cookie for localhost");
    }

    result.put("test_cookie_set", true);
    result.put("test_cookie_value", testValue);
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

    // Clear cookie with the correct domain setting for Render
    response.addHeader(
        "Set-Cookie",
        "shop=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax");

    // Also clear without domain for localhost development
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

  @GetMapping("/debug-config")
  public ResponseEntity<Map<String, Object>> debugConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put(
        "apiKey",
        apiKey != null ? apiKey.substring(0, Math.min(8, apiKey.length())) + "..." : "null");
    config.put(
        "apiSecret",
        apiSecret != null
            ? apiSecret.substring(0, Math.min(8, apiSecret.length())) + "..."
            : "null");
    config.put("scopes", scopes);
    config.put("redirectUri", redirectUri);
    config.put("frontendUrl", frontendUrl);
    config.put("timestamp", System.currentTimeMillis());

    logger.info("Debug config requested: {}", config);
    return ResponseEntity.ok(config);
  }

  @GetMapping("/debug-callback-test")
  public ResponseEntity<Map<String, Object>> debugCallbackTest() {
    Map<String, Object> result = new HashMap<>();
    result.put("used_codes_count", getUsedCodesCount());
    result.put("used_codes_details", getUsedCodesDetails());
    result.put("current_time", System.currentTimeMillis());
    return ResponseEntity.ok(result);
  }

  @GetMapping("/debug-oauth-state")
  public ResponseEntity<Map<String, Object>> debugOauthState() {
    Map<String, Object> result = new HashMap<>();
    result.put("used_codes_count", getUsedCodesCount());
    result.put("used_codes_details", getUsedCodesDetails());
    result.put("current_time", System.currentTimeMillis());
    result.put("api_key_configured", apiKey != null && !apiKey.isBlank());
    result.put("api_secret_configured", apiSecret != null && !apiSecret.isBlank());
    result.put("redirect_uri", redirectUri);
    result.put("frontend_url", frontendUrl);

    // Add environment variable debugging
    result.put("env_frontend_url", System.getenv("FRONTEND_URL"));
    result.put(
        "env_shopify_api_key",
        System.getenv("SHOPIFY_API_KEY") != null ? "configured" : "not_configured");
    result.put(
        "env_shopify_api_secret",
        System.getenv("SHOPIFY_API_SECRET") != null ? "configured" : "not_configured");
    result.put("env_shopify_redirect_uri", System.getenv("SHOPIFY_REDIRECT_URI"));

    return ResponseEntity.ok(result);
  }

  @GetMapping("/debug-environment")
  public ResponseEntity<Map<String, Object>> debugEnvironment() {
    Map<String, Object> result = new HashMap<>();

    // Safe environment variables to expose (no secrets)
    result.put("FRONTEND_URL", System.getenv("FRONTEND_URL"));
    result.put("SHOPIFY_REDIRECT_URI", System.getenv("SHOPIFY_REDIRECT_URI"));
    result.put(
        "SHOPIFY_API_KEY_SET",
        System.getenv("SHOPIFY_API_KEY") != null && !System.getenv("SHOPIFY_API_KEY").isEmpty());
    result.put(
        "SHOPIFY_API_SECRET_SET",
        System.getenv("SHOPIFY_API_SECRET") != null
            && !System.getenv("SHOPIFY_API_SECRET").isEmpty());

    // Configuration values from application.properties
    result.put("config_frontend_url", frontendUrl);
    result.put("config_redirect_uri", redirectUri);
    result.put("config_api_key_set", apiKey != null && !apiKey.isEmpty());
    result.put("config_api_secret_set", apiSecret != null && !apiSecret.isEmpty());

    // Environment detection
    result.put("is_production", frontendUrl != null && frontendUrl.contains("onrender.com"));

    return ResponseEntity.ok(result);
  }
}
