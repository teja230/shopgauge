package com.storesight.backend.service;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Service for managing secrets using environment variables in production. Redis is still used for
 * other purposes like session persistence and Shopify tokens.
 */
@Service
public class SecretService {
  private final StringRedisTemplate redisTemplate;

  @Autowired
  public SecretService(StringRedisTemplate redisTemplate) {
    this.redisTemplate = redisTemplate;
  }

  /**
   * Get secret from environment variables. Secrets are managed by the hosting platform (Render)
   * environment variables.
   */
  public Optional<String> getSecret(String key) {
    // Map secret keys to environment variable names
    String envVarName = mapSecretKeyToEnvVar(key);
    String value = System.getenv(envVarName);
    return Optional.ofNullable(value);
  }

  /**
   * Store secret - in production, this should be done through Render's environment variables UI.
   * This method is kept for backward compatibility but logs a warning.
   */
  public void storeSecret(String key, String value) {
    System.out.println(
        "[WARN] storeSecret() called - secrets should be managed through Render environment variables in production");
    System.out.println(
        "[INFO] To set secret '"
            + key
            + "', add environment variable: "
            + mapSecretKeyToEnvVar(key));
  }

  /**
   * Delete secret - in production, this should be done through Render's environment variables UI.
   */
  public void deleteSecret(String key) {
    System.out.println(
        "[WARN] deleteSecret() called - secrets should be managed through Render environment variables in production");
    System.out.println(
        "[INFO] To delete secret '"
            + key
            + "', remove environment variable: "
            + mapSecretKeyToEnvVar(key));
  }

  /** List all configured secrets (returns keys only for security). */
  public Map<String, String> listSecrets() {
    Map<String, String> secrets = new HashMap<>();

    // Only return keys of secrets that are configured
    String[] secretKeys = {
      "shopify.api.key",
      "shopify.api.secret",
      "sendgrid.api.key",
      "twilio.account.sid",
      "twilio.auth.token",
      "serpapi.api.key",
      "scrapingdog.api.key",
      "serper.api.key"
    };

    for (String key : secretKeys) {
      if (getSecret(key).isPresent()) {
        secrets.put(key, "[CONFIGURED]"); // Don't return actual values for security
      }
    }

    return secrets;
  }

  /** Map secret keys to environment variable names. */
  private String mapSecretKeyToEnvVar(String secretKey) {
    switch (secretKey) {
      case "shopify.api.key":
        return "SHOPIFY_API_KEY";
      case "shopify.api.secret":
        return "SHOPIFY_API_SECRET";
      case "sendgrid.api.key":
        return "SENDGRID_API_KEY";
      case "twilio.account.sid":
        return "TWILIO_ACCOUNT_SID";
      case "twilio.auth.token":
        return "TWILIO_AUTH_TOKEN";
      case "serpapi.api.key":
        return "SERPAPI_KEY";
      case "scrapingdog.api.key":
        return "SCRAPINGDOG_KEY";
      case "serper.api.key":
        return "SERPER_KEY";
      default:
        // Convert dot notation to uppercase with underscores
        return secretKey.toUpperCase().replace(".", "_");
    }
  }

  // Redis methods for other purposes (session persistence, Shopify tokens, etc.)

  /** Store data in Redis (for non-secret data like sessions, tokens, etc.) */
  public void storeInRedis(String key, String value) {
    redisTemplate.opsForValue().set(key, value);
  }

  /** Get data from Redis (for non-secret data like sessions, tokens, etc.) */
  public Optional<String> getFromRedis(String key) {
    String value = redisTemplate.opsForValue().get(key);
    return Optional.ofNullable(value);
  }

  /** Delete data from Redis (for non-secret data like sessions, tokens, etc.) */
  public void deleteFromRedis(String key) {
    redisTemplate.delete(key);
  }
}
