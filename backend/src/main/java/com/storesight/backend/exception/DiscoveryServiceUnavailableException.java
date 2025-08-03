package com.storesight.backend.exception;

/** Exception thrown when the discovery service is unavailable or misconfigured */
public class DiscoveryServiceUnavailableException extends RuntimeException {
  private final String reason;

  public DiscoveryServiceUnavailableException(String message, String reason) {
    super(message);
    this.reason = reason;
  }

  public DiscoveryServiceUnavailableException(String message, String reason, Throwable cause) {
    super(message, cause);
    this.reason = reason;
  }

  public String getReason() {
    return reason;
  }
}
