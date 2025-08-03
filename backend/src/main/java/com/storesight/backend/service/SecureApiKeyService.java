package com.storesight.backend.service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Secure API key management service for external providers Handles encryption/decryption of API
 * keys and provides secure access
 */
@Service
public class SecureApiKeyService {

  private static final Logger logger = LoggerFactory.getLogger(SecureApiKeyService.class);

  @Autowired private DataEncryptionService encryptionService;

  // Cache for decrypted keys to avoid repeated decryption
  private final Map<String, String> keyCache = new ConcurrentHashMap<>();

  // External API keys from configuration
  @Value("${external.api.serpapi.key:}")
  private String serpApiKey;

  @Value("${external.api.serper.key:}")
  private String serperKey;

  @Value("${external.api.scrapingdog.key:}")
  private String scrapingdogKey;

  @Value("${external.api.sendgrid.key:}")
  private String sendgridKey;

  @Value("${external.api.twilio.sid:}")
  private String twilioSid;

  @Value("${external.api.twilio.token:}")
  private String twilioToken;

  /** Get API key for a specific provider */
  public String getApiKey(String provider) {
    if (provider == null || provider.trim().isEmpty()) {
      throw new IllegalArgumentException("Provider name cannot be null or empty");
    }

    String normalizedProvider = provider.toLowerCase().trim();

    // Check cache first
    String cachedKey = keyCache.get(normalizedProvider);
    if (cachedKey != null) {
      return cachedKey;
    }

    String rawKey = getRawApiKey(normalizedProvider);
    if (rawKey == null || rawKey.trim().isEmpty()) {
      logger.warn("No API key configured for provider: {}", provider);
      return null;
    }

    String decryptedKey;
    if (encryptionService.isEncrypted(rawKey)) {
      // Decrypt the key
      decryptedKey = encryptionService.decrypt(rawKey);
      logger.debug("Decrypted API key for provider: {}", provider);
    } else {
      // Key is not encrypted (development mode)
      decryptedKey = rawKey;
      logger.debug(
          "Using plain text API key for provider: {} (consider encrypting for production)",
          provider);
    }

    // Cache the decrypted key
    keyCache.put(normalizedProvider, decryptedKey);

    return decryptedKey;
  }

  /** Check if API key is available for a provider */
  public boolean hasApiKey(String provider) {
    String key = getApiKey(provider);
    return key != null && !key.trim().isEmpty();
  }

  /** Get all available providers */
  public Map<String, Boolean> getProviderStatus() {
    Map<String, Boolean> status = new HashMap<>();

    status.put("serpapi", hasApiKey("serpapi"));
    status.put("serper", hasApiKey("serper"));
    status.put("scrapingdog", hasApiKey("scrapingdog"));
    status.put("sendgrid", hasApiKey("sendgrid"));
    status.put("twilio", hasApiKey("twilio"));

    return status;
  }

  /** Encrypt and store an API key (for administrative use) */
  public String encryptApiKey(String plainKey) {
    if (plainKey == null || plainKey.trim().isEmpty()) {
      throw new IllegalArgumentException("API key cannot be null or empty");
    }

    return encryptionService.encrypt(plainKey.trim());
  }

  /** Clear the key cache (useful for key rotation) */
  public void clearCache() {
    keyCache.clear();
    logger.info("API key cache cleared");
  }

  /** Clear cache for a specific provider */
  public void clearCache(String provider) {
    if (provider != null) {
      keyCache.remove(provider.toLowerCase().trim());
      logger.info("API key cache cleared for provider: {}", provider);
    }
  }

  /** Validate API key format for a provider */
  public boolean isValidKeyFormat(String provider, String key) {
    if (key == null || key.trim().isEmpty()) {
      return false;
    }

    String normalizedProvider = provider.toLowerCase().trim();
    String trimmedKey = key.trim();

    return switch (normalizedProvider) {
      case "serpapi" -> trimmedKey.length() >= 32; // SerpAPI keys are typically 32+ chars
      case "serper" -> trimmedKey.length() >= 32; // Serper keys are typically 32+ chars
      case "scrapingdog" -> trimmedKey.length() >= 16; // ScrapingDog keys vary
      case "sendgrid" -> trimmedKey.startsWith("SG."); // SendGrid keys start with SG.
      case "twilio" -> trimmedKey.length() >= 32; // Twilio tokens are 32+ chars
      default -> trimmedKey.length() >= 8; // Generic minimum length
    };
  }

  /** Get raw API key from configuration */
  private String getRawApiKey(String provider) {
    return switch (provider) {
      case "serpapi" -> serpApiKey;
      case "serper" -> serperKey;
      case "scrapingdog" -> scrapingdogKey;
      case "sendgrid" -> sendgridKey;
      case "twilio" -> twilioSid + ":" + twilioToken; // Combined for Twilio
      default -> null;
    };
  }
}
