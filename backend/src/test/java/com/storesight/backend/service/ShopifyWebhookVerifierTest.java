package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class ShopifyWebhookVerifierTest {
  @Test
  void verifiesTheExactRawRequestBody() throws Exception {
    String secret = "webhook-secret";
    String body = "{\"shop_domain\":\"merchant.myshopify.com\"}";
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String hmac =
        Base64.getEncoder().encodeToString(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    ShopifyWebhookVerifier verifier = new ShopifyWebhookVerifier(secret);

    assertTrue(verifier.isValid(body, hmac));
    assertFalse(verifier.isValid(body + " ", hmac));
    assertFalse(verifier.isValid(body, "not-base64"));
  }
}
