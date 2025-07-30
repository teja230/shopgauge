package com.storesight.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Enhanced price change calculation service with improved accuracy and historical analysis
 */
@Service
public class PriceChangeCalculationService {

    private static final Logger logger = LoggerFactory.getLogger(PriceChangeCalculationService.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Calculate price change percentage with enhanced accuracy
     */
    public Optional<BigDecimal> calculatePriceChangePercent(Long competitorId, BigDecimal newPrice) {
        try {
            if (newPrice == null || newPrice.compareTo(BigDecimal.ZERO) <= 0) {
                logger.debug("calculatePriceChangePercent: Invalid new price for competitor {}", competitorId);
                return Optional.empty();
            }

            // Get the most recent valid price snapshot
            Optional<BigDecimal> lastPrice = getLastValidPrice(competitorId);
            if (!lastPrice.isPresent()) {
                logger.debug("calculatePriceChangePercent: No previous price found for competitor {}", competitorId);
                return Optional.empty();
            }

            BigDecimal previousPrice = lastPrice.get();
            if (previousPrice.compareTo(BigDecimal.ZERO) <= 0) {
                logger.debug("calculatePriceChangePercent: Previous price is zero or negative for competitor {}", competitorId);
                return Optional.empty();
            }

            // Calculate percentage change with proper rounding
            BigDecimal priceDiff = newPrice.subtract(previousPrice);
            BigDecimal percentChange = priceDiff
                .divide(previousPrice, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

            logger.debug("calculatePriceChangePercent: Competitor {} price change: ${} -> ${} = {}%", 
                competitorId, previousPrice, newPrice, percentChange);

            return Optional.of(percentChange);

        } catch (Exception e) {
            logger.warn("calculatePriceChangePercent: Error calculating price change for competitor {}: {}", 
                competitorId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Get the last valid price for a competitor (excluding soft-deleted snapshots)
     */
    private Optional<BigDecimal> getLastValidPrice(Long competitorId) {
        try {
            String query = """
                SELECT price 
                FROM price_snapshots 
                WHERE competitor_url_id = ? 
                AND deleted_at IS NULL 
                AND price IS NOT NULL 
                AND price > 0
                ORDER BY checked_at DESC 
                LIMIT 1
                """;
            
            BigDecimal price = jdbcTemplate.queryForObject(query, BigDecimal.class, competitorId);
            return Optional.ofNullable(price);
        } catch (Exception e) {
            logger.debug("getLastValidPrice: No valid price found for competitor {}: {}", competitorId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Calculate price change over a specific time period
     */
    public Optional<BigDecimal> calculatePriceChangeOverPeriod(Long competitorId, int days) {
        try {
            String query = """
                SELECT 
                    current.price as current_price,
                    historical.price as historical_price
                FROM (
                    SELECT price 
                    FROM price_snapshots 
                    WHERE competitor_url_id = ? 
                    AND deleted_at IS NULL 
                    AND price IS NOT NULL 
                    AND price > 0
                    ORDER BY checked_at DESC 
                    LIMIT 1
                ) current
                CROSS JOIN (
                    SELECT price 
                    FROM price_snapshots 
                    WHERE competitor_url_id = ? 
                    AND deleted_at IS NULL 
                    AND price IS NOT NULL 
                    AND price > 0
                    AND checked_at <= CURRENT_DATE - INTERVAL '1 day' * ?
                    ORDER BY checked_at DESC 
                    LIMIT 1
                ) historical
                """;
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(query, competitorId, competitorId, days);
            
            if (results.isEmpty()) {
                logger.debug("calculatePriceChangeOverPeriod: No historical data found for competitor {} over {} days", competitorId, days);
                return Optional.empty();
            }

            Map<String, Object> result = results.get(0);
            BigDecimal currentPrice = (BigDecimal) result.get("current_price");
            BigDecimal historicalPrice = (BigDecimal) result.get("historical_price");

            if (currentPrice == null || historicalPrice == null || 
                currentPrice.compareTo(BigDecimal.ZERO) <= 0 || 
                historicalPrice.compareTo(BigDecimal.ZERO) <= 0) {
                return Optional.empty();
            }

            BigDecimal priceDiff = currentPrice.subtract(historicalPrice);
            BigDecimal percentChange = priceDiff
                .divide(historicalPrice, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

            logger.debug("calculatePriceChangeOverPeriod: Competitor {} {}-day change: ${} -> ${} = {}%", 
                competitorId, days, historicalPrice, currentPrice, percentChange);

            return Optional.of(percentChange);

        } catch (Exception e) {
            logger.warn("calculatePriceChangeOverPeriod: Error calculating {}-day price change for competitor {}: {}", 
                days, competitorId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Get comprehensive price change statistics
     */
    public Map<String, Object> getPriceChangeStatistics(Long competitorId) {
        try {
            String query = """
                SELECT 
                    COUNT(*) as total_snapshots,
                    COUNT(CASE WHEN price_change_percent IS NOT NULL THEN 1 END) as snapshots_with_changes,
                    AVG(price_change_percent) as avg_change_percent,
                    MIN(price_change_percent) as min_change_percent,
                    MAX(price_change_percent) as max_change_percent,
                    COUNT(CASE WHEN price_change_percent > 0 THEN 1 END) as price_increases,
                    COUNT(CASE WHEN price_change_percent < 0 THEN 1 END) as price_decreases,
                    COUNT(CASE WHEN price_change_percent = 0 THEN 1 END) as no_changes,
                    MIN(checked_at) as first_check,
                    MAX(checked_at) as last_check
                FROM price_snapshots 
                WHERE competitor_url_id = ? 
                AND deleted_at IS NULL
                """;
            
            return jdbcTemplate.queryForMap(query, competitorId);
        } catch (Exception e) {
            logger.error("getPriceChangeStatistics: Error getting statistics for competitor {}: {}", competitorId, e.getMessage());
            return Map.of();
        }
    }

    /**
     * Validate and fix inconsistent price change data
     */
    public void validateAndFixPriceChanges(Long competitorId) {
        try {
            logger.info("validateAndFixPriceChanges: Starting validation for competitor {}", competitorId);
            
            // Get all snapshots for this competitor
            String query = """
                SELECT id, price, checked_at, price_change_percent
                FROM price_snapshots 
                WHERE competitor_url_id = ? 
                AND deleted_at IS NULL
                ORDER BY checked_at ASC
                """;
            
            List<Map<String, Object>> snapshots = jdbcTemplate.queryForList(query, competitorId);
            
            if (snapshots.size() < 2) {
                logger.debug("validateAndFixPriceChanges: Not enough snapshots for competitor {}", competitorId);
                return;
            }

            int fixedCount = 0;
            for (int i = 1; i < snapshots.size(); i++) {
                Map<String, Object> current = snapshots.get(i);
                Map<String, Object> previous = snapshots.get(i - 1);
                
                BigDecimal currentPrice = (BigDecimal) current.get("price");
                BigDecimal previousPrice = (BigDecimal) previous.get("price");
                BigDecimal storedChange = (BigDecimal) current.get("price_change_percent");
                
                if (currentPrice != null && previousPrice != null && 
                    currentPrice.compareTo(BigDecimal.ZERO) > 0 && 
                    previousPrice.compareTo(BigDecimal.ZERO) > 0) {
                    
                    // Calculate correct change
                    BigDecimal priceDiff = currentPrice.subtract(previousPrice);
                    BigDecimal correctChange = priceDiff
                        .divide(previousPrice, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));
                    
                    // Check if stored value is different
                    if (storedChange == null || storedChange.compareTo(correctChange) != 0) {
                        // Update the stored value
                        jdbcTemplate.update(
                            "UPDATE price_snapshots SET price_change_percent = ? WHERE id = ?",
                            correctChange, current.get("id")
                        );
                        fixedCount++;
                        logger.debug("validateAndFixPriceChanges: Fixed price change for snapshot {}: {}% -> {}%", 
                            current.get("id"), storedChange, correctChange);
                    }
                }
            }
            
            if (fixedCount > 0) {
                logger.info("validateAndFixPriceChanges: Fixed {} price change calculations for competitor {}", fixedCount, competitorId);
            } else {
                logger.debug("validateAndFixPriceChanges: No fixes needed for competitor {}", competitorId);
            }
            
        } catch (Exception e) {
            logger.error("validateAndFixPriceChanges: Error validating price changes for competitor {}: {}", competitorId, e.getMessage());
        }
    }

    /**
     * Check if price change is significant based on configurable threshold
     */
    public boolean isSignificantPriceChange(BigDecimal percentChange, BigDecimal threshold) {
        if (percentChange == null || threshold == null) {
            return false;
        }
        return percentChange.abs().compareTo(threshold) >= 0;
    }

    /**
     * Get price trend analysis (increasing, decreasing, stable)
     */
    public String getPriceTrend(Long competitorId, int days) {
        try {
            Optional<BigDecimal> change = calculatePriceChangeOverPeriod(competitorId, days);
            if (!change.isPresent()) {
                return "insufficient_data";
            }
            
            BigDecimal percentChange = change.get();
            if (percentChange.compareTo(BigDecimal.valueOf(1)) > 0) {
                return "increasing";
            } else if (percentChange.compareTo(BigDecimal.valueOf(-1)) < 0) {
                return "decreasing";
            } else {
                return "stable";
            }
        } catch (Exception e) {
            logger.warn("getPriceTrend: Error analyzing price trend for competitor {}: {}", competitorId, e.getMessage());
            return "unknown";
        }
    }
} 