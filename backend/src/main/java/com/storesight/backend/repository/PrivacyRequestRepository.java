package com.storesight.backend.repository;

import com.storesight.backend.model.PrivacyRequest;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PrivacyRequestRepository extends JpaRepository<PrivacyRequest, Long> {

  // Find requests by shop ID
  List<PrivacyRequest> findByShopIdOrderByRequestedAtDesc(Long shopId);

  // Find requests by shop ID with pagination
  Page<PrivacyRequest> findByShopIdOrderByRequestedAtDesc(Long shopId, Pageable pageable);

  // Find requests by status
  List<PrivacyRequest> findByStatusOrderByRequestedAtDesc(PrivacyRequest.Status status);

  // Find requests by type and status
  List<PrivacyRequest> findByRequestTypeAndStatusOrderByRequestedAtDesc(
      PrivacyRequest.RequestType requestType, PrivacyRequest.Status status);

  // Find pending requests older than specified time
  @Query(
      "SELECT pr FROM PrivacyRequest pr WHERE pr.status = 'PENDING' AND pr.requestedAt < :cutoffTime")
  List<PrivacyRequest> findPendingRequestsOlderThan(@Param("cutoffTime") LocalDateTime cutoffTime);

  // Find processing requests older than specified time (potentially stuck)
  @Query(
      "SELECT pr FROM PrivacyRequest pr WHERE pr.status = 'PROCESSING' AND pr.processedAt < :cutoffTime")
  List<PrivacyRequest> findStuckProcessingRequests(@Param("cutoffTime") LocalDateTime cutoffTime);

  // Count requests by shop and status
  long countByShopIdAndStatus(Long shopId, PrivacyRequest.Status status);

  // Count requests by type
  long countByRequestType(PrivacyRequest.RequestType requestType);

  // Find recent requests for a shop
  @Query(
      "SELECT pr FROM PrivacyRequest pr WHERE pr.shopId = :shopId AND pr.requestedAt >= :since ORDER BY pr.requestedAt DESC")
  List<PrivacyRequest> findRecentRequestsByShop(
      @Param("shopId") Long shopId, @Param("since") LocalDateTime since);

  // Check if shop has pending requests
  boolean existsByShopIdAndStatus(Long shopId, PrivacyRequest.Status status);

  // Get statistics by status
  @Query("SELECT pr.status, COUNT(pr) FROM PrivacyRequest pr GROUP BY pr.status")
  List<Object[]> getStatusStatistics();

  // Get statistics by request type
  @Query("SELECT pr.requestType, COUNT(pr) FROM PrivacyRequest pr GROUP BY pr.requestType")
  List<Object[]> getRequestTypeStatistics();
}
