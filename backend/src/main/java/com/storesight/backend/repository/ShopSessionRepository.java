package com.storesight.backend.repository;

import com.storesight.backend.model.Shop;
import com.storesight.backend.model.ShopSession;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface ShopSessionRepository extends JpaRepository<ShopSession, Long> {

  /** Find session by session ID */
  Optional<ShopSession> findBySessionId(String sessionId);

  /** Find all active sessions for a shop */
  List<ShopSession> findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(Shop shop);

  /** Find all sessions for a shop (both active and inactive) */
  List<ShopSession> findByShop(Shop shop);

  /** Find all active sessions for a shop by shop ID */
  @Query(
      "SELECT ss FROM ShopSession ss WHERE ss.shop.id = :shopId AND ss.isActive = true ORDER BY ss.lastAccessedAt DESC")
  List<ShopSession> findActiveSessionsByShopId(@Param("shopId") Long shopId);

  /** Find active session by shop and session ID */
  Optional<ShopSession> findByShopAndSessionIdAndIsActiveTrue(Shop shop, String sessionId);

  /** Find active session by shop domain and session ID */
  @Query(
      "SELECT ss FROM ShopSession ss WHERE ss.shop.shopifyDomain = :shopDomain AND ss.sessionId = :sessionId AND ss.isActive = true")
  Optional<ShopSession> findActiveSessionByShopDomainAndSessionId(
      @Param("shopDomain") String shopDomain, @Param("sessionId") String sessionId);

  /** Find most recent active session for a shop */
  @Query(
      "SELECT ss FROM ShopSession ss WHERE ss.shop = :shop AND ss.isActive = true ORDER BY ss.lastAccessedAt DESC LIMIT 1")
  Optional<ShopSession> findMostRecentActiveSession(@Param("shop") Shop shop);

  /** Find most recent active session for a shop by domain */
  @Query(
      "SELECT ss FROM ShopSession ss WHERE ss.shop.shopifyDomain = :shopDomain AND ss.isActive = true ORDER BY ss.lastAccessedAt DESC LIMIT 1")
  Optional<ShopSession> findMostRecentActiveSessionByDomain(@Param("shopDomain") String shopDomain);

  /** Count active sessions for a shop */
  long countByShopAndIsActiveTrue(Shop shop);

  /** Deactivate session by session ID */
  @Modifying
  @Transactional
  @Query(
      "UPDATE ShopSession ss SET ss.isActive = false, ss.updatedAt = CURRENT_TIMESTAMP WHERE ss.sessionId = :sessionId")
  void deactivateSession(@Param("sessionId") String sessionId);

  /** Deactivate all sessions for a shop */
  @Modifying
  @Transactional
  @Query(
      "UPDATE ShopSession ss SET ss.isActive = false, ss.updatedAt = CURRENT_TIMESTAMP WHERE ss.shop = :shop")
  void deactivateAllSessionsForShop(@Param("shop") Shop shop);

  /** Update last accessed time for a session */
  @Modifying
  @Transactional
  @Query(
      "UPDATE ShopSession ss SET ss.lastAccessedAt = CURRENT_TIMESTAMP, ss.updatedAt = CURRENT_TIMESTAMP WHERE ss.sessionId = :sessionId")
  void updateLastAccessedTime(@Param("sessionId") String sessionId);

  /** Find expired sessions */
  @Query(
      "SELECT ss FROM ShopSession ss WHERE ss.expiresAt IS NOT NULL AND ss.expiresAt < CURRENT_TIMESTAMP AND ss.isActive = true")
  List<ShopSession> findExpiredSessions();

  /** Find inactive sessions older than specified date */
  @Query(
      "SELECT ss FROM ShopSession ss WHERE ss.lastAccessedAt < :cutoffDate AND ss.isActive = true")
  List<ShopSession> findInactiveSessionsOlderThan(@Param("cutoffDate") LocalDateTime cutoffDate);

  /** Delete old inactive sessions */
  @Modifying
  @Transactional
  @Query("DELETE FROM ShopSession ss WHERE ss.isActive = false AND ss.updatedAt < :cutoffDate")
  void deleteOldInactiveSessions(@Param("cutoffDate") LocalDateTime cutoffDate);

  /** Find sessions by IP address for security monitoring */
  List<ShopSession> findByIpAddressAndIsActiveTrueOrderByCreatedAtDesc(String ipAddress);

  /** Find sessions by user agent pattern for security monitoring */
  @Query(
      "SELECT ss FROM ShopSession ss WHERE ss.userAgent LIKE %:userAgentPattern% AND ss.isActive = true ORDER BY ss.createdAt DESC")
  List<ShopSession> findByUserAgentPatternAndActive(
      @Param("userAgentPattern") String userAgentPattern);
}
