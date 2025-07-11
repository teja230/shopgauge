package com.storesight.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Service to manage competitor tracking limits and prevent system overload. Currently supports
 * single-plan structure with room for future tier expansion.
 */
@Service
public class CompetitorLimitService {

  private static final Logger log = LoggerFactory.getLogger(CompetitorLimitService.class);

  @Autowired private JdbcTemplate jdbcTemplate;

  // Current single-plan limits (reasonable limits for current customers)
  @Value("${competitor.limits.current-plan:10}")
  private int currentPlanLimit;

  // Future tier limits (ready for expansion)
  @Value("${competitor.limits.basic-tier:25}")
  private int basicTierLimit;

  @Value("${competitor.limits.premium-tier:100}")
  private int premiumTierLimit;

  @Value("${competitor.limits.enterprise-tier:500}")
  private int enterpriseTierLimit;

  // Discovery limits to prevent API abuse
  @Value("${competitor.discovery.max-suggestions-per-product:5}")
  private int maxSuggestionsPerProduct;

  @Value("${competitor.discovery.max-products-per-shop:50}")
  private int maxProductsPerShop;

  @Value("${competitor.discovery.max-total-suggestions:200}")
  private int maxTotalSuggestions;

  // Scraping limits to prevent resource exhaustion
  @Value("${competitor.scraping.max-urls-per-shop:100}")
  private int maxUrlsPerShop;

  @Value("${competitor.scraping.max-concurrent-scrapers:3}")
  private int maxConcurrentScrapers;

  // Enum for future plan types
  public enum PlanType {
    CURRENT("current", "Current Plan"),
    BASIC("basic", "Basic Plan"),
    PREMIUM("premium", "Premium Plan"),
    ENTERPRISE("enterprise", "Enterprise Plan");

    private final String code;
    private final String displayName;

    PlanType(String code, String displayName) {
      this.code = code;
      this.displayName = displayName;
    }

    public String getCode() {
      return code;
    }

    public String getDisplayName() {
      return displayName;
    }
  }

