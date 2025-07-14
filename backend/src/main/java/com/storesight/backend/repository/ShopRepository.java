package com.storesight.backend.repository;

import com.storesight.backend.model.Shop;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ShopRepository extends JpaRepository<Shop, Long> {
  Optional<Shop> findByShopifyDomain(String shopifyDomain);

  // Soft delete queries
  List<Shop> findByIsActiveTrue();

  List<Shop> findByIsActiveFalse();

  List<Shop> findByIsActiveFalseAndDeletedAtBefore(LocalDateTime cutoffDate);

  // Billing queries
  @Query("SELECT COUNT(s) FROM Shop s WHERE s.isActive = true")
  long countActiveShops();

  @Query("SELECT COUNT(s) FROM Shop s WHERE s.isActive = false")
  long countDeletedShops();

  // Find shops by deletion reason
  List<Shop> findByIsActiveFalseAndDeletionReason(String reason);

  // Find shops created in a date range
  @Query("SELECT s FROM Shop s WHERE s.createdAt BETWEEN :startDate AND :endDate")
  List<Shop> findByCreatedAtBetween(
      @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
}
