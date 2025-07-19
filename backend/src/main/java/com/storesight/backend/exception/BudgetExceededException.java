package com.storesight.backend.exception;

import java.math.BigDecimal;

/** Exception thrown when API budget limits are exceeded */
public class BudgetExceededException extends RuntimeException {
  private final BigDecimal currentSpend;
  private final BigDecimal budgetLimit;
  private final String budgetType; // "daily" or "monthly"

  public BudgetExceededException(
      String message, BigDecimal currentSpend, BigDecimal budgetLimit, String budgetType) {
    super(message);
    this.currentSpend = currentSpend;
    this.budgetLimit = budgetLimit;
    this.budgetType = budgetType;
  }

  public BigDecimal getCurrentSpend() {
    return currentSpend;
  }

  public BigDecimal getBudgetLimit() {
    return budgetLimit;
  }

  public String getBudgetType() {
    return budgetType;
  }
}
