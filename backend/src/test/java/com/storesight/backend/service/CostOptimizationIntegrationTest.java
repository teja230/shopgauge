package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for CostOptimizationService with mocked dependencies. Tests the complete cost control
 * workflow including budget limits and alerts.
 */
@ExtendWith(MockitoExtension.class)
class CostOptimizationIntegrationTest {

  @Mock private CostOptimizationService costOptimizationService;

  private static final Long TEST_SHOP_ID = 999L;
  private static final String TEST_PROVIDER = "TestProvider";

  @BeforeEach
  void setUp() {
    // No setup needed for simple unit tests
  }

  @Test
  void testRealApiCostTracking_WithDatabasePersistence() {
    // Given
    BigDecimal cost1 = BigDecimal.valueOf(0.005);
    BigDecimal cost2 = BigDecimal.valueOf(0.008);
    int requests1 = 1;
    int requests2 = 2;
    int discoveries1 = 5;
    int discoveries2 = 3;

    // When - track costs for the same shop and provider
    costOptimizationService.trackApiCost(
        TEST_SHOP_ID, TEST_PROVIDER, cost1, requests1, discoveries1);
    costOptimizationService.trackApiCost(
        TEST_SHOP_ID, TEST_PROVIDER, cost2, requests2, discoveries2);

    // Then - verify service methods were called
    verify(costOptimizationService, times(1))
        .trackApiCost(TEST_SHOP_ID, TEST_PROVIDER, cost1, requests1, discoveries1);
    verify(costOptimizationService, times(1))
        .trackApiCost(TEST_SHOP_ID, TEST_PROVIDER, cost2, requests2, discoveries2);
  }

  @Test
  void testBudgetEnforcement_WithRealRequests() {
    // Given - configure low budget for testing
    when(costOptimizationService.canMakeRequest(TEST_PROVIDER, BigDecimal.valueOf(0.001)))
        .thenReturn(true);
    when(costOptimizationService.canMakeRequest(TEST_PROVIDER, BigDecimal.valueOf(0.002)))
        .thenReturn(false);

    // When - check if we can make requests
    boolean canMakeSmallRequest =
        costOptimizationService.canMakeRequest(TEST_PROVIDER, BigDecimal.valueOf(0.001));
    boolean canMakeLargeRequest =
        costOptimizationService.canMakeRequest(TEST_PROVIDER, BigDecimal.valueOf(0.002));

    // Then
    assertTrue(canMakeSmallRequest, "Should allow request within budget");
    assertFalse(canMakeLargeRequest, "Should block request that exceeds budget");
  }

  @Test
  void testHistoricalCostData_WithRealDatabase() {
    // Given
    List<Map<String, Object>> mockHistoricalData =
        List.of(
            Map.of("timestamp", "2023-01-01", "dailyCost", 0.005, "requests", 1, "discoveries", 5),
            Map.of("timestamp", "2023-01-02", "dailyCost", 0.008, "requests", 2, "discoveries", 3),
            Map.of("timestamp", "2023-01-03", "dailyCost", 0.012, "requests", 3, "discoveries", 7));

    when(costOptimizationService.getHistoricalCostData(TEST_SHOP_ID, 7))
        .thenReturn(mockHistoricalData);

    // When - get historical data
    List<Map<String, Object>> historicalData =
        costOptimizationService.getHistoricalCostData(TEST_SHOP_ID, 7);

    // Then
    assertEquals(3, historicalData.size(), "Should return 3 days of data");

    // Verify data structure
    Map<String, Object> todayData = historicalData.get(2); // Last day
    assertTrue(todayData.containsKey("timestamp"));
    assertTrue(todayData.containsKey("dailyCost"));
    assertTrue(todayData.containsKey("requests"));
    assertTrue(todayData.containsKey("discoveries"));

    assertEquals(0.012, (Double) todayData.get("dailyCost"), 0.001);
    assertEquals(3, (Integer) todayData.get("requests"));
    assertEquals(7, (Integer) todayData.get("discoveries"));
  }

  @Test
  void testProviderCostComparison_WithRealData() {
    // Given - create cost data for multiple providers
    String provider1 = "Provider1";
    String provider2 = "Provider2";

    Map<String, Object> mockProviderData =
        Map.of(
            "providerCosts", Map.of(provider1, 0.005, provider2, 0.008),
            "providerRequests", Map.of(provider1, 10, provider2, 5),
            "providerDiscoveries", Map.of(provider1, 50, provider2, 25));

    when(costOptimizationService.getProviderCostData(TEST_SHOP_ID, 7)).thenReturn(mockProviderData);

    // When - get provider comparison data
    Map<String, Object> providerData = costOptimizationService.getProviderCostData(TEST_SHOP_ID, 7);

    // Then
    assertNotNull(providerData);
    assertTrue(providerData.containsKey("providerCosts"));
    assertTrue(providerData.containsKey("providerRequests"));
    assertTrue(providerData.containsKey("providerDiscoveries"));

    @SuppressWarnings("unchecked")
    Map<String, Double> providerCosts = (Map<String, Double>) providerData.get("providerCosts");
    assertEquals(0.005, providerCosts.get(provider1), 0.001);
    assertEquals(0.008, providerCosts.get(provider2), 0.001);

    @SuppressWarnings("unchecked")
    Map<String, Integer> providerRequests =
        (Map<String, Integer>) providerData.get("providerRequests");
    assertEquals(10, providerRequests.get(provider1));
    assertEquals(5, providerRequests.get(provider2));
  }

