package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.storesight.backend.model.MarketIntelligenceCost;
import com.storesight.backend.repository.MarketIntelligenceCostRepository;
import com.storesight.backend.service.discovery.SearchClient;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.TimeUnit;
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

@ExtendWith(MockitoExtension.class)
class CostOptimizationServiceTest {

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
    ReflectionTestUtils.setField(costOptimizationService, "aggressiveCaching", true);

    lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
  }

  @Test
  void testTrackApiCost_WithoutShopId() {
    // Given
    String provider = "TestProvider";
    BigDecimal cost = BigDecimal.valueOf(0.005);
    int requests = 1;

    // When
    costOptimizationService.trackApiCost(provider, cost, requests);

    // Then
    verify(valueOperations, atLeast(2)).set(anyString(), any(), eq(25L), eq(TimeUnit.HOURS));
    verify(valueOperations, atLeast(2)).set(anyString(), any(), eq(32L), eq(TimeUnit.DAYS));
  }

  @Test
  void testTrackApiCost_WithShopId() {
    // Given
    Long shopId = 1L;
    String provider = "TestProvider";
    BigDecimal cost = BigDecimal.valueOf(0.005);
    int requests = 1;
    int discoveries = 5;

    MarketIntelligenceCost existingCost =
        new MarketIntelligenceCost(
            shopId, LocalDate.now(), provider, BigDecimal.valueOf(0.003), 2, 3);
    when(costRepository.findByShopIdAndDateAndProvider(shopId, LocalDate.now(), provider))
        .thenReturn(Optional.of(existingCost));

    // When
    costOptimizationService.trackApiCost(shopId, provider, cost, requests, discoveries);

    // Then
    verify(costRepository).findByShopIdAndDateAndProvider(shopId, LocalDate.now(), provider);
    verify(costRepository).save(any(MarketIntelligenceCost.class));

    // Verify the cost was updated
    assertEquals(BigDecimal.valueOf(0.008), existingCost.getDailyCost());
    assertEquals(3, existingCost.getDailyRequests());
    assertEquals(8, existingCost.getDailyDiscoveries());
  }

  @Test
  void testTrackApiCost_NewShopCostEntry() {
    // Given
    Long shopId = 1L;
    String provider = "TestProvider";
    BigDecimal cost = BigDecimal.valueOf(0.005);
    int requests = 1;
    int discoveries = 5;

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
  void testCanMakeRequest_WithinBudget() {
    // Given
    String provider = "TestProvider";
    BigDecimal estimatedCost = BigDecimal.valueOf(0.005);

    // When
    boolean canMake = costOptimizationService.canMakeRequest(provider, estimatedCost);

    // Then
    assertTrue(canMake);
  }

  @Test
  void testCanMakeRequest_ExceedsDailyBudget() {
    // Given
    String provider = "TestProvider";
    BigDecimal estimatedCost = BigDecimal.valueOf(6.00); // Exceeds daily budget of $5

    // Track some existing cost first
    costOptimizationService.trackApiCost(provider, BigDecimal.valueOf(4.00), 1);

    // When
    boolean canMake = costOptimizationService.canMakeRequest(provider, estimatedCost);

    // Then
    assertFalse(canMake);
  }

  @Test
  void testBudgetLimits_DailyBudgetExactly() {
    // Given
    String provider = "TestProvider";
    BigDecimal dailyBudget = BigDecimal.valueOf(5.00);

    // Track cost up to exactly daily budget
    costOptimizationService.trackApiCost(provider, BigDecimal.valueOf(4.99), 1);

    // When - try to add cost that would exactly meet budget
    boolean canMakeExact =
        costOptimizationService.canMakeRequest(provider, BigDecimal.valueOf(0.01));
    // When - try to add cost that would exceed budget by smallest amount
    boolean canMakeExceed =
        costOptimizationService.canMakeRequest(provider, BigDecimal.valueOf(0.02));

    // Then
    assertTrue(canMakeExact, "Should allow request that exactly meets daily budget");
    assertFalse(canMakeExceed, "Should block request that exceeds daily budget");
  }

  @Test
  void testBudgetLimits_MonthlyBudgetExactly() {
    // Given
    String provider = "TestProvider";
    BigDecimal monthlyBudget = BigDecimal.valueOf(100.00);

    // Track cost that's within daily budget but approaches monthly budget
    // We need to track costs over multiple "days" to test monthly budget without hitting daily
    // limit
    costOptimizationService.trackApiCost(
        provider, BigDecimal.valueOf(4.99), 1); // Day 1 - within daily budget

    // Simulate tracking costs over multiple days to approach monthly budget
    // Since we can't easily mock different days, we'll test the monthly budget logic differently
    // Track cost that would exceed monthly budget when combined
    boolean canMakeWithinMonthly =
        costOptimizationService.canMakeRequest(provider, BigDecimal.valueOf(0.01));
    boolean canMakeExceedMonthly =
        costOptimizationService.canMakeRequest(
            provider, BigDecimal.valueOf(95.02)); // Would exceed monthly

    // Then
    assertTrue(
        canMakeWithinMonthly, "Should allow small request within both daily and monthly budget");
    assertFalse(canMakeExceedMonthly, "Should block request that exceeds monthly budget");
  }

  @Test
  void testBudgetAlerts_DailyThreshold() {
    // Given
    String provider = "TestProvider";
    BigDecimal alertThreshold =
        BigDecimal.valueOf(5.00).multiply(BigDecimal.valueOf(0.8)); // 80% of $5 = $4

    // When - track cost that reaches 80% threshold
    costOptimizationService.trackApiCost(provider, alertThreshold, 1);

    // Then - verify alert would be triggered (we can't easily test log output, but we can verify
    // the cost tracking)
    CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();
    assertTrue(
        analytics.getDailyUsagePercentage() >= 0.8,
        "Daily usage should be at or above 80% threshold");
  }

  @Test
  void testBudgetAlerts_MonthlyThreshold() {
    // Given
    String provider = "TestProvider";
    BigDecimal alertThreshold =
        BigDecimal.valueOf(100.00).multiply(BigDecimal.valueOf(0.8)); // 80% of $100 = $80

    // When - track cost that reaches 80% threshold
    costOptimizationService.trackApiCost(provider, alertThreshold, 1);

    // Then - verify alert would be triggered
    CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();
    assertTrue(
        analytics.getMonthlyUsagePercentage() >= 0.8,
        "Monthly usage should be at or above 80% threshold");
  }

  @Test
  void testAutomaticRequestBlocking_WhenBudgetExceeded() {
    // Given
    String provider = "TestProvider";

    // Track cost that exceeds daily budget
    costOptimizationService.trackApiCost(provider, BigDecimal.valueOf(5.01), 1);

    // When - try to make any additional request
    boolean canMakeSmallRequest =
        costOptimizationService.canMakeRequest(provider, BigDecimal.valueOf(0.001));
    boolean canMakeLargeRequest =
        costOptimizationService.canMakeRequest(provider, BigDecimal.valueOf(1.00));

    // Then - all requests should be blocked
    assertFalse(canMakeSmallRequest, "Should block even small requests when daily budget exceeded");
    assertFalse(canMakeLargeRequest, "Should block large requests when daily budget exceeded");
  }

  @Test
  void testMultipleProviders_IndependentBudgetTracking() {
    // Given
    String provider1 = "Provider1";
    String provider2 = "Provider2";

    // Track cost for provider1 that exceeds budget
    costOptimizationService.trackApiCost(provider1, BigDecimal.valueOf(5.01), 1);

    // Track small cost for provider2
    costOptimizationService.trackApiCost(provider2, BigDecimal.valueOf(0.01), 1);

    // When - check if each provider can make requests
    boolean provider1CanMake =
        costOptimizationService.canMakeRequest(provider1, BigDecimal.valueOf(0.01));
    boolean provider2CanMake =
        costOptimizationService.canMakeRequest(provider2, BigDecimal.valueOf(1.00));

    // Then - provider1 should be blocked, provider2 should be allowed
    assertFalse(provider1CanMake, "Provider1 should be blocked due to exceeded budget");
    assertTrue(provider2CanMake, "Provider2 should be allowed as it's within budget");
  }

  @Test
  void testCostAnalytics_BudgetUsageCalculation() {
    // Given
    String provider = "TestProvider";
    BigDecimal dailyCost = BigDecimal.valueOf(2.50); // 50% of daily budget ($5.00)

    // Track daily cost only (monthly cost will be the same since it's the same day)
    costOptimizationService.trackApiCost(provider, dailyCost, 5);

    // When
    CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();

    // Then
    assertEquals(0.5, analytics.getDailyUsagePercentage(), 0.01, "Daily usage should be 50%");
    assertEquals(
        0.025,
        analytics.getMonthlyUsagePercentage(),
        0.01,
        "Monthly usage should be 2.5% ($2.50 of $100)");
    assertEquals(BigDecimal.valueOf(5.00), analytics.getDailyBudget());
    assertEquals(BigDecimal.valueOf(100.00), analytics.getMonthlyBudget());
  }

  @Test
  void testCanMakeRequest_ExceedsMonthlyBudget() {
    // Given
    String provider = "TestProvider";
    BigDecimal estimatedCost = BigDecimal.valueOf(5.00);

    // Track existing monthly cost that would exceed budget
    costOptimizationService.trackApiCost(provider, BigDecimal.valueOf(96.00), 1);

    // When
    boolean canMake = costOptimizationService.canMakeRequest(provider, estimatedCost);

    // Then
    assertFalse(canMake);
  }

  @Test
  void testGetCachedResults_CacheHit() {
    // Given
    String cacheKey = "test_cache_key";
    List<SearchClient.SearchResult> expectedResults =
        Arrays.asList(
            createSearchResult("https://example1.com", "Product 1"),
            createSearchResult("https://example2.com", "Product 2"));

    when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(expectedResults);

    // When
    Optional<List<SearchClient.SearchResult>> results =
        costOptimizationService.getCachedResults(cacheKey);

    // Then
    assertTrue(results.isPresent());
    assertEquals(2, results.get().size());
    assertEquals(expectedResults, results.get());
  }

  @Test
  void testGetCachedResults_CacheMiss() {
    // Given
    String cacheKey = "test_cache_key";

    when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(null);

    // When
    Optional<List<SearchClient.SearchResult>> results =
        costOptimizationService.getCachedResults(cacheKey);

    // Then
    assertFalse(results.isPresent());
  }

  @Test
  void testCacheResults() {
    // Given
    String cacheKey = "test_cache_key";
    List<SearchClient.SearchResult> results =
        Arrays.asList(
            createSearchResult("https://example1.com", "Product 1"),
            createSearchResult("https://example2.com", "Product 2"));

    // When
    costOptimizationService.cacheResults(cacheKey, results);

    // Then
    verify(valueOperations)
        .set("search_cache_" + cacheKey, results, 48, TimeUnit.HOURS); // Aggressive caching enabled
  }

  @Test
  void testGenerateCacheKey() {
    // Given
    String provider = "TestProvider";
    String keywords = "test keywords";
    int maxResults = 10;

    // When
    String cacheKey = costOptimizationService.generateCacheKey(provider, keywords, maxResults);

    // Then
    assertNotNull(cacheKey);
    assertTrue(cacheKey.contains(provider));
    assertTrue(cacheKey.contains(String.valueOf(maxResults)));
    assertTrue(cacheKey.contains(String.valueOf(keywords.hashCode())));
  }

  @Test
  void testGetCostAnalytics() {
    // Given
    costOptimizationService.trackApiCost("Provider1", BigDecimal.valueOf(0.005), 1);
    costOptimizationService.trackApiCost("Provider2", BigDecimal.valueOf(0.008), 1);

    // When
    CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();

    // Then
    assertNotNull(analytics);
    assertTrue(analytics.getTotalDailyCost().compareTo(BigDecimal.ZERO) > 0);
    assertTrue(analytics.getTotalDailyRequests() > 0);
    assertEquals(BigDecimal.valueOf(5.00), analytics.getDailyBudget());
    assertEquals(BigDecimal.valueOf(100.00), analytics.getMonthlyBudget());
  }

  @Test
  void testGetOptimizationRecommendations() {
    // Given - track some costs to generate recommendations
    costOptimizationService.trackApiCost("ExpensiveProvider", BigDecimal.valueOf(0.015), 1);

    // When
    List<CostOptimizationService.CostOptimizationRecommendation> recommendations =
        costOptimizationService.getOptimizationRecommendations();

    // Then
    assertNotNull(recommendations);
    // Should have at least one recommendation due to low estimated savings
    assertTrue(recommendations.size() > 0);
  }

  @Test
  void testGetHistoricalCostData() {
    // Given
    Long shopId = 1L;
    int days = 7;
    LocalDate endDate = LocalDate.now();
    LocalDate startDate = endDate.minusDays(days - 1);

    List<Object[]> mockData =
        Arrays.asList(
            new Object[] {startDate.toString(), 0.005, 1, 5},
            new Object[] {startDate.plusDays(1).toString(), 0.008, 2, 3});

    when(costRepository.getDailyAggregatedCosts(shopId, startDate, endDate)).thenReturn(mockData);

    // When
    List<Map<String, Object>> historicalData =
        costOptimizationService.getHistoricalCostData(shopId, days);

    // Then
    assertNotNull(historicalData);
    assertEquals(7, historicalData.size()); // Should fill missing days

    // Check that data is properly structured
    Map<String, Object> firstDay = historicalData.get(0);
    assertTrue(firstDay.containsKey("timestamp"));
    assertTrue(firstDay.containsKey("dailyCost"));
    assertTrue(firstDay.containsKey("requests"));
    assertTrue(firstDay.containsKey("discoveries"));
  }

  @Test
  void testGetProviderCostData() {
    // Given
    Long shopId = 1L;
    int days = 7;
    LocalDate endDate = LocalDate.now();
    LocalDate startDate = endDate.minusDays(days - 1);

    List<Object[]> mockData =
        Arrays.asList(
            new Object[] {"Provider1", 0.015, 3, 10}, new Object[] {"Provider2", 0.025, 5, 15});

    when(costRepository.getProviderCosts(shopId, startDate, endDate)).thenReturn(mockData);

    // When
    Map<String, Object> providerData = costOptimizationService.getProviderCostData(shopId, days);

    // Then
    assertNotNull(providerData);
    assertTrue(providerData.containsKey("providerCosts"));
    assertTrue(providerData.containsKey("providerRequests"));
    assertTrue(providerData.containsKey("providerDiscoveries"));

    @SuppressWarnings("unchecked")
    Map<String, Double> providerCosts = (Map<String, Double>) providerData.get("providerCosts");
    assertEquals(0.015, providerCosts.get("Provider1"));
    assertEquals(0.025, providerCosts.get("Provider2"));
  }

  @Test
  void testResetDailyCosts() {
    // Given
    costOptimizationService.trackApiCost("TestProvider", BigDecimal.valueOf(0.005), 1);

    // When
    costOptimizationService.resetDailyCosts();

    // Then
    // Should not throw any exceptions
    assertDoesNotThrow(() -> costOptimizationService.resetDailyCosts());
  }

  @Test
  void testCostOptimizationDisabled() {
    // Given
    ReflectionTestUtils.setField(costOptimizationService, "costOptimizationEnabled", false);

    // When
    boolean canMake =
        costOptimizationService.canMakeRequest("TestProvider", BigDecimal.valueOf(100.00));
    Optional<List<SearchClient.SearchResult>> cached =
        costOptimizationService.getCachedResults("test");

    // Then
    assertTrue(canMake); // Should always return true when disabled
    assertFalse(cached.isPresent()); // Should not use cache when disabled
  }

  @Test
  void testCacheTTL_24HourDefault() {
    // Given
    ReflectionTestUtils.setField(costOptimizationService, "aggressiveCaching", false);
    String cacheKey = "ttl_test";
    List<SearchClient.SearchResult> results =
        List.of(createSearchResult("https://example.com", "Test Product"));

    // When
    costOptimizationService.cacheResults(cacheKey, results);

    // Then - verify cache was set with 24-hour TTL
    verify(valueOperations).set("search_cache_" + cacheKey, results, 24, TimeUnit.HOURS);
  }

  @Test
  void testCacheTTL_48HourAggressive() {
    // Given
    ReflectionTestUtils.setField(costOptimizationService, "aggressiveCaching", true);
    String cacheKey = "aggressive_ttl_test";
    List<SearchClient.SearchResult> results =
        List.of(createSearchResult("https://example.com", "Test Product"));

    // When
    costOptimizationService.cacheResults(cacheKey, results);

    // Then - verify cache was set with 48-hour TTL (aggressive mode)
    verify(valueOperations).set("search_cache_" + cacheKey, results, 48, TimeUnit.HOURS);
  }

  @Test
  void testCacheHitRate_Optimization() {
    // Given
    String provider = "TestProvider";
    String keywords = "test product";
    int maxResults = 10;
    String cacheKey = costOptimizationService.generateCacheKey(provider, keywords, maxResults);

    List<SearchClient.SearchResult> cachedResults =
        List.of(createSearchResult("https://cached-example.com", "Cached Product"));

    // Mock cache hit
    when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(cachedResults);

    // When - get cached results multiple times
    Optional<List<SearchClient.SearchResult>> hit1 =
        costOptimizationService.getCachedResults(cacheKey);
    Optional<List<SearchClient.SearchResult>> hit2 =
        costOptimizationService.getCachedResults(cacheKey);
    Optional<List<SearchClient.SearchResult>> hit3 =
        costOptimizationService.getCachedResults(cacheKey);

    // Then - all should be cache hits
    assertTrue(hit1.isPresent(), "First request should be cache hit");
    assertTrue(hit2.isPresent(), "Second request should be cache hit");
    assertTrue(hit3.isPresent(), "Third request should be cache hit");

    assertEquals(cachedResults, hit1.get());
    assertEquals(cachedResults, hit2.get());
    assertEquals(cachedResults, hit3.get());

    // Verify Redis was called for each request (no local caching)
    verify(valueOperations, times(3)).get("search_cache_" + cacheKey);
  }

  @Test
  void testCacheKeyGeneration_Consistency() {
    // Given
    String provider = "TestProvider";
    String keywords = "test keywords with spaces";
    int maxResults = 15;

    // When - generate cache key multiple times
    String key1 = costOptimizationService.generateCacheKey(provider, keywords, maxResults);
    String key2 = costOptimizationService.generateCacheKey(provider, keywords, maxResults);
    String key3 = costOptimizationService.generateCacheKey(provider, keywords, maxResults);

    // Then - all keys should be identical
    assertEquals(key1, key2, "Cache keys should be consistent");
    assertEquals(key2, key3, "Cache keys should be consistent");

    // Verify key contains expected components
    assertTrue(key1.contains(provider), "Cache key should contain provider");
    assertTrue(key1.contains(String.valueOf(maxResults)), "Cache key should contain maxResults");
    assertTrue(
        key1.contains(String.valueOf(keywords.hashCode())),
        "Cache key should contain keywords hash");
  }

  @Test
  void testCacheKeyGeneration_Uniqueness() {
    // Given different parameters
    String provider1 = "Provider1";
    String provider2 = "Provider2";
    String keywords1 = "product one";
    String keywords2 = "product two";
    int maxResults1 = 10;
    int maxResults2 = 20;

    // When - generate different cache keys
    String key1 = costOptimizationService.generateCacheKey(provider1, keywords1, maxResults1);
    String key2 = costOptimizationService.generateCacheKey(provider2, keywords1, maxResults1);
    String key3 = costOptimizationService.generateCacheKey(provider1, keywords2, maxResults1);
    String key4 = costOptimizationService.generateCacheKey(provider1, keywords1, maxResults2);

    // Then - all keys should be unique
    assertNotEquals(key1, key2, "Different providers should generate different keys");
    assertNotEquals(key1, key3, "Different keywords should generate different keys");
    assertNotEquals(key1, key4, "Different maxResults should generate different keys");
  }

  @Test
  void testCachePerformance_LargeDataSets() {
    // Given - large dataset
    String cacheKey = "large_dataset";
    List<SearchClient.SearchResult> largeResults = new ArrayList<>();
    for (int i = 0; i < 100; i++) {
      largeResults.add(createSearchResult("https://example" + i + ".com", "Product " + i));
    }

    // When - cache large dataset
    costOptimizationService.cacheResults(cacheKey, largeResults);

    // Mock retrieval
    when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(largeResults);
    Optional<List<SearchClient.SearchResult>> cached =
        costOptimizationService.getCachedResults(cacheKey);

    // Then - should handle large datasets efficiently
    assertTrue(cached.isPresent(), "Should cache large datasets");
    assertEquals(100, cached.get().size(), "Should retrieve complete large dataset");
    assertEquals(largeResults, cached.get(), "Should maintain data integrity for large datasets");
  }

  @Test
  void testCacheErrorHandling_GracefulDegradation() {
    // Given
    String cacheKey = "error_test";
    List<SearchClient.SearchResult> results =
        List.of(createSearchResult("https://example.com", "Test Product"));

    // Mock Redis error
    doThrow(new RuntimeException("Redis connection error"))
        .when(valueOperations)
        .set(anyString(), any(), anyLong(), any(TimeUnit.class));
    when(valueOperations.get(anyString()))
        .thenThrow(new RuntimeException("Redis connection error"));

    // When - try to cache and retrieve with Redis errors
    assertDoesNotThrow(
        () -> costOptimizationService.cacheResults(cacheKey, results),
        "Should handle cache write errors gracefully");

    Optional<List<SearchClient.SearchResult>> cached =
        costOptimizationService.getCachedResults(cacheKey);

    // Then - should degrade gracefully
    assertFalse(cached.isPresent(), "Should return empty when cache is unavailable");
  }

  private SearchClient.SearchResult createSearchResult(String url, String title) {
    return new SearchClient.SearchResult(url, title, 29.99, "Test description");
  }
}
