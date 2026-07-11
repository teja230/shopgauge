package com.storesight.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ShopifyWebhookVerifier {
  private final byte[] secret;

  public ShopifyWebhookVerifier(@Value("${shopify.api.secret:}") String apiSecret) {
    this.secret = apiSecret.getBytes(StandardCharsets.UTF_8);
  }

  public boolean isValid(String rawBody, String providedHmac) {
    if (secret.length == 0 || providedHmac == null || providedHmac.isBlank()) return false;
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      byte[] expected = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
      byte[] provided = Base64.getDecoder().decode(providedHmac);
      return MessageDigest.isEqual(expected, provided);
    } catch (Exception ignored) {
      return false;
    }
  }
}
