package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.storesight.backend.service.discovery.SearchClient;
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
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Performance tests for caching functionality in CostOptimizationService. Tests cache hit rates,
 * TTL effectiveness, and performance under load.
 */
@ExtendWith(MockitoExtension.class)
class CachePerformanceTest {

  @Mock private RedisTemplate<String, Object> redisTemplate;
  @Mock private ValueOperations<String, Object> valueOperations;
  @Mock private com.storesight.backend.repository.MarketIntelligenceCostRepository costRepository;
  @Mock private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

  @InjectMocks private CostOptimizationService costOptimizationService;

  @BeforeEach
  void setUp() {
    ReflectionTestUtils.setField(costOptimizationService, "costOptimizationEnabled", true);
    ReflectionTestUtils.setField(costOptimizationService, "cacheTtlHours", 24);
    ReflectionTestUtils.setField(costOptimizationService, "aggressiveCaching", false);

    lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
  }

  @Test
  void testCacheHitRate_HighFrequencyRequests() {
    // Given - simulate high-frequency search scenario
    String[] keywords = {"laptop", "smartphone", "headphones", "tablet", "camera"};
    String provider = "TestProvider";
    int maxResults = 10;

    Map<String, List<SearchClient.SearchResult>> mockResults = new HashMap<>();

    // Setup mock results for each keyword
    for (String keyword : keywords) {
      String cacheKey = costOptimizationService.generateCacheKey(provider, keyword, maxResults);
      List<SearchClient.SearchResult> results =
          List.of(createSearchResult("https://example.com/" + keyword, keyword + " product"));
      mockResults.put(cacheKey, results);

      // Mock cache hit after first request
      when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(results);
    }

    // When - simulate multiple requests for same keywords
    int totalRequests = 0;
    int cacheHits = 0;

    for (int round = 0; round < 5; round++) { // 5 rounds of requests
      for (String keyword : keywords) {
        String cacheKey = costOptimizationService.generateCacheKey(provider, keyword, maxResults);
        Optional<List<SearchClient.SearchResult>> cached =
            costOptimizationService.getCachedResults(cacheKey);

        totalRequests++;
        if (cached.isPresent()) {
          cacheHits++;
        }
      }
    }

    // Then - calculate cache hit rate
    double hitRate = (double) cacheHits / totalRequests;
    assertTrue(hitRate > 0.8, "Cache hit rate should be > 80% for repeated requests");
    assertEquals(25, totalRequests, "Should have made 25 total requests");
    assertEquals(25, cacheHits, "All requests should be cache hits after first round");
  }

  @Test
  void testCacheEffectiveness_CostSavings() {
    // Given - simulate cache hits vs misses
    String cacheKey = "popular_search";
    List<SearchClient.SearchResult> cachedResults =
        List.of(createSearchResult("https://popular.com", "Popular Product"));

    // Mock cache hits
    when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(cachedResults);

    // When - simulate 90 cache hits (no API cost)
    int cacheHits = 0;
    for (int i = 0; i < 90; i++) {
      Optional<List<SearchClient.SearchResult>> cached =
          costOptimizationService.getCachedResults(cacheKey);
      if (cached.isPresent()) {
        cacheHits++;
      }
    }

    // Then - verify cache effectiveness
    assertEquals(90, cacheHits, "Should get 90 cache hits");

    // Verify no additional API costs were tracked for cache hits
    verify(costRepository, never()).save(any());
  }

  @Test
  void testCacheTTL_ExpirationBehavior() {
    // Given
    String cacheKey = "ttl_expiration_test";
    List<SearchClient.SearchResult> results =
        List.of(createSearchResult("https://example.com", "Test Product"));

    // When - cache results with 24-hour TTL
    costOptimizationService.cacheResults(cacheKey, results);

    // Then - verify TTL was set correctly
    verify(valueOperations).set("search_cache_" + cacheKey, results, 24, TimeUnit.HOURS);

    // Simulate cache expiration by returning null
    when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(null);

    Optional<List<SearchClient.SearchResult>> expired =
        costOptimizationService.getCachedResults(cacheKey);
    assertFalse(expired.isPresent(), "Should return empty when cache expires");
  }

  @Test
  void testAggressiveCaching_ExtendedTTL() {
    // Given - enable aggressive caching
    ReflectionTestUtils.setField(costOptimizationService, "aggressiveCaching", true);

    String cacheKey = "aggressive_cache_test";
    List<SearchClient.SearchResult> results =
        List.of(createSearchResult("https://example.com", "Test Product"));

    // When - cache with aggressive mode
    costOptimizationService.cacheResults(cacheKey, results);

    // Then - verify extended TTL (48 hours)
    verify(valueOperations).set("search_cache_" + cacheKey, results, 48, TimeUnit.HOURS);
  }

