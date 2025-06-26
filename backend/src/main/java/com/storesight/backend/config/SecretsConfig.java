package com.storesight.backend.config;

import com.storesight.backend.service.SecretService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SecretsConfig {
  private final SecretService secretService;
  private static final Logger log = LoggerFactory.getLogger(SecretsConfig.class);

  @Autowired
  public SecretsConfig(SecretService secretService) {
    this.secretService = secretService;
  }

  @PostConstruct
  public void init() {
    // Validate that required secrets are configured
    validateRequiredSecrets();
  }

  @PostConstruct
  public void initializeSecrets() {
    log.info("Initializing default secrets...");

    // SHOPIFY
    initializeSecret("shopify.client.id", "dummy_shopify_client_id");
    initializeSecret("shopify.client.secret", "dummy_shopify_client_secret");

    // JWT
    initializeSecret("jwt.secret.key", generateJwtSecret());

    // SERPAPI
    initializeSecret("serpapi.api.key", "dummy_serpapi_key");

    // SCRAPINGDOG API
    initializeSecret("scrapingdog.api.key", "dummy_scrapingdog_key");

    // SERPER API
    initializeSecret("serper.api.key", "dummy_serper_key");

    log.info("Default secrets initialization completed");
  }

  private void validateRequiredSecrets() {
    String[] requiredSecrets = {"shopify.api.key", "shopify.api.secret"};

    for (String secretKey : requiredSecrets) {
      if (secretService.getSecret(secretKey).isEmpty()) {
        System.err.println("[WARN] Required secret not configured: " + secretKey);
        System.err.println(
            "[INFO] Please set environment variable in Render: " + getEnvVarName(secretKey));
      }
    }
  }

  private String getEnvVarName(String secretKey) {
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
        return "SERPAPI_API_KEY";
      default:
        return secretKey.toUpperCase().replace(".", "_");
    }
  }

  public String getShopifyApiKey() {
    return secretService
        .getSecret("shopify.api.key")
        .orElseThrow(
            () ->
                new RuntimeException(
                    "Shopify API key not found - please set SHOPIFY_API_KEY environment variable"));
  }

  public String getShopifyApiSecret() {
    return secretService
        .getSecret("shopify.api.secret")
        .orElseThrow(
            () ->
                new RuntimeException(
                    "Shopify API secret not found - please set SHOPIFY_API_SECRET environment variable"));
  }

  public String getSendgridApiKey() {
    return secretService
        .getSecret("sendgrid.api.key")
        .orElseThrow(
            () ->
                new RuntimeException(
                    "SendGrid API key not found - please set SENDGRID_API_KEY environment variable"));
  }

  public String getTwilioAccountSid() {
    return secretService
        .getSecret("twilio.account.sid")
        .orElseThrow(
            () ->
                new RuntimeException(
                    "Twilio Account SID not found - please set TWILIO_ACCOUNT_SID environment variable"));
  }

  public String getTwilioAuthToken() {
    return secretService
        .getSecret("twilio.auth.token")
        .orElseThrow(
            () ->
                new RuntimeException(
                    "Twilio Auth Token not found - please set TWILIO_AUTH_TOKEN environment variable"));
  }

  public String getSerpApiKey() {
    return secretService
        .getSecret("serpapi.api.key")
        .orElseThrow(
            () ->
                new RuntimeException(
                    "SerpAPI key not found - please set SERPAPI_API_KEY environment variable"));
  }

  private void initializeSecret(String secretKey, String defaultValue) {
    secretService
        .getSecret(secretKey)
        .ifPresentOrElse(
            secret -> log.info("Secret {} already exists", secretKey),
            () -> {
              try {
                secretService.storeSecret(secretKey, defaultValue);
                log.info("Initialized secret: {}", secretKey);
              } catch (Exception e) {
                log.warn("Could not initialize secret {}: {}", secretKey, e.getMessage());
              }
            });
  }

  private String generateJwtSecret() {
    // Implementation of generateJwtSecret method
    return "dummy_jwt_secret_key";
  }
}
