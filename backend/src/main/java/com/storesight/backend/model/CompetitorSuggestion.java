package com.storesight.backend.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "competitor_suggestions")
public class CompetitorSuggestion {

  public enum Status {
    NEW,
    APPROVED,
    IGNORED
  }

  public enum Source {
    GOOGLE_SHOPPING,
    BING_SHOPPING,
    ETSY,
    AMAZON,
    MANUAL
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "shop_id", nullable = false)
  private Long shopId;

  @Column(name = "product_id", nullable = false)
  private Long productId;

  @Column(name = "suggested_url", nullable = false)
  private String suggestedUrl;

  @Column(name = "title")
  private String title;

  @Column(name = "price", precision = 12, scale = 2)
  private BigDecimal price;

  @Enumerated(EnumType.STRING)
  @Column(name = "source", nullable = false)
  private Source source = Source.GOOGLE_SHOPPING;

  @Column(name = "discovered_at")
  private LocalDateTime discoveredAt;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private Status status = Status.NEW;

  @Column(name = "created_at")
  private LocalDateTime createdAt;

  @Column(name = "updated_at")
  private LocalDateTime updatedAt;

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
    updatedAt = LocalDateTime.now();
    if (discoveredAt == null) {
      discoveredAt = LocalDateTime.now();
    }
  }

  @PreUpdate
  protected void onUpdate() {
    updatedAt = LocalDateTime.now();
  }

  // Constructors
  public CompetitorSuggestion() {}

  public CompetitorSuggestion(
      Long shopId,
      Long productId,
      String suggestedUrl,
      String title,
      BigDecimal price,
      Source source) {
    this.shopId = shopId;
    this.productId = productId;
    this.suggestedUrl = suggestedUrl;
    this.title = title;
    this.price = price;
    this.source = source;
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

  public Long getProductId() {
    return productId;
  }

  public void setProductId(Long productId) {
    this.productId = productId;
  }

  public String getSuggestedUrl() {
    return suggestedUrl;
  }

  public void setSuggestedUrl(String suggestedUrl) {
    this.suggestedUrl = suggestedUrl;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public BigDecimal getPrice() {
    return price;
  }

  public void setPrice(BigDecimal price) {
    this.price = price;
  }

  public Source getSource() {
    return source;
  }

  public void setSource(Source source) {
    this.source = source;
  }

  public LocalDateTime getDiscoveredAt() {
    return discoveredAt;
  }

  public void setDiscoveredAt(LocalDateTime discoveredAt) {
    this.discoveredAt = discoveredAt;
  }

  public Status getStatus() {
    return status;
  }

  public void setStatus(Status status) {
    this.status = status;
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
}
