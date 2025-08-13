package com.storesight.backend.service;

import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class AuditMaskingService {

  private static final String REDACTED = "***REDACTED***";

  // Common PII patterns
  private static final Pattern EMAIL =
      Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
  // Phone-like patterns: 7+ digits possibly separated by spaces, dashes, or dots
  private static final Pattern PHONE = Pattern.compile("(?<!\\d)\\d[\\d .-]{6,}\\d(?!\\d)");
  private static final Pattern CREDIT_CARD = Pattern.compile("(?:\\d[ -]*?){13,19}");

  // Sensitive JSON keys to mask fully
  private static final String[] SENSITIVE_KEYS = {
    "password", "token", "accessToken", "refreshToken", "secret", "apiKey", "authorization", "ssn"
  };

  public String maskFreeform(String raw) {
    if (raw == null || raw.isBlank()) return raw;
    String masked = raw;
    masked = EMAIL.matcher(masked).replaceAll(REDACTED);
    masked = CREDIT_CARD.matcher(masked).replaceAll(REDACTED);
    // Mask phone-like
    masked = PHONE.matcher(masked).replaceAll(REDACTED);
    return masked;
  }

  public Map<String, Object> maskMap(Map<String, Object> input) {
    if (input == null) return null;
    for (String key : SENSITIVE_KEYS) {
      if (input.containsKey(key)) {
        input.put(key, REDACTED);
      }
    }
    // Shallow masking for values that look like emails or long numbers
    input.replaceAll(
        (k, v) -> {
          if (v instanceof String s) {
            String masked = maskFreeform(s);
            return masked;
          }
          return v;
        });
    return input;
  }
}
