package com.storesight.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
public class Notification {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private String id;

  @Column(name = "shop", nullable = false)
  private String shop;

  @Column(name = "session_id", nullable = true) // Make nullable for backward compatibility
  private String sessionId;

  @Column(name = "message", nullable = false)
  private String message;

  @Column(name = "type", nullable = false)
  private String type;

  @Column(name = "category", nullable = true)
  private String category;

  @Column(name = "scope", nullable = false)
  private String scope = "personal"; // Default to personal notifications

  @Column(name = "read", nullable = false)
  private boolean read = false;

  @Column(name = "deleted", nullable = false)
  private boolean deleted = false;

  @Column(name = "deleted_at", nullable = true)
  private LocalDateTime deletedAt;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
  }

  // Constructors
  public Notification() {}

  public Notification(String shop, String sessionId, String message, String type, String category) {
    this.shop = shop;
    this.sessionId = sessionId;
    this.message = message;
    this.type = type;
    this.category = category;
    this.read = false;
  }

  public Notification(
      String shop, String sessionId, String message, String type, String category, String scope) {
    this.shop = shop;
    this.sessionId = sessionId;
    this.message = message;
    this.type = type;
    this.category = category;
    this.scope = scope != null ? scope : "personal";
    this.read = false;
  }

  // Getters and Setters
  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getShop() {
    return shop;
  }

  public void setShop(String shop) {
    this.shop = shop;
  }

  public String getSessionId() {
    return sessionId;
  }

  public void setSessionId(String sessionId) {
    this.sessionId = sessionId;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }

  public String getCategory() {
    return category;
  }

  public void setCategory(String category) {
    this.category = category;
  }

  public String getScope() {
    return scope;
  }

  public void setScope(String scope) {
    this.scope = scope;
  }

  public boolean isRead() {
    return read;
  }

  public void setRead(boolean read) {
    this.read = read;
  }

  public boolean isDeleted() {
    return deleted;
  }

  public void setDeleted(boolean deleted) {
    this.deleted = deleted;
  }

  public LocalDateTime getDeletedAt() {
    return deletedAt;
  }

  public void setDeletedAt(LocalDateTime deletedAt) {
    this.deletedAt = deletedAt;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  // Helper methods
  public boolean belongsToSession(String sessionId) {
    return this.sessionId != null && this.sessionId.equals(sessionId);
  }

  public boolean isShopWide() {
    return this.sessionId == null;
  }
}