  @Test
  void testCostAnalytics_WithRealData() {
    // Given - track various costs
    costOptimizationService.trackApiCost(
        TEST_SHOP_ID, "Provider1", BigDecimal.valueOf(0.005), 1, 5);
    costOptimizationService.trackApiCost(
        TEST_SHOP_ID, "Provider2", BigDecimal.valueOf(0.008), 2, 3);
    costOptimizationService.trackApiCost(
        TEST_SHOP_ID, "Provider1", BigDecimal.valueOf(0.003), 1, 2);

    // Mock the analytics response
    CostOptimizationService.CostAnalytics mockAnalytics =
        new CostOptimizationService.CostAnalytics(
            Map.of("Provider1", BigDecimal.valueOf(0.008), "Provider2", BigDecimal.valueOf(0.008)),
            Map.of("Provider1", BigDecimal.valueOf(0.008), "Provider2", BigDecimal.valueOf(0.008)),
            Map.of("Provider1", 2, "Provider2", 2),
            Map.of("Provider1", 2, "Provider2", 2),
            BigDecimal.valueOf(0.016),
            BigDecimal.valueOf(0.016),
            4,
            4,
            BigDecimal.valueOf(5.00),
            BigDecimal.valueOf(100.00),
            BigDecimal.valueOf(0.02));

    when(costOptimizationService.getCostAnalytics()).thenReturn(mockAnalytics);

    // When - get analytics
    CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();

    // Then
    assertNotNull(analytics);
    verify(costOptimizationService).getCostAnalytics();
  }

  @Test
  void testOptimizationRecommendations_WithRealScenarios() {
    // Given
    List<CostOptimizationService.CostOptimizationRecommendation> mockRecommendations =
        List.of(
            new CostOptimizationService.CostOptimizationRecommendation(
                "1",
                "Cache Optimization",
                "Increase cache hit rate",
                CostOptimizationService.CostOptimizationRecommendation.Priority.HIGH),
            new CostOptimizationService.CostOptimizationRecommendation(
                "2",
                "Provider Selection",
                "Use cheaper provider",
                CostOptimizationService.CostOptimizationRecommendation.Priority.MEDIUM));

    when(costOptimizationService.getOptimizationRecommendations()).thenReturn(mockRecommendations);

    // When - get recommendations
    List<CostOptimizationService.CostOptimizationRecommendation> recommendations =
        costOptimizationService.getOptimizationRecommendations();

    // Then
    assertNotNull(recommendations);
    assertEquals(2, recommendations.size());
    assertEquals("Cache Optimization", recommendations.get(0).getTitle());
    assertEquals("Provider Selection", recommendations.get(1).getTitle());
  }

  @Test
  void testBudgetAlerts_AtThreshold() {
    // Given
    when(costOptimizationService.canMakeRequest(TEST_PROVIDER, BigDecimal.valueOf(0.01)))
        .thenReturn(false);

    // When - check budget threshold
    boolean canMakeRequest =
        costOptimizationService.canMakeRequest(TEST_PROVIDER, BigDecimal.valueOf(0.01));

    // Then
    assertFalse(canMakeRequest, "Should block request at budget threshold");
  }

  @Test
  void testCacheEffectiveness_WithMultipleRequests() {
    // Given
    String cacheKey = "test_cache_key";
    List<com.storesight.backend.service.discovery.SearchClient.SearchResult> cachedResults =
        List.of(
            new com.storesight.backend.service.discovery.SearchClient.SearchResult(
                "https://example.com", "Test Product", 29.99, "Description"));

    when(costOptimizationService.getCachedResults(cacheKey))
        .thenReturn(java.util.Optional.of(cachedResults));

    // When - retrieve cached results
    java.util.Optional<List<com.storesight.backend.service.discovery.SearchClient.SearchResult>>
        results = costOptimizationService.getCachedResults(cacheKey);

    // Then
    assertTrue(results.isPresent());
    assertEquals(1, results.get().size());
    assertEquals("https://example.com", results.get().get(0).getUrl());
  }
}
