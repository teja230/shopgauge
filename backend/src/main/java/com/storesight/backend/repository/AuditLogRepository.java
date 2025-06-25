package com.storesight.backend.repository;

import com.storesight.backend.model.AuditLog;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

  /** Find audit logs by shop ID */
  List<AuditLog> findByShopIdOrderByCreatedAtDesc(Long shopId);

  /** Find audit logs by shop ID with pagination */
  Page<AuditLog> findByShopIdOrderByCreatedAtDesc(Long shopId, Pageable pageable);

  /** Find audit logs by action */
  List<AuditLog> findByActionOrderByCreatedAtDesc(String action);

  /** Find audit logs by shop ID and action */
  List<AuditLog> findByShopIdAndActionOrderByCreatedAtDesc(Long shopId, String action);

  /** Find audit logs within a date range */
  List<AuditLog> findByCreatedAtBetweenOrderByCreatedAtDesc(
      LocalDateTime startDate, LocalDateTime endDate);

  /** Find audit logs by shop ID within a date range */
  List<AuditLog> findByShopIdAndCreatedAtBetweenOrderByCreatedAtDesc(
      Long shopId, LocalDateTime startDate, LocalDateTime endDate);

  /** Count audit logs by shop ID */
  long countByShopId(Long shopId);

  /** Count audit logs by shop ID and action */
  long countByShopIdAndAction(Long shopId, String action);

  /** Get audit log statistics by action for a shop */
  @Query(
      "SELECT a.action, COUNT(a) FROM AuditLog a WHERE a.shopId = :shopId GROUP BY a.action ORDER BY COUNT(a) DESC")
  List<Object[]> getActionStatisticsByShop(@Param("shopId") Long shopId);

  /** Get recent audit logs for a shop (last 30 days) */
  @Query(
      "SELECT a FROM AuditLog a WHERE a.shopId = :shopId AND a.createdAt >= :thirtyDaysAgo ORDER BY a.createdAt DESC")
  List<AuditLog> findRecentByShop(
      @Param("shopId") Long shopId, @Param("thirtyDaysAgo") LocalDateTime thirtyDaysAgo);

  /** Delete audit logs older than specified date */
  void deleteByCreatedAtBefore(LocalDateTime date);

  /** Delete audit logs for a specific shop older than specified date */
  void deleteByShopIdAndCreatedAtBefore(Long shopId, LocalDateTime date);

  /** Count audit logs older than specified date */
  long countByCreatedAtBefore(LocalDateTime date);

  /** Find audit logs from deleted shops (where shop_id is null) */
  List<AuditLog> findByShopIdIsNullOrderByCreatedAtDesc();

  /** Find audit logs from deleted shops (where shop_id is null) with pagination */
  Page<AuditLog> findByShopIdIsNullOrderByCreatedAtDesc(Pageable pageable);

  /** Find all audit logs ordered by creation date */
  Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

  /** Find audit logs created after a specific date */
  List<AuditLog> findByCreatedAtAfterOrderByCreatedAtDesc(LocalDateTime date);
}
