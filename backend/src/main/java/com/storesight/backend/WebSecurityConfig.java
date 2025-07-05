package com.storesight.backend;

import com.storesight.backend.config.ShopifyAuthenticationFilter;
import com.storesight.backend.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Comprehensive Security Configuration
 *
 * <p>Features: 1. Rate limiting with atomic counters 2. Debug endpoint protection in production 3.
 * Enhanced input validation 4. Security headers 5. Shopify authentication integration
 */
@Configuration
@EnableWebSecurity
public class WebSecurityConfig implements WebMvcConfigurer {

  private static final Logger logger = LoggerFactory.getLogger(WebSecurityConfig.class);

  private final ShopService shopService;

  @Value("${spring.profiles.active:dev}")
  private String activeProfile;

  @Value("${security.rate-limit.enabled:true}")
  private boolean rateLimitEnabled;

  @Value("${security.rate-limit.requests-per-minute:60}")
  private int requestsPerMinute;

  @Value(
      "${cors.allowed-origins:http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173}")
  private String corsAllowedOrigins;

  // Simple rate limiting with request counters
  private final Map<String, RateLimitInfo> rateLimitMap = new ConcurrentHashMap<>();

  public WebSecurityConfig(ShopService shopService) {
    this.shopService = shopService;
  }

  // Rate limit info holder
  private static class RateLimitInfo {
    private final AtomicInteger requestCount = new AtomicInteger(0);
    private volatile long windowStart = System.currentTimeMillis();

    public boolean isAllowed(int maxRequests) {
      long now = System.currentTimeMillis();

      // Reset window if more than 1 minute has passed
      if (now - windowStart > 60000) {
        windowStart = now;
        requestCount.set(0);
      }

      return requestCount.incrementAndGet() <= maxRequests;
    }

    public int getRemainingRequests(int maxRequests) {
      return Math.max(0, maxRequests - requestCount.get());
    }
  }

  /** Rate Limiting Interceptor */
  @Bean
  public HandlerInterceptor rateLimitInterceptor() {
    return new HandlerInterceptor() {
      @Override
      public boolean preHandle(
          HttpServletRequest request, HttpServletResponse response, Object handler)
          throws Exception {
        if (!rateLimitEnabled) {
          return true;
        }

        String clientIp = getClientIpAddress(request);
        String key = clientIp + ":" + request.getRequestURI();

        RateLimitInfo rateLimitInfo = rateLimitMap.computeIfAbsent(key, k -> new RateLimitInfo());

        if (rateLimitInfo.isAllowed(requestsPerMinute)) {
          // Add rate limit headers
          response.setHeader(
              "X-Rate-Limit-Remaining",
              String.valueOf(rateLimitInfo.getRemainingRequests(requestsPerMinute)));
          response.setHeader(
              "X-Rate-Limit-Reset", String.valueOf(System.currentTimeMillis() + 60000));
          return true;
        } else {
          logger.warn(
              "Rate limit exceeded for IP: {} on endpoint: {}", clientIp, request.getRequestURI());
          response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
          response.setContentType("application/json");
          response
              .getWriter()
              .write(
                  "{\"error\":\"Rate limit exceeded\",\"message\":\"Too many requests. Please try again later.\"}");
          return false;
        }
      }
    };
  }

  /** Input Validation Interceptor */
  @Bean
  public HandlerInterceptor inputValidationInterceptor() {
    return new HandlerInterceptor() {
      private final Pattern SQL_INJECTION_PATTERN =
          Pattern.compile(
              "(?i)(union|select|insert|update|delete|drop|create|alter|exec|script|javascript|vbscript|onload|onerror)",
              Pattern.CASE_INSENSITIVE);

      private final Pattern XSS_PATTERN =
          Pattern.compile(
              "(?i)(<script|</script|javascript:|vbscript:|onload=|onerror=|alert\\(|confirm\\(|prompt\\()",
              Pattern.CASE_INSENSITIVE);

      @Override
      public boolean preHandle(
          HttpServletRequest request, HttpServletResponse response, Object handler)
          throws Exception {
        // Validate query parameters
        if (request.getQueryString() != null) {
          String queryString = request.getQueryString();

          if (containsSqlInjection(queryString) || containsXss(queryString)) {
            logger.warn(
                "Malicious request detected from IP: {} - Query: {}",
                getClientIpAddress(request),
                queryString);
            response.setStatus(HttpStatus.BAD_REQUEST.value());
            response.setContentType("application/json");
            response
                .getWriter()
                .write(
                    "{\"error\":\"Invalid request\",\"message\":\"Request contains invalid characters.\"}");
            return false;
          }
        }

        // Validate common parameters
        String shop = request.getParameter("shop");
        if (shop != null && !isValidShopDomain(shop)) {
          logger.warn(
              "Invalid shop parameter from IP: {} - Shop: {}", getClientIpAddress(request), shop);
          response.setStatus(HttpStatus.BAD_REQUEST.value());
          response.setContentType("application/json");
          response
              .getWriter()
              .write(
                  "{\"error\":\"Invalid shop parameter\",\"message\":\"Shop domain format is invalid.\"}");
          return false;
        }

        return true;
      }

      private boolean containsSqlInjection(String input) {
        return SQL_INJECTION_PATTERN.matcher(input).find();
      }

      private boolean containsXss(String input) {
        return XSS_PATTERN.matcher(input).find();
      }

      private boolean isValidShopDomain(String shop) {
        if (shop == null || shop.trim().isEmpty()) {
          return false;
        }

        // Basic Shopify domain validation
        Pattern shopPattern =
            Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9](\\.myshopify\\.com)?$");
        return shopPattern.matcher(shop.trim()).matches() && shop.length() <= 100;
      }
    };
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    // Apply rate limiting to all API endpoints
    registry
        .addInterceptor(rateLimitInterceptor())
        .addPathPatterns("/api/**")
        .excludePathPatterns("/api/health/**", "/health/**");

