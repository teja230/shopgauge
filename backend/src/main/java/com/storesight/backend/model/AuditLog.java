package com.storesight.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "shop_id")
  private Long shopId;

  @Column(name = "action", nullable = false, length = 100)
  private String action;

  @Column(name = "details", columnDefinition = "TEXT")
  private String details;

  @Column(name = "user_agent", length = 500)
  private String userAgent;

  @Column(name = "ip_address")
  private String ipAddress;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  // Default constructor
  public AuditLog() {
    this.createdAt = LocalDateTime.now();
  }

  // Constructor with required fields
  public AuditLog(Long shopId, String action, String details) {
    this();
    this.shopId = shopId;
    this.action = action;
    this.details = details;
  }

  // Constructor with all fields
  public AuditLog(Long shopId, String action, String details, String userAgent, String ipAddress) {
    this(shopId, action, details);
    this.userAgent = userAgent;
    this.ipAddress = ipAddress;
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

  public String getAction() {
    return action;
  }

  public void setAction(String action) {
    this.action = action;
  }

  public String getDetails() {
    return details;
  }

  public void setDetails(String details) {
    this.details = details;
  }

  public String getUserAgent() {
    return userAgent;
  }

  public void setUserAgent(String userAgent) {
    this.userAgent = userAgent;
  }

  public String getIpAddress() {
    return ipAddress;
  }

  public void setIpAddress(String ipAddress) {
    this.ipAddress = ipAddress;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  @Override
  public String toString() {
    return "AuditLog{"
        + "id="
        + id
        + ", shopId="
        + shopId
        + ", action='"
        + action
        + '\''
        + ", details='"
        + details
        + '\''
        + ", createdAt="
        + createdAt
        + '}';
  }
}
