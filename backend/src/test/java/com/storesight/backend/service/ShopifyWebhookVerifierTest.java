package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

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

  @ParameterizedTest(name = "verifies webhook payload {index}")
  @MethodSource("signedWebhookPayloads")
  void verifiesDistinctSignedPayloadsAndRejectsMutation(String secret, String body, String hmac) {
    ShopifyWebhookVerifier verifier = new ShopifyWebhookVerifier(secret);

    assertTrue(verifier.isValid(body, hmac));
    assertFalse(verifier.isValid(body + " ", hmac));
  }

  static Stream<Arguments> signedWebhookPayloads() {
    return IntStream.range(0, 100)
        .mapToObj(
            index -> {
              try {
                String secret = "webhook-secret-" + index;
                String body =
                    "{\"shop_domain\":\"merchant-"
                        + index
                        + ".myshopify.com\",\"customer_id\":"
                        + (1000 + index)
                        + "}";
                Mac mac = Mac.getInstance("HmacSHA256");
                mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
                String hmac =
                    Base64.getEncoder()
                        .encodeToString(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
                return Arguments.of(secret, body, hmac);
              } catch (Exception e) {
                throw new IllegalStateException(e);
              }
            });
  }
}
