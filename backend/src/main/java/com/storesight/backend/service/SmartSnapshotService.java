package com.storesight.backend.service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Smart snapshot creation service that only creates snapshots on significant price changes Reduces
 * storage while preserving important price history
 */
@Service
public class SmartSnapshotService {

  private static final Logger logger = LoggerFactory.getLogger(SmartSnapshotService.class);

  @Autowired private JdbcTemplate jdbcTemplate;

  @Value("${price.snapshots.significant-change-threshold:1.0}")
  private double significantChangeThreshold;

  @Value("${price.snapshots.force-create-on-null:true}")
  private boolean forceCreateOnNull;

  @Value("${price.snapshots.minimum-interval-hours:6}")
  private int minimumIntervalHours;

  /** Determines if a new snapshot should be created based on price change significance */
  public boolean shouldCreateSnapshot(Long competitorId, BigDecimal newPrice, boolean inStock) {
    try {
      // Get the latest price for this competitor
      Optional<BigDecimal> lastPrice = getLatestPrice(competitorId);

      if (!lastPrice.isPresent()) {
        logger.debug(
            "No previous price found for competitor {}, creating first snapshot", competitorId);
        return true; // Always create first snapshot
      }

      // Check if price changed significantly
      if (isSignificantPriceChange(lastPrice.get(), newPrice)) {
        logger.info(
            "Significant price change detected for competitor {}: ${} -> ${}",
            competitorId,
            lastPrice.get(),
            newPrice);
        return true;
      }

      // Check if stock status changed
      if (hasStockStatusChanged(competitorId, inStock)) {
        logger.info("Stock status changed for competitor {}, creating snapshot", competitorId);
        return true;
      }

      // Check if minimum interval has passed (for regular updates)
      if (hasMinimumIntervalPassed(competitorId)) {
        logger.debug(
            "Minimum interval passed for competitor {}, creating regular snapshot", competitorId);
        return true;
      }

      logger.debug("No significant change for competitor {}, skipping snapshot", competitorId);
      return false;

    } catch (Exception e) {
      logger.warn(
          "Error determining snapshot creation for competitor {}: {}",
          competitorId,
          e.getMessage());
      return true; // Create snapshot on error to be safe
    }
  }

  /** Check if price change is significant (> threshold) */
  private boolean isSignificantPriceChange(BigDecimal oldPrice, BigDecimal newPrice) {
    if (oldPrice == null || newPrice == null) {
      return forceCreateOnNull;
    }

    if (oldPrice.compareTo(BigDecimal.ZERO) == 0) {
      return newPrice.compareTo(BigDecimal.ZERO) != 0; // Any non-zero price is significant
    }

    double changePercent =
        Math.abs((newPrice.doubleValue() - oldPrice.doubleValue()) / oldPrice.doubleValue() * 100);

    return changePercent >= significantChangeThreshold;
  }

  /** Get the latest price for a competitor */
  private Optional<BigDecimal> getLatestPrice(Long competitorId) {
    try {
      String query =
          """
                SELECT price FROM price_snapshots
                WHERE competitor_url_id = ? AND deleted_at IS NULL
                ORDER BY checked_at DESC LIMIT 1
                """;

      BigDecimal price = jdbcTemplate.queryForObject(query, BigDecimal.class, competitorId);
      return Optional.ofNullable(price);
    } catch (Exception e) {
      logger.debug("No price found for competitor {}: {}", competitorId, e.getMessage());
      return Optional.empty();
    }
  }

  /** Check if stock status has changed */
  private boolean hasStockStatusChanged(Long competitorId, boolean newInStock) {
    try {
      String query =
          """
                SELECT in_stock FROM price_snapshots
                WHERE competitor_url_id = ? AND deleted_at IS NULL
                ORDER BY checked_at DESC LIMIT 1
                """;

      Boolean lastInStock = jdbcTemplate.queryForObject(query, Boolean.class, competitorId);
      return lastInStock == null || !lastInStock.equals(newInStock);
    } catch (Exception e) {
      logger.debug("No stock status found for competitor {}: {}", competitorId, e.getMessage());
      return true; // Consider it changed if no previous record
    }
  }

  /** Check if minimum interval has passed since last snapshot */
  private boolean hasMinimumIntervalPassed(Long competitorId) {
    try {
      String query =
          """
                SELECT checked_at FROM price_snapshots
                WHERE competitor_url_id = ? AND deleted_at IS NULL
                ORDER BY checked_at DESC LIMIT 1
                """;

      java.sql.Timestamp lastChecked =
          jdbcTemplate.queryForObject(query, java.sql.Timestamp.class, competitorId);
      if (lastChecked == null) {
        return true; // No previous snapshot, allow creation
      }

      long hoursSinceLastCheck =
          (System.currentTimeMillis() - lastChecked.getTime()) / (1000 * 60 * 60);
      return hoursSinceLastCheck >= minimumIntervalHours;

    } catch (Exception e) {
      logger.debug("Error checking interval for competitor {}: {}", competitorId, e.getMessage());
      return true; // Allow creation on error
    }
  }

  /** Get price history for a competitor (for graph overlay) */
  public java.util.List<Map<String, Object>> getPriceHistory(Long competitorId, int days) {
    try {
      String query =
          """
                SELECT
                    price,
                    in_stock,
                    checked_at,
                    price_change_percent,
                    significant_change,
                    platform,
                    scraper_source
                FROM price_snapshots
                WHERE competitor_url_id = ?
                AND deleted_at IS NULL
                AND checked_at >= CURRENT_DATE - INTERVAL '1 day' * ?
                ORDER BY checked_at ASC
                """;

      return jdbcTemplate.queryForList(query, competitorId, days);
    } catch (Exception e) {
      logger.error(
          "Error getting price history for competitor {}: {}", competitorId, e.getMessage());
      return java.util.List.of();
    }
  }

  /** Get price statistics for analytics */
  public Map<String, Object> getPriceStatistics(Long competitorId) {
    try {
      String query =
          """
                SELECT
                    COUNT(*) as total_snapshots,
                    MIN(price) as min_price,
                    MAX(price) as max_price,
                    AVG(price) as avg_price,
                    COUNT(CASE WHEN significant_change = true THEN 1 END) as significant_changes,
                    MIN(checked_at) as first_check,
                    MAX(checked_at) as last_check
                FROM price_snapshots
                WHERE competitor_url_id = ? AND deleted_at IS NULL
                """;

      return jdbcTemplate.queryForMap(query, competitorId);
    } catch (Exception e) {
      logger.error(
          "Error getting price statistics for competitor {}: {}", competitorId, e.getMessage());
      return Map.of();
    }
  }

  /** Check if competitor has sufficient history for graph overlay */
  public boolean hasSufficientHistory(Long competitorId, int minimumDays) {
    try {
      String query =
          """
                SELECT COUNT(*) FROM price_snapshots
                WHERE competitor_url_id = ?
                AND deleted_at IS NULL
                AND checked_at >= CURRENT_DATE - INTERVAL '1 day' * ?
                """;

      Integer count = jdbcTemplate.queryForObject(query, Integer.class, competitorId, minimumDays);
      // Show graph if there's at least 1 snapshot within the time period
      // This indicates price stability or recent activity
      return count != null && count >= 1;
    } catch (Exception e) {
      logger.debug("Error checking history for competitor {}: {}", competitorId, e.getMessage());
      return false;
    }
  }
}
