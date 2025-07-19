package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.storesight.backend.model.MarketIntelligenceCost;
import com.storesight.backend.repository.MarketIntelligenceCostRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Basic test for Market Intelligence cost optimization functionality. Demonstrates the testing
 * infrastructure and validates core cost tracking.
 */
@ExtendWith(MockitoExtension.class)
class MarketIntelligenceBasicTest {

  @Mock private RedisTemplate<String, Object> redisTemplate;
  @Mock private ValueOperations<String, Object> valueOperations;
  @Mock private JdbcTemplate jdbcTemplate;
  @Mock private MarketIntelligenceCostRepository costRepository;

  @InjectMocks private CostOptimizationService costOptimizationService;

  @BeforeEach
  void setUp() {
    // Set up test configuration
    ReflectionTestUtils.setField(costOptimizationService, "costOptimizationEnabled", true);
    ReflectionTestUtils.setField(costOptimizationService, "dailyBudget", BigDecimal.valueOf(5.00));
    ReflectionTestUtils.setField(
        costOptimizationService, "monthlyBudget", BigDecimal.valueOf(100.00));
    ReflectionTestUtils.setField(costOptimizationService, "alertThreshold", 0.8);
    ReflectionTestUtils.setField(costOptimizationService, "cacheTtlHours", 24);
    ReflectionTestUtils.setField(costOptimizationService, "aggressiveCaching", false);

    lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
  }

  @Test
  void testCostTrackingBasicFunctionality() {
    // Given
    Long shopId = 1L;
    String provider = "TestProvider";
    BigDecimal cost = BigDecimal.valueOf(0.05);
    int requests = 1;
    int discoveries = 3;

    MarketIntelligenceCost existingCost = new MarketIntelligenceCost();
    existingCost.setShopId(shopId);
    existingCost.setDate(LocalDate.now());
    existingCost.setProvider(provider);
    existingCost.setDailyCost(BigDecimal.valueOf(0.02));
    existingCost.setDailyRequests(2);
    existingCost.setDailyDiscoveries(1);

    when(costRepository.findByShopIdAndDateAndProvider(shopId, LocalDate.now(), provider))
        .thenReturn(Optional.of(existingCost));

    // When
    costOptimizationService.trackApiCost(shopId, provider, cost, requests, discoveries);

    // Then
    verify(costRepository).findByShopIdAndDateAndProvider(shopId, LocalDate.now(), provider);
    verify(costRepository).save(any(MarketIntelligenceCost.class));

    // Verify the cost was updated correctly
    assertEquals(BigDecimal.valueOf(0.07), existingCost.getDailyCost()); // 0.02 + 0.05
    assertEquals(3, existingCost.getDailyRequests()); // 2 + 1
    assertEquals(4, existingCost.getDailyDiscoveries()); // 1 + 3
  }

  @Test
  void testBudgetCheckingFunctionality() {
    // Given
    String provider = "TestProvider";
    BigDecimal smallCost = BigDecimal.valueOf(0.01);
    BigDecimal largeCost = BigDecimal.valueOf(6.00); // Exceeds daily budget

    // When & Then - Small cost should be allowed
    boolean canMakeSmallRequest = costOptimizationService.canMakeRequest(provider, smallCost);
    assertTrue(canMakeSmallRequest, "Small cost should be within budget");

    // When & Then - Large cost should be blocked
    boolean canMakeLargeRequest = costOptimizationService.canMakeRequest(provider, largeCost);
    assertFalse(canMakeLargeRequest, "Large cost should exceed budget");
  }

  @Test
  void testCostAnalyticsGeneration() {
    // Given
    costOptimizationService.trackApiCost("Provider1", BigDecimal.valueOf(0.01), 1);
    costOptimizationService.trackApiCost("Provider2", BigDecimal.valueOf(0.02), 1);

    // When
    CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();

    // Then
    assertNotNull(analytics, "Analytics should not be null");
    assertTrue(
        analytics.getTotalDailyCost().compareTo(BigDecimal.ZERO) > 0, "Should have tracked costs");
    assertTrue(analytics.getTotalDailyRequests() > 0, "Should have tracked requests");
    assertEquals(
        BigDecimal.valueOf(5.00),
        analytics.getDailyBudget(),
        "Daily budget should match configuration");
    assertEquals(
        BigDecimal.valueOf(100.00),
        analytics.getMonthlyBudget(),
        "Monthly budget should match configuration");
  }

