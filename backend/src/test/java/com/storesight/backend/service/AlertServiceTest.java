package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AlertServiceTest {

  @Test
  void formatsPriceAndInventoryAlertsForMerchants() {
    Map<String, Object> alert = new HashMap<>();
    alert.put("old_price", new BigDecimal("25.00"));
    alert.put("new_price", new BigDecimal("20.00"));
    alert.put("change_percent", new BigDecimal("-20.00"));

    assertEquals(
        "Acme price changed from 25.00 to 20.00 (-20.00%).",
        AlertService.formatPriceAlertMessage(alert, "Acme", "price_drop"));
    assertEquals(
        "Acme is back in stock.",
        AlertService.formatPriceAlertMessage(alert, "Acme", "back_in_stock"));
    assertEquals(
        "Acme is out of stock.",
        AlertService.formatPriceAlertMessage(alert, "Acme", "out_of_stock"));
  }
}