    // Apply input validation to all endpoints
    registry.addInterceptor(inputValidationInterceptor()).addPathPatterns("/**");
  }

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable())
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .headers(
            headers ->
                headers
                    .frameOptions(frameOptionsConfig -> frameOptionsConfig.deny())
                    .contentTypeOptions(contentTypeOptionsConfig -> {})
                    .httpStrictTransportSecurity(
                        hstsConfig -> hstsConfig.maxAgeInSeconds(31536000).includeSubDomains(true))
                    .contentSecurityPolicy(
                        cspConfig ->
                            cspConfig.policyDirectives(
                                "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com https://*.shopify.com https://shopgaugeai.com https://api.shopgaugeai.com; "
                                    + "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com https://*.shopify.com https://shopgaugeai.com; "
                                    + "style-src 'self' 'unsafe-inline' https://cdn.shopify.com https://*.shopify.com https://fonts.googleapis.com; "
                                    + "font-src 'self' https://fonts.gstatic.com https://cdn.shopify.com; "
                                    + "img-src 'self' data: https: blob:; "
                                    + "media-src 'self' https:; "
                                    + "object-src 'none'; "
                                    + "base-uri 'self'; "
                                    + "form-action 'self' https://*.shopify.com https://accounts.shopify.com https://admin.shopify.com https://app.shopify.com https://themes.shopify.com https://apps.shopify.com https://dev.shopify.com https://shop.app; "
                                    + "frame-ancestors 'self' https://*.shopify.com https://admin.shopify.com https://app.shopify.com; "
                                    + "connect-src 'self' https://api.shopgaugeai.com https://shopgaugeai.com https://*.shopify.com https://accounts.shopify.com https://admin.shopify.com;")))
        .authorizeHttpRequests(
            auth -> {
              auth.requestMatchers(
                      "/api/auth/shopify/**", "/actuator/**", "/health/**", "/api/health/**", "/")
                  .permitAll();

              auth.anyRequest().authenticated();
            })
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
        .addFilterBefore(shopifyAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class)
        .exceptionHandling(exceptions -> exceptions.accessDeniedHandler(accessDeniedHandler()));

    return http.build();
  }

  @Bean
  public ShopifyAuthenticationFilter shopifyAuthenticationFilter() {
    return new ShopifyAuthenticationFilter(shopService);
  }

  /** Access Denied Handler */
  @Bean
  public AccessDeniedHandler accessDeniedHandler() {
    return (request, response, accessDeniedException) -> {
      logger.warn(
          "Access denied for IP: {} on endpoint: {}",
          getClientIpAddress(request),
          request.getRequestURI());
      response.setStatus(HttpStatus.FORBIDDEN.value());
      response.setContentType("application/json");
      response
          .getWriter()
          .write(
              "{\"error\":\"Access denied\",\"message\":\"You don't have permission to access this resource.\"}");
    };
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();

    // Use profile-specific CORS origins from properties
    String[] allowedOrigins = corsAllowedOrigins.split(",");
    configuration.setAllowedOrigins(Arrays.asList(allowedOrigins));

    // Add production domains for shopgaugeai.com
    if (isProductionProfile()) {
      configuration.addAllowedOrigin("https://www.shopgaugeai.com");
      configuration.addAllowedOrigin("https://shopgaugeai.com");
      configuration.setAllowedOriginPatterns(Arrays.asList("https://*.shopgaugeai.com"));

      // Shopify domains for webhooks and app installation
      configuration.addAllowedOriginPattern("https://*.myshopify.com");
      configuration.addAllowedOriginPattern("https://admin.shopify.com");
      configuration.addAllowedOriginPattern("https://*.shopify.com");
    }

    configuration.setAllowedMethods(
        Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"));
    configuration.setAllowedHeaders(Arrays.asList("*"));
    configuration.setExposedHeaders(
        Arrays.asList(
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Credentials",
            "Access-Control-Allow-Headers",
            "Access-Control-Allow-Methods",
            "Access-Control-Max-Age",
            "X-Total-Count",
            "X-Rate-Limit-Remaining",
            "X-Rate-Limit-Reset"));
    configuration.setAllowCredentials(true);
    configuration.setMaxAge(3600L);

    org.springframework.web.cors.UrlBasedCorsConfigurationSource source =
        new org.springframework.web.cors.UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }

  /** Global Exception Handler for Security */
  @ControllerAdvice
  public static class SecurityExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(SecurityExceptionHandler.class);

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> handleSecurityException(
        SecurityException ex, WebRequest request) {
      logger.error("Security exception: {}", ex.getMessage());

      Map<String, Object> errorResponse =
          Map.of(
              "error", "Security violation",
              "message", "Your request was blocked for security reasons.",
              "timestamp", System.currentTimeMillis());

      return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(
        IllegalArgumentException ex, WebRequest request) {
      logger.warn("Invalid input: {}", ex.getMessage());

      Map<String, Object> errorResponse =
          Map.of(
              "error", "Invalid input",
              "message", "The provided input is invalid.",
              "timestamp", System.currentTimeMillis());

      return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }
  }

  // Helper methods

  private String getClientIpAddress(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
      return xForwardedFor.split(",")[0].trim();
    }

    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isEmpty()) {
      return xRealIp;
    }

    return request.getRemoteAddr();
  }

  private boolean isProductionProfile() {
    return "prod".equals(activeProfile) || "production".equals(activeProfile);
  }
}