  @Test
  void testCacheKeyGeneration() {
    // Given
    String provider = "TestProvider";
    String keywords = "test keywords";
    int maxResults = 10;

    // When
    String cacheKey1 = costOptimizationService.generateCacheKey(provider, keywords, maxResults);
    String cacheKey2 = costOptimizationService.generateCacheKey(provider, keywords, maxResults);

    // Then
    assertNotNull(cacheKey1, "Cache key should not be null");
    assertNotNull(cacheKey2, "Cache key should not be null");
    assertEquals(cacheKey1, cacheKey2, "Cache keys should be consistent");
    assertTrue(cacheKey1.contains(provider), "Cache key should contain provider");
    assertTrue(
        cacheKey1.contains(String.valueOf(maxResults)), "Cache key should contain max results");
  }

  @Test
  void testNewCostRecordCreation() {
    // Given
    Long shopId = 2L;
    String provider = "NewProvider";
    BigDecimal cost = BigDecimal.valueOf(0.03);
    int requests = 1;
    int discoveries = 2;

    when(costRepository.findByShopIdAndDateAndProvider(shopId, LocalDate.now(), provider))
        .thenReturn(Optional.empty());

    // When
    costOptimizationService.trackApiCost(shopId, provider, cost, requests, discoveries);

    // Then
    verify(costRepository).findByShopIdAndDateAndProvider(shopId, LocalDate.now(), provider);
    verify(costRepository)
        .save(
            argThat(
                costData ->
                    costData.getShopId().equals(shopId)
                        && costData.getProvider().equals(provider)
                        && costData.getDailyCost().equals(cost)
                        && costData.getDailyRequests() == requests
                        && costData.getDailyDiscoveries() == discoveries));
  }

  @Test
  void testBudgetThresholdCalculations() {
    // Given
    String provider = "ThresholdProvider";
    BigDecimal dailyBudget = BigDecimal.valueOf(5.00);
    BigDecimal alertThreshold = dailyBudget.multiply(BigDecimal.valueOf(0.8)); // 80% = $4.00

    // Track cost that reaches 80% threshold
    costOptimizationService.trackApiCost(provider, alertThreshold, 1);

    // When
    CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();

    // Then
    assertTrue(
        analytics.getDailyUsagePercentage() >= 0.8,
        "Daily usage should be at or above 80% threshold");
    assertTrue(analytics.getDailyUsagePercentage() <= 1.0, "Daily usage should not exceed 100%");
  }

  @Test
  void testCostOptimizationDisabled() {
    // Given
    ReflectionTestUtils.setField(costOptimizationService, "costOptimizationEnabled", false);

    // When
    boolean canMakeExpensiveRequest =
        costOptimizationService.canMakeRequest("TestProvider", BigDecimal.valueOf(100.00));

    // Then
    assertTrue(
        canMakeExpensiveRequest, "Should allow all requests when cost optimization is disabled");
  }

  @Test
  void testMultipleProviderCostTracking() {
    // Given
    String provider1 = "Provider1";
    String provider2 = "Provider2";
    BigDecimal cost1 = BigDecimal.valueOf(0.01);
    BigDecimal cost2 = BigDecimal.valueOf(0.02);

    // When
    costOptimizationService.trackApiCost(provider1, cost1, 1);
    costOptimizationService.trackApiCost(provider2, cost2, 1);

    // Then
    CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();
    assertEquals(
        BigDecimal.valueOf(0.03),
        analytics.getTotalDailyCost().setScale(2),
        "Should track costs from multiple providers");
    assertEquals(
        2, analytics.getTotalDailyRequests(), "Should track requests from multiple providers");
  }
}
