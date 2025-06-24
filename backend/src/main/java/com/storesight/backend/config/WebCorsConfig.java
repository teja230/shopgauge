package com.storesight.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class WebCorsConfig {

  @Bean
  public CorsFilter corsFilter() {
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    CorsConfiguration config = new CorsConfiguration();

    // Allow all origins for development
    config.addAllowedOrigin("http://localhost:5173"); // Frontend dev server
    config.addAllowedOrigin("http://localhost:3000"); // Alternative dev server
    
    // Allow Render static site domain
    config.addAllowedOriginPattern("https://*.onrender.com");
    config.addAllowedOrigin("https://storesight.onrender.com");
    
    // Allow Shopify domains for webhook/app installation
    config.addAllowedOriginPattern("https://*.myshopify.com");
    config.addAllowedOriginPattern("https://shopify.com");
    config.addAllowedOriginPattern("https://*.shopify.com");

    // Allow all methods
    config.addAllowedMethod("*");

    // Allow all headers
    config.addAllowedHeader("*");
    
    // Explicitly allow common headers
    config.addAllowedHeader("Content-Type");
    config.addAllowedHeader("Authorization");
    config.addAllowedHeader("X-Requested-With");
    config.addAllowedHeader("Accept");
    config.addAllowedHeader("Origin");
    config.addAllowedHeader("Access-Control-Request-Method");
    config.addAllowedHeader("Access-Control-Request-Headers");

    // Allow credentials for cookie support
    config.setAllowCredentials(true);
    
    // Set max age for preflight cache
    config.setMaxAge(3600L);

    // Apply to all paths
    source.registerCorsConfiguration("/**", config);

    return new CorsFilter(source);
  }
}
