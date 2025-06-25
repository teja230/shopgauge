package com.storesight.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "shops")
public class Shop {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "shopify_domain", unique = true, nullable = false)
  private String shopifyDomain;

  @Column(name = "access_token", nullable = false)
  private String accessToken;

  @Column(name = "created_at")
  private LocalDateTime createdAt;

  @Column(name = "updated_at")
  private LocalDateTime updatedAt;

  // One-to-many relationship with shop sessions
  @OneToMany(mappedBy = "shop", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
  private List<ShopSession> sessions = new ArrayList<>();

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
    updatedAt = LocalDateTime.now();
  }

  @PreUpdate
  protected void onUpdate() {
    updatedAt = LocalDateTime.now();
  }

  // Constructors
  public Shop() {}

  public Shop(String shopifyDomain, String accessToken) {
    this.shopifyDomain = shopifyDomain;
    this.accessToken = accessToken;
  }

  // Getters and Setters
  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getShopifyDomain() {
    return shopifyDomain;
  }

  public void setShopifyDomain(String shopifyDomain) {
    this.shopifyDomain = shopifyDomain;
  }

  public String getAccessToken() {
    return accessToken;
  }

  public void setAccessToken(String accessToken) {
    this.accessToken = accessToken;
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

  public List<ShopSession> getSessions() {
    return sessions;
  }

  public void setSessions(List<ShopSession> sessions) {
    this.sessions = sessions;
  }

  // Helper methods
  public void addSession(ShopSession session) {
    sessions.add(session);
    session.setShop(this);
  }

  public void removeSession(ShopSession session) {
    sessions.remove(session);
    session.setShop(null);
  }

  public List<ShopSession> getActiveSessions() {
    return sessions.stream()
        .filter(session -> session.getIsActive() && !session.isExpired())
        .toList();
  }

  public int getActiveSessionCount() {
    return getActiveSessions().size();
  }

  public ShopSession getMostRecentActiveSession() {
    return sessions.stream()
        .filter(session -> session.getIsActive() && !session.isExpired())
        .max((s1, s2) -> s1.getLastAccessedAt().compareTo(s2.getLastAccessedAt()))
        .orElse(null);
  }

  public boolean hasActiveSession(String sessionId) {
    return sessions.stream()
        .anyMatch(
            session ->
                session.getSessionId().equals(sessionId)
                    && session.getIsActive()
                    && !session.isExpired());
  }

  @Override
  public String toString() {
    return "Shop{"
        + "id="
        + id
        + ", shopifyDomain='"
        + shopifyDomain
        + '\''
        + ", createdAt="
        + createdAt
        + ", updatedAt="
        + updatedAt
        + ", activeSessions="
        + getActiveSessionCount()
        + '}';
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Shop)) return false;
    Shop shop = (Shop) o;
    return shopifyDomain != null && shopifyDomain.equals(shop.shopifyDomain);
  }

  @Override
  public int hashCode() {
    return shopifyDomain != null ? shopifyDomain.hashCode() : 0;
  }
}
