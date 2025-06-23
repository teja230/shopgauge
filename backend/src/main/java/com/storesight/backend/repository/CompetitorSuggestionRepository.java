package com.storesight.backend.repository;

import com.storesight.backend.model.CompetitorSuggestion;
import com.storesight.backend.model.CompetitorSuggestion.Status;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CompetitorSuggestionRepository extends JpaRepository<CompetitorSuggestion, Long> {

  // Find suggestions by shop and status
  Page<CompetitorSuggestion> findByShopIdAndStatus(Long shopId, Status status, Pageable pageable);

  // Find suggestions by shop ID
  Page<CompetitorSuggestion> findByShopId(Long shopId, Pageable pageable);

  // Find suggestions by product ID
  List<CompetitorSuggestion> findByProductId(Long productId);

  // Find suggestions by product ID and status
  List<CompetitorSuggestion> findByProductIdAndStatus(Long productId, Status status);

  // Count suggestions by shop and status
  long countByShopIdAndStatus(Long shopId, Status status);

  // Check if suggestion already exists for a product and URL
  boolean existsByShopIdAndProductIdAndSuggestedUrl(
      Long shopId, Long productId, String suggestedUrl);

  // Find by shop, product and URL
  Optional<CompetitorSuggestion> findByShopIdAndProductIdAndSuggestedUrl(
      Long shopId, Long productId, String suggestedUrl);

  // Get all NEW suggestions for a shop (for batch processing)
  @Query(
      "SELECT cs FROM CompetitorSuggestion cs WHERE cs.shopId = :shopId AND cs.status = 'NEW' ORDER BY cs.discoveredAt DESC")
  List<CompetitorSuggestion> findNewSuggestionsByShopId(@Param("shopId") Long shopId);

  // Get suggestions for discovery scheduling (shops with active products)
  @Query("SELECT DISTINCT cs.shopId FROM CompetitorSuggestion cs WHERE cs.status = 'NEW'")
  List<Long> findShopIdsWithNewSuggestions();
}
