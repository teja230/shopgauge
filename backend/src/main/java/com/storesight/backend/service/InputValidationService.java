package com.storesight.backend.service;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Enhanced input validation service for competitor management Provides comprehensive validation and
 * sanitization of user inputs
 */
@Service
public class InputValidationService {

  private static final Logger logger = LoggerFactory.getLogger(InputValidationService.class);

  // Enhanced URL validation patterns - more permissive for real-world URLs
  private static final Pattern VALID_URL_PATTERN =
      Pattern.compile(
          "^https?://[a-zA-Z0-9]([a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?\\.[a-zA-Z]{2,}(/.*)?$",
          Pattern.CASE_INSENSITIVE);

  // Enhanced competitor URL patterns (major e-commerce platforms)
  private static final Pattern AMAZON_URL_PATTERN =
      Pattern.compile(
          "^https?://(?:www\\.)?(?:amazon\\.[a-z]{2,3}(?:\\.[a-z]{2})?|a\\.co)/.*", Pattern.CASE_INSENSITIVE);

  private static final Pattern SHOPIFY_URL_PATTERN =
      Pattern.compile(
          "^https?://[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9]\\.myshopify\\.com.*",
          Pattern.CASE_INSENSITIVE);

  private static final Pattern ETSY_URL_PATTERN =
      Pattern.compile("^https?://(?:www\\.)?etsy\\.com/.*", Pattern.CASE_INSENSITIVE);

  // Additional major e-commerce platforms
  private static final Pattern WALMART_URL_PATTERN =
      Pattern.compile("^https?://(?:www\\.)?walmart\\.com/.*", Pattern.CASE_INSENSITIVE);

  private static final Pattern TARGET_URL_PATTERN =
      Pattern.compile("^https?://(?:www\\.)?target\\.com/.*", Pattern.CASE_INSENSITIVE);

  private static final Pattern BESTBUY_URL_PATTERN =
      Pattern.compile("^https?://(?:www\\.)?bestbuy\\.com/.*", Pattern.CASE_INSENSITIVE);

  private static final Pattern EBAY_URL_PATTERN =
      Pattern.compile("^https?://(?:www\\.)?ebay\\.com/.*", Pattern.CASE_INSENSITIVE);

  private static final Pattern WOOCOMMERCE_URL_PATTERN =
      Pattern.compile(
          "^https?://[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9]\\.[a-zA-Z]{2,}/.*",
          Pattern.CASE_INSENSITIVE);

  // Security patterns
  private static final Pattern SQL_INJECTION_PATTERN =
      Pattern.compile(
          "(?i)(union|select|insert|update|delete|drop|create|alter|exec|script|javascript|vbscript|onload|onerror)",
          Pattern.CASE_INSENSITIVE);

  private static final Pattern XSS_PATTERN =
      Pattern.compile(
          "(?i)(<script|</script|javascript:|vbscript:|onload=|onerror=|alert\\(|confirm\\(|prompt\\()",
          Pattern.CASE_INSENSITIVE);

  // Label validation
  private static final Pattern VALID_LABEL_PATTERN = Pattern.compile("^[a-zA-Z0-9\\s\\-_.,()&]+$");

  /** Enhanced validate competitor URL with better error messages */
  public ValidationResult validateCompetitorUrl(String url) {
    if (url == null || url.trim().isEmpty()) {
      return ValidationResult.invalid("Please enter a competitor URL");
    }

    String trimmedUrl = url.trim();

    // Check for security threats
    if (containsSqlInjection(trimmedUrl) || containsXss(trimmedUrl)) {
      logger.warn("Malicious URL detected: {}", trimmedUrl);
      return ValidationResult.invalid("URL contains invalid characters");
    }

    // Enhanced URL format validation - more permissive
    if (!isValidUrlFormat(trimmedUrl)) {
      return ValidationResult.invalid(
          "Please enter a valid URL (e.g., https://www.amazon.com/product)");
    }

    // Validate URL structure
    try {
      URL urlObj = new URL(trimmedUrl);

      // Check protocol
      if (!"http".equals(urlObj.getProtocol()) && !"https".equals(urlObj.getProtocol())) {
        return ValidationResult.invalid("Only HTTP and HTTPS URLs are allowed");
      }

      // Check for localhost or private IPs
      String host = urlObj.getHost().toLowerCase();
      if (isLocalOrPrivateHost(host)) {
        return ValidationResult.invalid("Cannot track internal or localhost URLs");
      }

      // Determine platform with enhanced detection
      String platform = detectPlatform(trimmedUrl);

      if ("unsupported".equals(platform)) {
        return ValidationResult.invalid(
            "Unsupported platform. We support: Amazon, Walmart, Target, Best Buy, eBay, Shopify stores, and other e-commerce sites");
      }

      return ValidationResult.valid(trimmedUrl, platform);

    } catch (MalformedURLException e) {
      return ValidationResult.invalid("Invalid URL format. Please check the URL and try again");
    }
  }

