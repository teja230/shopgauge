package com.storesight.backend.exception;

/**
 * Exception thrown when a user tries to restore more archived competitors than their plan allows
 */
public class ArchivedCompetitorLimitExceededException extends RuntimeException {
  private final int currentCount;
  private final int limit;
  private final String planType;

  public ArchivedCompetitorLimitExceededException(
      String message, int currentCount, int limit, String planType) {
    super(message);
    this.currentCount = currentCount;
    this.limit = limit;
    this.planType = planType;
  }

  public int getCurrentCount() {
    return currentCount;
  }

  public int getLimit() {
    return limit;
  }

  public String getPlanType() {
    return planType;
  }
}
