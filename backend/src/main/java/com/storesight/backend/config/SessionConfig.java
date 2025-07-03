package com.storesight.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
@Profile("!test")
@EnableRedisHttpSession(
    maxInactiveIntervalInSeconds = 14400, // 4 hours (aligned with business app standards)
    redisNamespace = "storesight:sessions")
public class SessionConfig {

  private static final Logger logger = LoggerFactory.getLogger(SessionConfig.class);

  @Value("${spring.profiles.active:dev}")
  private String activeProfile;

  @Bean
  public CookieSerializer cookieSerializer() {
    DefaultCookieSerializer serializer = new DefaultCookieSerializer();
    serializer.setCookieName("SESSION");
    serializer.setUseHttpOnlyCookie(true);
    serializer.setSameSite("Lax");
    serializer.setUseSecureCookie(isProduction());
    serializer.setCookiePath("/");

    // Set domain for production to work across subdomains
    if (isProduction()) {
      serializer.setDomainName("shopgaugeai.com");
      logger.info("Session cookie configured for production domain: shopgaugeai.com");
    } else {
      logger.info("Session cookie configured for development");
    }

    return serializer;
  }

  private boolean isProduction() {
    return "prod".equals(activeProfile) || "production".equals(activeProfile);
  }
}