  /** Enhanced URL format validation - more permissive for real-world URLs */
  private boolean isValidUrlFormat(String url) {
    // Basic check for http/https and domain structure
    if (!url.matches("^https?://.*")) {
      return false;
    }

    // Length check
    if (url.length() > 2000) {
      return false;
    }

    // More permissive domain validation
    try {
      URL urlObj = new URL(url);
      String host = urlObj.getHost();

      // Must have a host
      if (host == null || host.trim().isEmpty()) {
        return false;
      }

      // Host must contain at least one dot and have valid characters
      if (!host.contains(".") || host.length() < 3) {
        return false;
      }

      // Check for valid host characters
      if (!host.matches("^[a-zA-Z0-9][a-zA-Z0-9\\-.]*[a-zA-Z0-9]$")) {
        return false;
      }

      return true;
    } catch (MalformedURLException e) {
      return false;
    }
  }

  /** Validate competitor label */
  public ValidationResult validateCompetitorLabel(String label) {
    if (label == null || label.trim().isEmpty()) {
      return ValidationResult.invalid("Label cannot be empty");
    }

    String trimmedLabel = label.trim();

    // Check length
    if (trimmedLabel.length() > 100) {
      return ValidationResult.invalid("Label cannot exceed 100 characters");
    }

    // Check for security threats
    if (containsSqlInjection(trimmedLabel) || containsXss(trimmedLabel)) {
      logger.warn("Malicious label detected: {}", trimmedLabel);
      return ValidationResult.invalid("Label contains invalid characters");
    }

    // Check pattern
    if (!VALID_LABEL_PATTERN.matcher(trimmedLabel).matches()) {
      return ValidationResult.invalid(
          "Label contains invalid characters. Only letters, numbers, spaces, and basic punctuation are allowed");
    }

    return ValidationResult.valid(trimmedLabel, null);
  }

  /** Sanitize text input */
  public String sanitizeText(String input) {
    if (input == null) {
      return null;
    }

    return input
        .trim()
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#x27;")
        .replaceAll("&", "&amp;");
  }

  /** Validate shop domain */
  public boolean isValidShopDomain(String shopDomain) {
    if (shopDomain == null || shopDomain.trim().isEmpty()) {
      return false;
    }

    String trimmed = shopDomain.trim();

    // Check for security threats
    if (containsSqlInjection(trimmed) || containsXss(trimmed)) {
      return false;
    }

    // Shopify domain pattern
    Pattern shopPattern =
        Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9](\\.myshopify\\.com)?$");

    return shopPattern.matcher(trimmed).matches() && trimmed.length() <= 100;
  }

  /** Enhanced platform detection with more supported sites */
  private String detectPlatform(String url) {
    String lowerUrl = url.toLowerCase();

    if (AMAZON_URL_PATTERN.matcher(url).matches()) {
      return "amazon";
    } else if (WALMART_URL_PATTERN.matcher(url).matches()) {
      return "walmart";
    } else if (TARGET_URL_PATTERN.matcher(url).matches()) {
      return "target";
    } else if (BESTBUY_URL_PATTERN.matcher(url).matches()) {
      return "bestbuy";
    } else if (EBAY_URL_PATTERN.matcher(url).matches()) {
      return "ebay";
    } else if (SHOPIFY_URL_PATTERN.matcher(url).matches()) {
      return "shopify";
    } else if (ETSY_URL_PATTERN.matcher(url).matches()) {
      return "etsy";
    } else if (WOOCOMMERCE_URL_PATTERN.matcher(url).matches()) {
      // Additional check for WooCommerce indicators
      if (lowerUrl.contains("wp-content")
          || lowerUrl.contains("woocommerce")
          || lowerUrl.contains("product")
          || lowerUrl.contains("shop")) {
        return "woocommerce";
      }
    }

    // Check for other common e-commerce indicators
    if (lowerUrl.contains("product")
        || lowerUrl.contains("item")
        || lowerUrl.contains("buy")
        || lowerUrl.contains("shop")
        || lowerUrl.contains("store")
        || lowerUrl.contains("cart")) {
      return "other";
    }

    return "unsupported";
  }

  /** Check for SQL injection patterns */
  private boolean containsSqlInjection(String input) {
    return SQL_INJECTION_PATTERN.matcher(input).find();
  }

  /** Check for XSS patterns */
  private boolean containsXss(String input) {
    return XSS_PATTERN.matcher(input).find();
  }

  /** Check if host is localhost or private IP */
  private boolean isLocalOrPrivateHost(String host) {
    return host.equals("localhost")
        || host.equals("127.0.0.1")
        || host.equals("0.0.0.0")
        || host.startsWith("192.168.")
        || host.startsWith("10.")
        || host.startsWith("172.16.")
        || host.startsWith("172.17.")
        || host.startsWith("172.18.")
        || host.startsWith("172.19.")
        || host.startsWith("172.2")
        || host.startsWith("172.30.")
        || host.startsWith("172.31.");
  }

  /** Validation result class */
  public static class ValidationResult {
    private final boolean valid;
    private final String value;
    private final String platform;
    private final String errorMessage;

    private ValidationResult(boolean valid, String value, String platform, String errorMessage) {
      this.valid = valid;
      this.value = value;
      this.platform = platform;
      this.errorMessage = errorMessage;
    }

    public static ValidationResult valid(String value, String platform) {
      return new ValidationResult(true, value, platform, null);
    }

    public static ValidationResult invalid(String errorMessage) {
      return new ValidationResult(false, null, null, errorMessage);
    }

    public boolean isValid() {
      return valid;
    }

    public String getValue() {
      return value;
    }

    public String getPlatform() {
      return platform;
    }

    public String getErrorMessage() {
      return errorMessage;
    }
  }
}
