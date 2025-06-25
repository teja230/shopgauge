package com.storesight.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class WebCorsConfig {

  private static final Logger logger = LoggerFactory.getLogger(WebCorsConfig.class);

  @Value("${frontend.url:http://localhost:5173}")
  private String frontendUrl;

  @Bean
  public CorsFilter corsFilter() {
    logger.info("Configuring CORS with frontend URL: {}", frontendUrl);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    CorsConfiguration config = new CorsConfiguration();

    // Production-grade CORS configuration
    boolean isProduction = frontendUrl != null && frontendUrl.contains("shopgaugeai.com");

    if (isProduction) {
      // Production domains - explicit and comprehensive
      config.addAllowedOrigin("https://www.shopgaugeai.com");
      config.addAllowedOrigin("https://shopgaugeai.com");
      config.addAllowedOriginPattern("https://*.shopgaugeai.com");

      // Shopify domains for webhooks and app installation
      config.addAllowedOriginPattern("https://*.myshopify.com");
      config.addAllowedOriginPattern("https://admin.shopify.com");
      config.addAllowedOriginPattern("https://*.shopify.com");

      logger.info("Production CORS configured for shopgaugeai.com domains");
    } else {
      // Development domains
      config.addAllowedOrigin("http://localhost:5173");
      config.addAllowedOrigin("http://localhost:5174");
      config.addAllowedOrigin("http://localhost:3000");
      config.addAllowedOrigin("http://127.0.0.1:5173");

      logger.info("Development CORS configured for localhost");
    }

    // HTTP methods - comprehensive for enterprise API
    config.addAllowedMethod("GET");
    config.addAllowedMethod("POST");
    config.addAllowedMethod("PUT");
    config.addAllowedMethod("DELETE");
    config.addAllowedMethod("OPTIONS");
    config.addAllowedMethod("PATCH");
    config.addAllowedMethod("HEAD");

    // Headers - enterprise-grade security headers
    config.addAllowedHeader("*");
    config.addExposedHeader("Access-Control-Allow-Origin");
    config.addExposedHeader("Access-Control-Allow-Credentials");
    config.addExposedHeader("Access-Control-Allow-Headers");
    config.addExposedHeader("Access-Control-Allow-Methods");
    config.addExposedHeader("Access-Control-Max-Age");
    config.addExposedHeader("X-Total-Count");
    config.addExposedHeader("X-Rate-Limit-Remaining");
    config.addExposedHeader("X-Rate-Limit-Reset");

    // Security settings
    config.setAllowCredentials(true);
    config.setMaxAge(3600L); // 1 hour preflight cache

    // Apply to all API paths
    source.registerCorsConfiguration("/api/**", config);
    source.registerCorsConfiguration("/actuator/**", config);

    // Additional configuration for auth endpoints
    CorsConfiguration authConfig = new CorsConfiguration(config);
    authConfig.setMaxAge(86400L); // 24 hours for auth endpoints
    source.registerCorsConfiguration("/api/auth/**", authConfig);

    logger.info("CORS filter configured successfully");
    return new CorsFilter(source);
  }
}
