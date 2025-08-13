package com.storesight.backend.compliance;

/** Categories of personal data to support PII inventory and policies. */
public enum PIICategory {
  EMAIL,
  PHONE,
  ADDRESS,
  IP_ADDRESS,
  SESSION_ID,
  USER_IDENTIFIER,
  AUTH_TOKEN,
  PAYMENT,
  OTHER
}
