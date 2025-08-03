package com.storesight.backend.repository;

import com.storesight.backend.model.MarketIntelligenceCost;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** Repository for managing Market Intelligence cost data with shop-specific tracking. */
@Repository
public interface MarketIntelligenceCostRepository
    extends JpaRepository<MarketIntelligenceCost, Long> {

  /** Find cost data for a specific shop, date, and provider */
  Optional<MarketIntelligenceCost> findByShopIdAndDateAndProvider(
      Long shopId, LocalDate date, String provider);

  /** Find all cost data for a shop within a date range */
  @Query(
      "SELECT c FROM MarketIntelligenceCost c WHERE c.shopId = :shopId AND c.date BETWEEN :startDate AND :endDate ORDER BY c.date ASC")
  List<MarketIntelligenceCost> findByShopIdAndDateBetween(
      @Param("shopId") Long shopId,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  /** Find all cost data for a shop for the last N days */
  @Query(
      "SELECT c FROM MarketIntelligenceCost c WHERE c.shopId = :shopId AND c.date >= :startDate ORDER BY c.date ASC")
  List<MarketIntelligenceCost> findByShopIdAndDateAfter(
      @Param("shopId") Long shopId, @Param("startDate") LocalDate startDate);

  /** Get daily aggregated costs for a shop within a date range */
  @Query(
      "SELECT c.date as date, SUM(c.dailyCost) as totalCost, SUM(c.dailyRequests) as totalRequests, "
          + "SUM(c.dailyDiscoveries) as totalDiscoveries FROM MarketIntelligenceCost c "
          + "WHERE c.shopId = :shopId AND c.date BETWEEN :startDate AND :endDate "
          + "GROUP BY c.date ORDER BY c.date ASC")
  List<Object[]> getDailyAggregatedCosts(
      @Param("shopId") Long shopId,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  /** Get provider-specific costs for a shop within a date range */
  @Query(
      "SELECT c.provider, SUM(c.dailyCost) as totalCost, SUM(c.dailyRequests) as totalRequests, "
          + "SUM(c.dailyDiscoveries) as totalDiscoveries FROM MarketIntelligenceCost c "
          + "WHERE c.shopId = :shopId AND c.date BETWEEN :startDate AND :endDate "
          + "GROUP BY c.provider")
  List<Object[]> getProviderCosts(
      @Param("shopId") Long shopId,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  /** Delete old cost data (for cleanup) */
  void deleteByDateBefore(LocalDate date);

  /** Count total records for a shop */
  long countByShopId(Long shopId);

  /** Find all cost data for a shop */
  List<MarketIntelligenceCost> findByShopId(Long shopId);

  /** Delete all cost data for a shop */
  void deleteByShopId(Long shopId);

  /** Count records before a specific date */
  long countByDateBefore(LocalDate date);
}