  /**
   * Check if a shop can add more competitors Currently all shops use the same plan with generous
   * limits
   */
  public LimitCheckResult checkCompetitorLimit(Long shopId) {
    try {
      // Get current competitor count for this shop
      Integer currentCount =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(*) FROM competitor_urls WHERE shop_id = ? AND deleted_at IS NULL",
              Integer.class,
              shopId);

      if (currentCount == null) {
        currentCount = 0;
      }

      // For now, all shops use the current plan
      PlanType planType = getCurrentPlanType(shopId);
      int limit = getCompetitorLimit(planType);

      boolean canAdd = currentCount < limit;
      int remaining = Math.max(0, limit - currentCount);

      log.debug(
          "Shop {} has {}/{} competitors (plan: {})",
          shopId,
          currentCount,
          limit,
          planType.getDisplayName());

      return new LimitCheckResult(canAdd, currentCount, limit, remaining, planType);

    } catch (Exception e) {
      log.error("Error checking competitor limit for shop {}: {}", shopId, e.getMessage());
      // Fail safe - allow addition if we can't check
      return new LimitCheckResult(true, 0, currentPlanLimit, currentPlanLimit, PlanType.CURRENT);
    }
  }

  /** Check if a shop can discover more competitors */
  public DiscoveryLimitResult checkDiscoveryLimit(Long shopId) {
    try {
      // Get current suggestion count for this shop
      Integer currentSuggestions =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(*) FROM competitor_suggestions WHERE shop_id = ? AND processed = false",
              Integer.class,
              shopId);

      if (currentSuggestions == null) {
        currentSuggestions = 0;
      }

      boolean canDiscover = currentSuggestions < maxTotalSuggestions;
      int remaining = Math.max(0, maxTotalSuggestions - currentSuggestions);

      log.debug(
          "Shop {} has {}/{} pending suggestions", shopId, currentSuggestions, maxTotalSuggestions);

      return new DiscoveryLimitResult(
          canDiscover, currentSuggestions, maxTotalSuggestions, remaining);

    } catch (Exception e) {
      log.error("Error checking discovery limit for shop {}: {}", shopId, e.getMessage());
      // Fail safe - allow discovery if we can't check
      return new DiscoveryLimitResult(true, 0, maxTotalSuggestions, maxTotalSuggestions);
    }
  }

  /** Get comprehensive limits for a shop */
  public LimitsResponse getShopLimits(Long shopId) {
    LimitCheckResult competitorLimit = checkCompetitorLimit(shopId);
    DiscoveryLimitResult discoveryLimit = checkDiscoveryLimit(shopId);

    return new LimitsResponse(
        competitorLimit,
        discoveryLimit,
        maxSuggestionsPerProduct,
        maxProductsPerShop,
        maxUrlsPerShop,
        maxConcurrentScrapers,
        getUpgradeMessage(competitorLimit.getPlanType()));
  }

  /**
   * Get the current plan type for a shop Currently all shops use the same plan, but ready for
   * future expansion
   */
  private PlanType getCurrentPlanType(Long shopId) {
    // For now, all shops use the current plan
    // Future logic could check shop.plan_type or shop.subscription_tier
    return PlanType.CURRENT;
  }

  /** Get competitor limit for a plan type */
  private int getCompetitorLimit(PlanType planType) {
    switch (planType) {
      case CURRENT:
        return currentPlanLimit;
      case BASIC:
        return basicTierLimit;
      case PREMIUM:
        return premiumTierLimit;
      case ENTERPRISE:
        return enterpriseTierLimit;
      default:
        return currentPlanLimit;
    }
  }

  /** Get upgrade message for plan type */
  private String getUpgradeMessage(PlanType planType) {
    switch (planType) {
      case CURRENT:
        return "Track up to "
            + currentPlanLimit
            + " competitors. Upgrade for unlimited tracking coming soon!";
      case BASIC:
        return "Upgrade to Premium for more competitor tracking (up to "
            + premiumTierLimit
            + " competitors)";
      case PREMIUM:
        return "Upgrade to Enterprise for unlimited competitor tracking";
      case ENTERPRISE:
        return "Unlimited competitor tracking included";
      default:
        return "Contact support for plan details";
    }
  }

  /** Result classes for API responses */
  public static class LimitCheckResult {
    private final boolean canAdd;
    private final int current;
    private final int limit;
    private final int remaining;
    private final PlanType planType;

    public LimitCheckResult(
        boolean canAdd, int current, int limit, int remaining, PlanType planType) {
      this.canAdd = canAdd;
      this.current = current;
      this.limit = limit;
      this.remaining = remaining;
      this.planType = planType;
    }

    public boolean isCanAdd() {
      return canAdd;
    }

    public int getCurrent() {
      return current;
    }

    public int getLimit() {
      return limit;
    }

    public int getRemaining() {
      return remaining;
    }

    public PlanType getPlanType() {
      return planType;
    }
  }

  public static class DiscoveryLimitResult {
    private final boolean canDiscover;
    private final int current;
    private final int limit;
    private final int remaining;

    public DiscoveryLimitResult(boolean canDiscover, int current, int limit, int remaining) {
      this.canDiscover = canDiscover;
      this.current = current;
      this.limit = limit;
      this.remaining = remaining;
    }

    public boolean isCanDiscover() {
      return canDiscover;
    }

    public int getCurrent() {
      return current;
    }

    public int getLimit() {
      return limit;
    }

    public int getRemaining() {
      return remaining;
    }
  }

  public static class LimitsResponse {
    private final LimitCheckResult competitorLimit;
    private final DiscoveryLimitResult discoveryLimit;
    private final int maxSuggestionsPerProduct;
    private final int maxProductsPerShop;
    private final int maxUrlsPerShop;
    private final int maxConcurrentScrapers;
    private final String upgradeMessage;

    public LimitsResponse(
        LimitCheckResult competitorLimit,
        DiscoveryLimitResult discoveryLimit,
        int maxSuggestionsPerProduct,
        int maxProductsPerShop,
        int maxUrlsPerShop,
        int maxConcurrentScrapers,
        String upgradeMessage) {
      this.competitorLimit = competitorLimit;
      this.discoveryLimit = discoveryLimit;
      this.maxSuggestionsPerProduct = maxSuggestionsPerProduct;
      this.maxProductsPerShop = maxProductsPerShop;
      this.maxUrlsPerShop = maxUrlsPerShop;
      this.maxConcurrentScrapers = maxConcurrentScrapers;
      this.upgradeMessage = upgradeMessage;
    }

    public LimitCheckResult getCompetitorLimit() {
      return competitorLimit;
    }

    public DiscoveryLimitResult getDiscoveryLimit() {
      return discoveryLimit;
    }

    public int getMaxSuggestionsPerProduct() {
      return maxSuggestionsPerProduct;
    }

    public int getMaxProductsPerShop() {
      return maxProductsPerShop;
    }

    public int getMaxUrlsPerShop() {
      return maxUrlsPerShop;
    }

    public int getMaxConcurrentScrapers() {
      return maxConcurrentScrapers;
    }

    public String getUpgradeMessage() {
      return upgradeMessage;
    }
  }
}
