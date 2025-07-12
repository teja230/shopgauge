package com.storesight.backend.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Entity for storing Market Intelligence cost data with shop-specific tracking. */
@Entity
@Table(name = "market_intelligence_costs")
public class MarketIntelligenceCost {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "shop_id", nullable = false)
  private Long shopId;

  @Column(name = "date", nullable = false)
  private LocalDate date;

  @Column(name = "provider", nullable = false, length = 50)
  private String provider;

  @Column(name = "daily_cost", nullable = false, precision = 10, scale = 4)
  private BigDecimal dailyCost;

  @Column(name = "daily_requests", nullable = false)
  private Integer dailyRequests;

  @Column(name = "daily_discoveries", nullable = false)
  private Integer dailyDiscoveries;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private LocalDateTime updatedAt;

  // Default constructor
  public MarketIntelligenceCost() {
    this.createdAt = LocalDateTime.now();
    this.updatedAt = LocalDateTime.now();
  }

  // Constructor with required fields
  public MarketIntelligenceCost(
      Long shopId,
      LocalDate date,
      String provider,
      BigDecimal dailyCost,
      Integer dailyRequests,
      Integer dailyDiscoveries) {
    this();
    this.shopId = shopId;
    this.date = date;
    this.provider = provider;
    this.dailyCost = dailyCost;
    this.dailyRequests = dailyRequests;
    this.dailyDiscoveries = dailyDiscoveries;
  }

  // Getters and Setters
  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Long getShopId() {
    return shopId;
  }

  public void setShopId(Long shopId) {
    this.shopId = shopId;
  }

  public LocalDate getDate() {
    return date;
  }

  public void setDate(LocalDate date) {
    this.date = date;
  }

  public String getProvider() {
    return provider;
  }

  public void setProvider(String provider) {
    this.provider = provider;
  }

  public BigDecimal getDailyCost() {
    return dailyCost;
  }

  public void setDailyCost(BigDecimal dailyCost) {
    this.dailyCost = dailyCost;
  }

  public Integer getDailyRequests() {
    return dailyRequests;
  }

  public void setDailyRequests(Integer dailyRequests) {
    this.dailyRequests = dailyRequests;
  }

  public Integer getDailyDiscoveries() {
    return dailyDiscoveries;
  }

  public void setDailyDiscoveries(Integer dailyDiscoveries) {
    this.dailyDiscoveries = dailyDiscoveries;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public LocalDateTime getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(LocalDateTime updatedAt) {
    this.updatedAt = updatedAt;
  }

  @PreUpdate
  public void preUpdate() {
    this.updatedAt = LocalDateTime.now();
  }

  @Override
  public String toString() {
    return "MarketIntelligenceCost{"
        + "id="
        + id
        + ", shopId="
        + shopId
        + ", date="
        + date
        + ", provider='"
        + provider
        + '\''
        + ", dailyCost="
        + dailyCost
        + ", dailyRequests="
        + dailyRequests
        + ", dailyDiscoveries="
        + dailyDiscoveries
        + ", createdAt="
        + createdAt
        + ", updatedAt="
        + updatedAt
        + '}';
  }
}
