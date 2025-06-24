package com.storesight.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  private static final Logger logger = LoggerFactory.getLogger(WebConfig.class);

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    logger.info("Configuring CORS");
    registry
        .addMapping("/**")
        .allowedOrigins(
            "http://localhost:5173", // Frontend dev server
            "http://localhost:5174", // Alternative dev port
            "https://storesight.onrender.com" // Production frontend
            )
        .allowedOriginPatterns("https://*.onrender.com") // Allow all Render subdomains
        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .allowCredentials(true)
        .maxAge(3600);
    logger.info("CORS configured for localhost and production URLs");
  }
}