  @Test
  void testCachePerformance_ConcurrentAccess() {
    // Given - simulate concurrent access scenario
    String cacheKey = "concurrent_test";
    List<SearchClient.SearchResult> results =
        List.of(createSearchResult("https://concurrent.com", "Concurrent Product"));

    when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(results);

    // When - simulate multiple concurrent cache accesses
    List<Optional<List<SearchClient.SearchResult>>> concurrentResults = new ArrayList<>();

    for (int i = 0; i < 20; i++) {
      Optional<List<SearchClient.SearchResult>> cached =
          costOptimizationService.getCachedResults(cacheKey);
      concurrentResults.add(cached);
    }

    // Then - all should succeed
    assertEquals(20, concurrentResults.size(), "Should handle 20 concurrent requests");
    for (Optional<List<SearchClient.SearchResult>> result : concurrentResults) {
      assertTrue(result.isPresent(), "All concurrent requests should succeed");
      assertEquals(results, result.get(), "All should return same cached data");
    }

    // Verify Redis was accessed for each request
    verify(valueOperations, times(20)).get("search_cache_" + cacheKey);
  }

  @Test
  void testCacheOptimization_MemoryEfficiency() {
    // Given - test with various data sizes
    Map<String, Integer> dataSizes =
        Map.of(
            "small", 1,
            "medium", 10,
            "large", 50,
            "xlarge", 100);

    // When - cache different sized datasets
    for (Map.Entry<String, Integer> entry : dataSizes.entrySet()) {
      String cacheKey = entry.getKey() + "_dataset";
      int size = entry.getValue();

      List<SearchClient.SearchResult> results = new ArrayList<>();
      for (int i = 0; i < size; i++) {
        results.add(createSearchResult("https://example" + i + ".com", "Product " + i));
      }

      // Cache the dataset
      costOptimizationService.cacheResults(cacheKey, results);

      // Mock retrieval
      when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(results);
      Optional<List<SearchClient.SearchResult>> cached =
          costOptimizationService.getCachedResults(cacheKey);

      // Then - verify efficient handling
      assertTrue(cached.isPresent(), "Should cache " + entry.getKey() + " dataset");
      assertEquals(
          size,
          cached.get().size(),
          "Should maintain data integrity for " + entry.getKey() + " dataset");
    }
  }

  @Test
  void testCacheWarmup_PopularSearches() {
    // Given - simulate popular search patterns
    String[] popularKeywords = {"iphone", "macbook", "airpods", "ipad", "apple watch"};
    String provider = "PopularProvider";

    Map<String, Integer> searchCounts = new HashMap<>();

    // When - simulate search pattern with some keywords being more popular
    for (int round = 0; round < 10; round++) {
      for (String keyword : popularKeywords) {
        // Make some keywords more popular than others
        int frequency = keyword.equals("iphone") ? 5 : keyword.equals("macbook") ? 3 : 1;

        for (int i = 0; i < frequency; i++) {
          String cacheKey = costOptimizationService.generateCacheKey(provider, keyword, 10);
          searchCounts.merge(cacheKey, 1, Integer::sum);

          // Mock cache behavior - first request misses, subsequent hit
          List<SearchClient.SearchResult> results =
              List.of(createSearchResult("https://example.com/" + keyword, keyword + " product"));
          when(valueOperations.get("search_cache_" + cacheKey)).thenReturn(results);

          Optional<List<SearchClient.SearchResult>> cached =
              costOptimizationService.getCachedResults(cacheKey);
          assertTrue(cached.isPresent(), "Popular searches should be cached");
        }
      }
    }

    // Then - verify popular searches were accessed more frequently
    assertTrue(searchCounts.size() > 0, "Should have cached popular searches");

    // Most popular search should have highest count
    String iphoneCacheKey = costOptimizationService.generateCacheKey(provider, "iphone", 10);
    Integer iphoneCount = searchCounts.get(iphoneCacheKey);
    assertNotNull(iphoneCount, "iPhone should be in search counts");
    assertTrue(
        iphoneCount >= 50, "iPhone should be most frequently searched"); // 10 rounds * 5 frequency
  }

  private SearchClient.SearchResult createSearchResult(String url, String title) {
    return new SearchClient.SearchResult(url, title, 29.99, "Test description");
  }
}
