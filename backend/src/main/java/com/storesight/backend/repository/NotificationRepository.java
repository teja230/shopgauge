package com.storesight.backend.repository;

import com.storesight.backend.model.Notification;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {

  // Legacy method - returns all notifications for a shop (backward compatibility)
  @Query(
      "SELECT n FROM Notification n WHERE n.shop = :shop AND n.deleted = false ORDER BY n.createdAt DESC")
  List<Notification> findByShopOrderByCreatedAtDesc(@Param("shop") String shop);

  // Session-specific notifications: get notifications for a specific session + shop-wide
  // notifications
  @Query(
      "SELECT n FROM Notification n WHERE n.shop = :shop AND n.deleted = false AND (n.sessionId = :sessionId OR n.sessionId IS NULL) ORDER BY n.createdAt DESC")
  List<Notification> findByShopAndSessionOrderByCreatedAtDesc(
      @Param("shop") String shop, @Param("sessionId") String sessionId);

  // Get only session-specific notifications (excluding shop-wide and deleted)
  @Query(
      "SELECT n FROM Notification n WHERE n.shop = :shop AND n.sessionId = :sessionId AND n.deleted = false ORDER BY n.createdAt DESC")
  List<Notification> findByShopAndSessionIdOrderByCreatedAtDesc(String shop, String sessionId);

  // Get only shop-wide notifications (session_id is null and not deleted)
  @Query(
      "SELECT n FROM Notification n WHERE n.shop = :shop AND n.sessionId IS NULL AND n.deleted = false ORDER BY n.createdAt DESC")
  List<Notification> findShopWideNotificationsByShop(@Param("shop") String shop);

  // Count unread notifications for a session (including shop-wide, excluding deleted)
  @Query(
      "SELECT COUNT(n) FROM Notification n WHERE n.shop = :shop AND n.deleted = false AND (n.sessionId = :sessionId OR n.sessionId IS NULL) AND n.read = false")
  long countUnreadByShopAndSession(
      @Param("shop") String shop, @Param("sessionId") String sessionId);

  // Find notifications by category for a session (excluding deleted)
  @Query(
      "SELECT n FROM Notification n WHERE n.shop = :shop AND n.deleted = false AND (n.sessionId = :sessionId OR n.sessionId IS NULL) AND n.category = :category ORDER BY n.createdAt DESC")
  List<Notification> findByShopAndSessionAndCategory(
      @Param("shop") String shop,
      @Param("sessionId") String sessionId,
      @Param("category") String category);

  // Clean up old notifications for a specific session (for maintenance)
  @Query("DELETE FROM Notification n WHERE n.sessionId = :sessionId")
  void deleteBySessionId(@Param("sessionId") String sessionId);

  // Cleanup policy methods
  List<Notification> findByCreatedAtBefore(LocalDateTime date);

  @Query("SELECT DISTINCT n.shop FROM Notification n WHERE n.deleted = false")
  List<String> findDistinctShops();

  List<Notification> findByShopAndReadTrueAndDeletedFalseOrderByCreatedAtDesc(String shop);

  List<Notification> findByShopAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(String shop);
}
