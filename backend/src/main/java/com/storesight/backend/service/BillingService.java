package com.storesight.backend.service;

import com.storesight.backend.model.Shop;
import com.storesight.backend.repository.ShopRepository;
// Removed unused LocalDateTime import
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BillingService {

  private static final Logger logger = LoggerFactory.getLogger(BillingService.class);

  @Autowired private ShopRepository shopRepository;

  /**
   * Soft delete a shop (preserves data for billing and compliance)
   */
  @Transactional
  public void softDeleteShop(String shopifyDomain, String reason) {
    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        Shop shop = shopOpt.get();
        shop.softDelete(reason);
        shopRepository.save(shop);
        
        logger.info("Soft deleted shop: {} with reason: {}", shopifyDomain, reason);
      } else {
        logger.warn("Shop not found for soft deletion: {}", shopifyDomain);
      }
    } catch (Exception e) {
      logger.error("Error soft deleting shop {}: {}", shopifyDomain, e.getMessage(), e);
      throw e;
    }
  }

  /**
   * Reactivate a soft deleted shop
   */
  @Transactional
  public void reactivateShop(String shopifyDomain) {
    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        Shop shop = shopOpt.get();
        shop.reactivate();
        shopRepository.save(shop);
        
        logger.info("Reactivated shop: {}", shopifyDomain);
      } else {
        logger.warn("Shop not found for reactivation: {}", shopifyDomain);
      }
    } catch (Exception e) {
      logger.error("Error reactivating shop {}: {}", shopifyDomain, e.getMessage(), e);
      throw e;
    }
  }

  /**
   * Get billing statistics for active shops
   */
  public Map<String, Object> getBillingStatistics() {
    try {
      List<Shop> activeShops = shopRepository.findByIsActiveTrue();
      List<Shop> deletedShops = shopRepository.findByIsActiveFalse();
      
      Map<String, Object> stats = new HashMap<>();
      stats.put("totalShops", activeShops.size() + deletedShops.size());
      stats.put("activeShops", activeShops.size());
      stats.put("deletedShops", deletedShops.size());
      stats.put("billingEligibleShops", activeShops.size());
      
      // Calculate revenue potential (example: $10/month per shop)
      double monthlyRevenuePotential = activeShops.size() * 10.0;
      stats.put("monthlyRevenuePotential", monthlyRevenuePotential);
      
      // Get shops by creation date for growth analysis
      Map<String, Long> shopsByMonth = new HashMap<>();
      for (Shop shop : activeShops) {
        String monthKey = shop.getCreatedAt().getYear() + "-" + 
                         String.format("%02d", shop.getCreatedAt().getMonthValue());
        shopsByMonth.merge(monthKey, 1L, Long::sum);
      }
      stats.put("shopsByMonth", shopsByMonth);
      
      logger.info("Billing statistics: {} active shops, {} deleted shops", 
                  activeShops.size(), deletedShops.size());
      
      return stats;
    } catch (Exception e) {
      logger.error("Error getting billing statistics: {}", e.getMessage(), e);
      return Map.of("error", "Failed to get billing statistics");
    }
  }

  /**
   * Get shops eligible for billing (active shops)
   */
  public List<Shop> getBillingEligibleShops() {
    return shopRepository.findByIsActiveTrue();
  }

  /**
   * Get deleted shops for compliance and audit purposes
   */
  public List<Shop> getDeletedShops() {
    return shopRepository.findByIsActiveFalse();
  }

  /**
   * Get shop billing status
   */
  public Map<String, Object> getShopBillingStatus(String shopifyDomain) {
    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        Shop shop = shopOpt.get();
        
        Map<String, Object> status = new HashMap<>();
        status.put("shopDomain", shop.getShopifyDomain());
        status.put("isActive", shop.getActive());
        status.put("isDeleted", shop.isDeleted());
        status.put("isBillingEligible", shop.isActiveForBilling());
        status.put("createdAt", shop.getCreatedAt());
        status.put("updatedAt", shop.getUpdatedAt());
        
        if (shop.isDeleted()) {
          status.put("deletedAt", shop.getDeletedAt());
          status.put("deletionReason", shop.getDeletionReason());
          status.put("daysSinceDeletion", shop.getDaysSinceDeletion());
        }
        
        return status;
      } else {
        return Map.of("error", "Shop not found");
      }
    } catch (Exception e) {
      logger.error("Error getting billing status for shop {}: {}", shopifyDomain, e.getMessage(), e);
      return Map.of("error", "Failed to get billing status");
    }
  }

  // Removed unused cleanupOldDeletedShops method - implement when needed for data retention
} 