package com.storesight.backend.repository;

import com.storesight.backend.model.Notification;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {

  // Legacy method - returns all notifications for a shop (backward compatibility)
  List<Notification> findByShopOrderByCreatedAtDesc(String shop);

  // Session-specific notifications: get notifications for a specific session + shop-wide
  // notifications
  @Query(
      "SELECT n FROM Notification n WHERE n.shop = :shop AND (n.sessionId = :sessionId OR n.sessionId IS NULL) ORDER BY n.createdAt DESC")
  List<Notification> findByShopAndSessionOrderByCreatedAtDesc(
      @Param("shop") String shop, @Param("sessionId") String sessionId);

  // Get only session-specific notifications (excluding shop-wide)
  List<Notification> findByShopAndSessionIdOrderByCreatedAtDesc(String shop, String sessionId);

  // Get only shop-wide notifications (session_id is null)
  @Query(
      "SELECT n FROM Notification n WHERE n.shop = :shop AND n.sessionId IS NULL ORDER BY n.createdAt DESC")
  List<Notification> findShopWideNotificationsByShop(@Param("shop") String shop);

  // Count unread notifications for a session (including shop-wide)
  @Query(
      "SELECT COUNT(n) FROM Notification n WHERE n.shop = :shop AND (n.sessionId = :sessionId OR n.sessionId IS NULL) AND n.read = false")
  long countUnreadByShopAndSession(
      @Param("shop") String shop, @Param("sessionId") String sessionId);

  // Find notifications by category for a session
  @Query(
      "SELECT n FROM Notification n WHERE n.shop = :shop AND (n.sessionId = :sessionId OR n.sessionId IS NULL) AND n.category = :category ORDER BY n.createdAt DESC")
  List<Notification> findByShopAndSessionAndCategory(
      @Param("shop") String shop,
      @Param("sessionId") String sessionId,
      @Param("category") String category);

  // Clean up old notifications for a specific session (for maintenance)
  @Query("DELETE FROM Notification n WHERE n.sessionId = :sessionId")
  void deleteBySessionId(@Param("sessionId") String sessionId);
}
