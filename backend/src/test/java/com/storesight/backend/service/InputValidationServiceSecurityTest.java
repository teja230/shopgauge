package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class InputValidationServiceSecurityTest {
  private final InputValidationService service = new InputValidationService();

  @Test
  void blocksUnencryptedAndPrivateOutboundTargets() {
    assertFalse(service.validateCompetitorUrl("http://example.com/product/1").isValid());
    assertFalse(service.validateCompetitorUrl("https://127.0.0.1/product/1").isValid());
    assertFalse(
        service.validateCompetitorUrl("https://metadata.google.internal/product").isValid());
    assertThrows(
        IllegalArgumentException.class,
        () -> service.requireSafeOutboundUrl("https://192.168.1.20/product"));
  }

  @ParameterizedTest(name = "accepts Shopify domain {0}")
  @MethodSource("validShopDomains")
  void acceptsValidShopDomains(String domain) {
    assertTrue(service.isValidShopDomain(domain));
  }

  @ParameterizedTest(name = "rejects malformed Shopify domain {0}")
  @MethodSource("invalidShopDomains")
  void rejectsInvalidShopDomains(String domain) {
    assertFalse(service.isValidShopDomain(domain));
  }

  @ParameterizedTest(name = "accepts safe competitor label {0}")
  @MethodSource("validLabels")
  void acceptsSafeLabels(String label) {
    assertTrue(service.validateCompetitorLabel(label).isValid());
  }

  @ParameterizedTest(name = "rejects unsafe competitor label {0}")
  @MethodSource("invalidLabels")
  void rejectsUnsafeLabels(String label) {
    assertFalse(service.validateCompetitorLabel(label).isValid());
  }

  @ParameterizedTest(name = "sanitizes text payload {0}")
  @MethodSource("unsafeTextPayloads")
  void sanitizesUnsafeText(String payload) {
    String sanitized = service.sanitizeText(payload);
    assertNotNull(sanitized);
    assertFalse(sanitized.contains("<"));
    assertFalse(sanitized.contains(">"));
    assertFalse(sanitized.contains("\""));
    assertFalse(sanitized.contains("'"));
  }

  static Stream<String> validShopDomains() {
    return IntStream.range(0, 100)
        .mapToObj(
            index -> index % 2 == 0 ? "merchant-" + index : "merchant-" + index + ".myshopify.com");
  }

  static Stream<String> invalidShopDomains() {
    return IntStream.range(0, 25)
        .boxed()
        .flatMap(
            index ->
                Stream.of(
                    "-merchant" + index,
                    "merchant" + index + "-",
                    "merchant_" + index,
                    "merchant " + index));
  }

  static Stream<String> validLabels() {
    return IntStream.range(0, 50).mapToObj(index -> "Competitor " + index + " & Co. (US)");
  }

  static Stream<String> invalidLabels() {
    return IntStream.range(0, 25)
        .boxed()
        .flatMap(
            index ->
                Stream.of(
                    "<script>alert(" + index + ")</script>",
                    "Competitor@" + index,
                    "name onerror=alert(" + index + ")",
                    "DROP table " + index));
  }

  static Stream<String> unsafeTextPayloads() {
    return IntStream.range(0, 50)
        .mapToObj(index -> " <tag id=\"" + index + "\">'value' & content</tag> ");
  }
}
