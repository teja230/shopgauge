package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;

class ShopifyOAuthSecurityServiceTest {
  private ShopifyOAuthSecurityService service;

  @BeforeEach
  void setUp() {
    service =
        new ShopifyOAuthSecurityService(
            mock(StringRedisTemplate.class), "https://www.shopgaugeai.com");
  }

  @Test
  void acceptsOnlyApplicationReturnUrls() {
    assertEquals(
        "https://www.shopgaugeai.com/dashboard?tab=prices",
        service.normalizeReturnUrl("/dashboard?tab=prices"));
    assertThrows(
        IllegalArgumentException.class,
        () -> service.normalizeReturnUrl("https://attacker.example/steal"));
    assertThrows(IllegalArgumentException.class, () -> service.normalizeReturnUrl("//evil.test"));
  }

  @Test
  void verifiesCanonicalShopifyHmacAndRejectsTampering() throws Exception {
    String secret = "oauth-test-secret";
    Map<String, String> params = new HashMap<>();
    params.put("code", "authorization-code");
    params.put("shop", "merchant.myshopify.com");
    params.put("timestamp", "1700000000");
    String message = "code=authorization-code&shop=merchant.myshopify.com&timestamp=1700000000";
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    params.put(
        "hmac", HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8))));

    assertTrue(service.verifyHmac(params, secret));
    params.put("shop", "other.myshopify.com");
    assertFalse(service.verifyHmac(params, secret));
  }
}
