package com.storesight.backend.service.discovery;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.storesight.backend.service.CostOptimizationService;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class MultiSourceSearchClientTest {

  @Mock private CostOptimizationService costOptimizationService;

  @Mock private SearchClient primarySearchClient;

  @Mock private SearchClient secondarySearchClient;

  @Mock private SearchClient tertiarySearchClient;

  @InjectMocks private MultiSourceSearchClient multiSourceSearchClient;

  @BeforeEach
  void setUp() {
    // Set up test configuration
    ReflectionTestUtils.setField(multiSourceSearchClient, "multiSourceEnabled", true);
    ReflectionTestUtils.setField(multiSourceSearchClient, "fallbackEnabled", true);
    ReflectionTestUtils.setField(multiSourceSearchClient, "maxProvidersToTry", 3);
    ReflectionTestUtils.setField(multiSourceSearchClient, "costOptimizationEnabled", true);

    // Mock search clients with lenient mode to avoid unnecessary stubbing exceptions
    lenient().when(primarySearchClient.isEnabled()).thenReturn(true);
    lenient().when(primarySearchClient.getProviderName()).thenReturn("Primary");
    lenient().when(primarySearchClient.getCostPerSearch()).thenReturn(0.005);
    lenient().when(primarySearchClient.getPriority()).thenReturn(1);
    lenient()
        .when(primarySearchClient.getProviderConfig())
        .thenReturn(Map.of("provider", "Primary", "enabled", true));

    lenient().when(secondarySearchClient.isEnabled()).thenReturn(true);
    lenient().when(secondarySearchClient.getProviderName()).thenReturn("Secondary");
    lenient().when(secondarySearchClient.getCostPerSearch()).thenReturn(0.008);
    lenient().when(secondarySearchClient.getPriority()).thenReturn(2);
    lenient()
        .when(secondarySearchClient.getProviderConfig())
        .thenReturn(Map.of("provider", "Secondary", "enabled", true));

    lenient().when(tertiarySearchClient.isEnabled()).thenReturn(true);
    lenient().when(tertiarySearchClient.getProviderName()).thenReturn("Tertiary");
    lenient().when(tertiarySearchClient.getCostPerSearch()).thenReturn(0.010);
    lenient().when(tertiarySearchClient.getPriority()).thenReturn(3);
    lenient()
        .when(tertiarySearchClient.getProviderConfig())
        .thenReturn(Map.of("provider", "Tertiary", "enabled", true));

    // Set up search clients list
    List<SearchClient> searchClients =
        Arrays.asList(
            multiSourceSearchClient, // This should be filtered out
            primarySearchClient,
            secondarySearchClient,
            tertiarySearchClient);
    ReflectionTestUtils.setField(multiSourceSearchClient, "searchClients", searchClients);

    // Initialize the service
    multiSourceSearchClient.init();
  }

  @Test
  void testIsEnabled_WhenProvidersAvailable() {
    assertTrue(multiSourceSearchClient.isEnabled());
  }

  @Test
  void testIsEnabled_WhenNoProvidersAvailable() {
    when(primarySearchClient.isEnabled()).thenReturn(false);
    when(secondarySearchClient.isEnabled()).thenReturn(false);
    when(tertiarySearchClient.isEnabled()).thenReturn(false);

    multiSourceSearchClient.init();

    assertFalse(multiSourceSearchClient.isEnabled());
  }

  @Test
  void testSearch_WithCachedResults() {
    // Given
    String keywords = "test keywords";
    int maxResults = 10;
    String cacheKey = "cache_key";

    List<SearchClient.SearchResult> cachedResults =
        Arrays.asList(
            createSearchResult("https://example1.com", "Product 1", 29.99),
            createSearchResult("https://example2.com", "Product 2", 39.99));

    when(costOptimizationService.generateCacheKey("multi-source", keywords, maxResults))
        .thenReturn(cacheKey);
    when(costOptimizationService.getCachedResults(cacheKey)).thenReturn(Optional.of(cachedResults));

    // When
    List<SearchClient.SearchResult> results = multiSourceSearchClient.search(keywords, maxResults);

    // Then
    assertEquals(2, results.size());
    assertEquals(cachedResults, results);

    verify(costOptimizationService).generateCacheKey("multi-source", keywords, maxResults);
    verify(costOptimizationService).getCachedResults(cacheKey);
    verify(primarySearchClient, never()).search(anyString(), anyInt());
  }

  @Test
  void testSearch_PrimaryProviderSuccess() {
    // Given
    String keywords = "test keywords";
    int maxResults = 10;
    String cacheKey = "cache_key";

    List<SearchClient.SearchResult> primaryResults =
        Arrays.asList(
            createSearchResult("https://example1.com", "Product 1", 29.99),
            createSearchResult("https://example2.com", "Product 2", 39.99));

    when(costOptimizationService.generateCacheKey("multi-source", keywords, maxResults))
        .thenReturn(cacheKey);
    when(costOptimizationService.getCachedResults(cacheKey)).thenReturn(Optional.empty());
    when(costOptimizationService.canMakeRequest("Primary", BigDecimal.valueOf(0.005)))
        .thenReturn(true);
    when(primarySearchClient.search(keywords, maxResults)).thenReturn(primaryResults);

    // When
    List<SearchClient.SearchResult> results = multiSourceSearchClient.search(keywords, maxResults);

    // Then
    assertEquals(2, results.size());
    assertEquals("Primary", results.get(0).getProvider());
    assertEquals("Primary", results.get(1).getProvider());

    verify(primarySearchClient).search(keywords, maxResults);
    verify(secondarySearchClient, never()).search(anyString(), anyInt());
    verify(costOptimizationService).trackApiCost("Primary", BigDecimal.valueOf(0.005), 1);
    verify(costOptimizationService).cacheResults(cacheKey, results);
  }

  @Test
  void testSearch_PrimaryProviderFailure_FallbackToSecondary() {
    // Given
    String keywords = "test keywords";
    int maxResults = 10;
    String cacheKey = "cache_key";

    List<SearchClient.SearchResult> secondaryResults =
        Arrays.asList(createSearchResult("https://example3.com", "Product 3", 49.99));

    when(costOptimizationService.generateCacheKey("multi-source", keywords, maxResults))
        .thenReturn(cacheKey);
    when(costOptimizationService.getCachedResults(cacheKey)).thenReturn(Optional.empty());
    when(costOptimizationService.canMakeRequest("Primary", BigDecimal.valueOf(0.005)))
        .thenReturn(true);
    when(costOptimizationService.canMakeRequest("Secondary", BigDecimal.valueOf(0.008)))
        .thenReturn(true);

    when(primarySearchClient.search(keywords, maxResults))
        .thenThrow(new RuntimeException("Primary provider failed"));
    when(secondarySearchClient.search(keywords, maxResults)).thenReturn(secondaryResults);

    // When
    List<SearchClient.SearchResult> results = multiSourceSearchClient.search(keywords, maxResults);

    // Then
    assertEquals(1, results.size());
    assertEquals("Secondary", results.get(0).getProvider());

    verify(primarySearchClient).search(keywords, maxResults);
    verify(secondarySearchClient).search(keywords, maxResults);
    verify(costOptimizationService).trackApiCost("Secondary", BigDecimal.valueOf(0.008), 1);
  }

  @Test
  void testSearch_BudgetConstraints_SkipProvider() {
    // Given
    String keywords = "test keywords";
    int maxResults = 10;
    String cacheKey = "cache_key";

    List<SearchClient.SearchResult> secondaryResults =
        Arrays.asList(createSearchResult("https://example3.com", "Product 3", 49.99));

    when(costOptimizationService.generateCacheKey("multi-source", keywords, maxResults))
        .thenReturn(cacheKey);
    when(costOptimizationService.getCachedResults(cacheKey)).thenReturn(Optional.empty());
    when(costOptimizationService.canMakeRequest("Primary", BigDecimal.valueOf(0.005)))
        .thenReturn(false); // Budget exceeded
    when(costOptimizationService.canMakeRequest("Secondary", BigDecimal.valueOf(0.008)))
        .thenReturn(true);

    when(secondarySearchClient.search(keywords, maxResults)).thenReturn(secondaryResults);

    // When
    List<SearchClient.SearchResult> results = multiSourceSearchClient.search(keywords, maxResults);

    // Then
    assertEquals(1, results.size());
    assertEquals("Secondary", results.get(0).getProvider());

    verify(primarySearchClient, never()).search(anyString(), anyInt());
    verify(secondarySearchClient).search(keywords, maxResults);
  }

  @Test
  void testSearch_DeduplicateResults() {
    // Given
    String keywords = "test keywords";
    int maxResults = 10;
    String cacheKey = "cache_key";

    List<SearchClient.SearchResult> primaryResults =
        Arrays.asList(
            createSearchResult("https://example1.com", "Product 1", 29.99),
            createSearchResult("https://example2.com", "Product 2", 39.99));

    List<SearchClient.SearchResult> secondaryResults =
        Arrays.asList(
            createSearchResult(
                "https://example1.com", "Product 1 Duplicate", 29.99), // Duplicate URL
            createSearchResult("https://example3.com", "Product 3", 49.99));

    when(costOptimizationService.generateCacheKey("multi-source", keywords, maxResults))
        .thenReturn(cacheKey);
    when(costOptimizationService.getCachedResults(cacheKey)).thenReturn(Optional.empty());
    when(costOptimizationService.canMakeRequest(anyString(), any(BigDecimal.class)))
        .thenReturn(true);

    when(primarySearchClient.search(keywords, maxResults)).thenReturn(primaryResults);
    when(secondarySearchClient.search(keywords, maxResults)).thenReturn(secondaryResults);

    // When
    List<SearchClient.SearchResult> results = multiSourceSearchClient.search(keywords, maxResults);

    // Then
    assertEquals(3, results.size()); // Should deduplicate the duplicate URL

    Set<String> urls = new HashSet<>();
    for (SearchClient.SearchResult result : results) {
      urls.add(result.getUrl());
    }
    assertEquals(3, urls.size()); // All URLs should be unique
    assertTrue(urls.contains("https://example1.com"));
    assertTrue(urls.contains("https://example2.com"));
    assertTrue(urls.contains("https://example3.com"));
  }

  @Test
  void testSearch_MaxResultsLimit() {
    // Given
    String keywords = "test keywords";
    int maxResults = 2; // Limit to 2 results
    String cacheKey = "cache_key";

    List<SearchClient.SearchResult> primaryResults =
        Arrays.asList(
            createSearchResult("https://example1.com", "Product 1", 29.99),
            createSearchResult("https://example2.com", "Product 2", 39.99),
            createSearchResult("https://example3.com", "Product 3", 49.99),
            createSearchResult("https://example4.com", "Product 4", 59.99));

    when(costOptimizationService.generateCacheKey("multi-source", keywords, maxResults))
        .thenReturn(cacheKey);
    when(costOptimizationService.getCachedResults(cacheKey)).thenReturn(Optional.empty());
    when(costOptimizationService.canMakeRequest("Primary", BigDecimal.valueOf(0.005)))
        .thenReturn(true);

    when(primarySearchClient.search(keywords, maxResults)).thenReturn(primaryResults);

    // When
    List<SearchClient.SearchResult> results = multiSourceSearchClient.search(keywords, maxResults);

    // Then
    assertEquals(2, results.size()); // Should be limited to maxResults
    verify(secondarySearchClient, never())
        .search(anyString(), anyInt()); // Should stop after reaching limit
  }

  @Test
  void testGetProviderStats() {
    // Given
    CostOptimizationService.CostAnalytics mockAnalytics =
        mock(CostOptimizationService.CostAnalytics.class);
    when(mockAnalytics.getTotalDailyCost()).thenReturn(BigDecimal.valueOf(0.05));
    when(mockAnalytics.getTotalMonthlyCost()).thenReturn(BigDecimal.valueOf(1.50));
    when(mockAnalytics.getTotalDailyRequests()).thenReturn(10);
    when(mockAnalytics.getTotalMonthlyRequests()).thenReturn(300);
    when(mockAnalytics.getEstimatedSavings()).thenReturn(BigDecimal.valueOf(0.25));
    when(mockAnalytics.getDailyUsagePercentage()).thenReturn(0.01);
    when(mockAnalytics.getMonthlyUsagePercentage()).thenReturn(0.015);

    when(costOptimizationService.getCostAnalytics()).thenReturn(mockAnalytics);

    // When
    Map<String, Object> stats = multiSourceSearchClient.getProviderStats();

    // Then
    assertNotNull(stats);
    assertEquals(3, stats.get("totalProviders"));

    @SuppressWarnings("unchecked")
    List<String> enabledProviders = (List<String>) stats.get("enabledProviders");
    assertEquals(3, enabledProviders.size());
    assertTrue(enabledProviders.contains("Primary"));
    assertTrue(enabledProviders.contains("Secondary"));
    assertTrue(enabledProviders.contains("Tertiary"));

    @SuppressWarnings("unchecked")
    Map<String, Double> providerCosts = (Map<String, Double>) stats.get("providerCosts");
    assertEquals(0.005, providerCosts.get("Primary"));
    assertEquals(0.008, providerCosts.get("Secondary"));
    assertEquals(0.010, providerCosts.get("Tertiary"));
  }

  @Test
  void testGetProviderConfig() {
    // When
    Map<String, Object> config = multiSourceSearchClient.getProviderConfig();

    // Then
    assertNotNull(config);
    assertEquals("multi-source", config.get("provider"));
    assertEquals(true, config.get("enabled"));
    assertEquals(true, config.get("fallbackEnabled"));
    assertEquals(3, config.get("maxProviders"));
    assertEquals(true, config.get("costOptimizationEnabled"));

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> providers = (List<Map<String, Object>>) config.get("providers");
    assertEquals(3, providers.size());
  }

  private SearchClient.SearchResult createSearchResult(String url, String title, double price) {
    return new SearchClient.SearchResult(url, title, price, "Test description");
  }
}
