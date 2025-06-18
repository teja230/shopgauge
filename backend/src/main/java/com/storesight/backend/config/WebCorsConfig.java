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
    config.addAllowedOrigin("http://localhost:3000"); // Alternative frontend port

    // Allow all methods
    config.addAllowedMethod("*");

    // Allow all headers
    config.addAllowedHeader("*");

    // Allow credentials
    config.setAllowCredentials(true);

    // Apply to all paths
    source.registerCorsConfiguration("/**", config);

    return new CorsFilter(source);
  }
}
