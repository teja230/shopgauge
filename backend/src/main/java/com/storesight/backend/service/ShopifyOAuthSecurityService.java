package com.storesight.backend.service;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class ShopifyOAuthSecurityService {
  private static final Duration STATE_TTL = Duration.ofMinutes(10);
  private static final String STATE_PREFIX = "oauth:state:";
  private static final String RETURN_URL_PREFIX = "oauth:return_url:";

  private final StringRedisTemplate redisTemplate;
  private final SecureRandom secureRandom = new SecureRandom();
  private final URI frontendUri;

  public ShopifyOAuthSecurityService(
      StringRedisTemplate redisTemplate, @Value("${frontend.url}") String frontendUrl) {
    this.redisTemplate = redisTemplate;
    this.frontendUri = URI.create(frontendUrl);
  }

  public String createState(String shop, String requestedReturnUrl) {
    String state = generateState();
    String normalizedReturnUrl = normalizeReturnUrl(requestedReturnUrl);
    redisTemplate.opsForValue().set(STATE_PREFIX + state, shop, STATE_TTL);
    if (normalizedReturnUrl != null) {
      redisTemplate.opsForValue().set(RETURN_URL_PREFIX + state, normalizedReturnUrl, STATE_TTL);
    }
    return state;
  }

  public OAuthState consumeState(String state, String callbackShop) {
    if (state == null || state.isBlank()) {
      throw new SecurityException("OAuth state is required");
    }
    String expectedShop = redisTemplate.opsForValue().getAndDelete(STATE_PREFIX + state);
    String returnUrl = redisTemplate.opsForValue().getAndDelete(RETURN_URL_PREFIX + state);
    if (expectedShop == null
        || !MessageDigest.isEqual(
            expectedShop.getBytes(StandardCharsets.UTF_8),
            callbackShop.getBytes(StandardCharsets.UTF_8))) {
      throw new SecurityException("OAuth state is invalid or expired");
    }
    return new OAuthState(expectedShop, returnUrl);
  }

  public boolean verifyHmac(Map<String, String> params, String apiSecret) {
    if (apiSecret == null || apiSecret.isBlank()) return false;
    try {
      Map<String, String> canonicalParams = new HashMap<>(params);
      String receivedHmac = canonicalParams.remove("hmac");
      canonicalParams.remove("signature");
      if (receivedHmac == null || !receivedHmac.matches("[0-9a-fA-F]{64}")) return false;

      String message =
          canonicalParams.entrySet().stream()
              .sorted(Map.Entry.comparingByKey())
              .map(entry -> entry.getKey() + "=" + entry.getValue())
              .collect(Collectors.joining("&"));
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(apiSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] calculated = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
      byte[] received = java.util.HexFormat.of().parseHex(receivedHmac);
      return MessageDigest.isEqual(calculated, received);
    } catch (Exception ignored) {
      return false;
    }
  }

  public String normalizeReturnUrl(String requestedReturnUrl) {
    if (requestedReturnUrl == null || requestedReturnUrl.isBlank()) return null;
    URI requested = URI.create(requestedReturnUrl.trim()).normalize();
    if (!requested.isAbsolute()) {
      if (!requested.getPath().startsWith("/") || requested.getPath().startsWith("//")) {
        throw new IllegalArgumentException("return_url must be an application-relative path");
      }
      return frontendUri.resolve(requested).toString();
    }
    boolean trustedOrigin =
        "https".equalsIgnoreCase(requested.getScheme())
            && frontendUri.getHost().equalsIgnoreCase(requested.getHost())
            && effectivePort(frontendUri) == effectivePort(requested);
    boolean localDevelopment =
        "http".equalsIgnoreCase(requested.getScheme())
            && "localhost".equalsIgnoreCase(requested.getHost())
            && "localhost".equalsIgnoreCase(frontendUri.getHost())
            && effectivePort(frontendUri) == effectivePort(requested);
    if (!trustedOrigin && !localDevelopment) {
      throw new IllegalArgumentException("return_url origin is not allowed");
    }
    return requested.toString();
  }

  private int effectivePort(URI uri) {
    if (uri.getPort() >= 0) return uri.getPort();
    return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
  }

  private String generateState() {
    byte[] randomBytes = new byte[32];
    secureRandom.nextBytes(randomBytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
  }

  public record OAuthState(String shop, String returnUrl) {}
}
