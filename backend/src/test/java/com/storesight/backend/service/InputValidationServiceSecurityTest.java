package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

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
}
