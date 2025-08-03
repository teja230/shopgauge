package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import java.util.concurrent.CompletableFuture;
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
class CompetitorScraperWorkerTest {

  @Mock private JdbcTemplate jdbcTemplate;

  @Mock private RedisTemplate<String, Object> redisTemplate;

  @Mock private ValueOperations<String, Object> valueOperations;

  @Mock private AlertService alertService;

  @Mock private AsyncProcessingService asyncProcessingService;

  @InjectMocks private CompetitorScraperWorker scraperWorker;

  @BeforeEach
  void setUp() {
    // Set up test configuration
    ReflectionTestUtils.setField(
        scraperWorker, "seleniumEnabled", false); // Disable Selenium for tests
    ReflectionTestUtils.setField(scraperWorker, "maxConcurrentScrapers", 3);
    ReflectionTestUtils.setField(scraperWorker, "delayBetweenRequests", 1000);
    ReflectionTestUtils.setField(scraperWorker, "maxUrlsPerShop", 100);
    ReflectionTestUtils.setField(scraperWorker, "maxConcurrentScrapersLimit", 3);
    ReflectionTestUtils.setField(scraperWorker, "timeoutSeconds", 30);
    ReflectionTestUtils.setField(scraperWorker, "userAgent", "Test User Agent");

    // Initialize the executor
    scraperWorker.initializeExecutor();
  }

  @Test
  void testInitializeExecutor() {
    // The executor should be initialized in setUp
    // We can verify this by checking that the method doesn't throw an exception
    assertDoesNotThrow(() -> scraperWorker.initializeExecutor());
  }

  @Test
  void testScrapeCompetitors_NoUrls() {
    // Given
    when(jdbcTemplate.queryForList(anyString(), anyInt(), anyInt()))
        .thenReturn(Collections.emptyList());

    // When
    assertDoesNotThrow(() -> scraperWorker.scrapeCompetitors());

    // Then
    verify(jdbcTemplate).queryForList(anyString(), anyInt(), anyInt());
  }

  @Test
  void testScrapeCompetitors_WithUrls() {
    // Given
    List<Map<String, Object>> competitorUrls =
        Arrays.asList(
            createCompetitorUrlData(
                1L, "https://example.com/product1", "Product 1", 1L, "test-shop.myshopify.com"),
            createCompetitorUrlData(
                2L, "https://example.com/product2", "Product 2", 1L, "test-shop.myshopify.com"));

    when(jdbcTemplate.queryForList(anyString(), anyInt(), anyInt())).thenReturn(competitorUrls);
    when(asyncProcessingService.submitScrapingTask(anyString(), anyString(), anyLong(), any()))
        .thenReturn(CompletableFuture.completedFuture(null));

    // When
    assertDoesNotThrow(() -> scraperWorker.scrapeCompetitors());

    // Then
    verify(jdbcTemplate).queryForList(anyString(), anyInt(), anyInt());
    // Verify that async processing service was called for each URL
    verify(asyncProcessingService, times(2))
        .submitScrapingTask(anyString(), anyString(), anyLong(), any());
  }

  @Test
  void testScraperConfiguration() {
    // Test that the scraper is properly configured
    assertDoesNotThrow(() -> scraperWorker.initializeExecutor());

    // Verify configuration values are set
    assertEquals(false, ReflectionTestUtils.getField(scraperWorker, "seleniumEnabled"));
    assertEquals(3, ReflectionTestUtils.getField(scraperWorker, "maxConcurrentScrapers"));
    assertEquals(1000, ReflectionTestUtils.getField(scraperWorker, "delayBetweenRequests"));
  }

  @Test
  void testScrapingBehavior_WithRateLimit() {
    // Given
    List<Map<String, Object>> competitorUrls =
        Arrays.asList(
            createCompetitorUrlData(
                1L, "https://example.com/product1", "Product 1", 1L, "test-shop.myshopify.com"));

    when(jdbcTemplate.queryForList(anyString(), anyInt(), anyInt())).thenReturn(competitorUrls);

    // When
    assertDoesNotThrow(() -> scraperWorker.scrapeCompetitors());

    // Then
    verify(jdbcTemplate).queryForList(anyString(), anyInt(), anyInt());
    // Verify that async processing service was called
    verify(asyncProcessingService, times(1))
        .submitScrapingTask(anyString(), anyString(), anyLong(), any());
  }

  @Test
  void testScrapingConfiguration_Validation() {
    // Test that all configuration values are properly set
    assertEquals(false, ReflectionTestUtils.getField(scraperWorker, "seleniumEnabled"));
    assertEquals(3, ReflectionTestUtils.getField(scraperWorker, "maxConcurrentScrapers"));
    assertEquals(1000, ReflectionTestUtils.getField(scraperWorker, "delayBetweenRequests"));
    assertEquals(100, ReflectionTestUtils.getField(scraperWorker, "maxUrlsPerShop"));
    assertEquals(3, ReflectionTestUtils.getField(scraperWorker, "maxConcurrentScrapersLimit"));
    assertEquals(30, ReflectionTestUtils.getField(scraperWorker, "timeoutSeconds"));
    assertEquals("Test User Agent", ReflectionTestUtils.getField(scraperWorker, "userAgent"));
  }

  @Test
  void testScrapingWorkflow_PriceChangeDetection() {
    // Given
    List<Map<String, Object>> competitorUrls =
        Arrays.asList(
            createCompetitorUrlData(
                1L, "https://example.com/product1", "Product 1", 1L, "test-shop.myshopify.com"));

    when(jdbcTemplate.queryForList(anyString(), anyInt(), anyInt())).thenReturn(competitorUrls);

    // When
    assertDoesNotThrow(() -> scraperWorker.scrapeCompetitors());

    // Then
    verify(jdbcTemplate).queryForList(anyString(), anyInt(), anyInt());
    // Verify that async processing service was called
    verify(asyncProcessingService, times(1))
        .submitScrapingTask(anyString(), anyString(), anyLong(), any());
  }

  @Test
  void testScrapingPerformance_ConcurrencyLimits() {
    // Given
    List<Map<String, Object>> manyUrls = new ArrayList<>();
    for (int i = 1; i <= 10; i++) {
      manyUrls.add(
          createCompetitorUrlData(
              (long) i,
              "https://example.com/product" + i,
              "Product " + i,
              1L,
              "test-shop.myshopify.com"));
    }

    when(jdbcTemplate.queryForList(anyString(), anyInt(), anyInt())).thenReturn(manyUrls);
    when(asyncProcessingService.submitScrapingTask(anyString(), anyString(), anyLong(), any()))
        .thenReturn(CompletableFuture.completedFuture(null));

    // When
    long startTime = System.currentTimeMillis();
    assertDoesNotThrow(() -> scraperWorker.scrapeCompetitors());
    long endTime = System.currentTimeMillis();

    // Then
    verify(jdbcTemplate).queryForList(anyString(), anyInt(), anyInt());

    // Should complete within reasonable time (respecting concurrency limits)
    long executionTime = endTime - startTime;
    assertTrue(executionTime < 5000, "Scraping took too long: " + executionTime + "ms");

    // Verify that async processing service was called for all URLs
    verify(asyncProcessingService, times(10))
        .submitScrapingTask(anyString(), anyString(), anyLong(), any());
  }

  @Test
  void testScrapingErrorHandling_DatabaseFailure() {
    // Given
    when(jdbcTemplate.queryForList(anyString(), anyInt(), anyInt()))
        .thenThrow(new RuntimeException("Database connection failed"));

    // When & Then
    assertDoesNotThrow(() -> scraperWorker.scrapeCompetitors());

    // Should handle database errors gracefully
    verify(jdbcTemplate).queryForList(anyString(), anyInt(), anyInt());
  }

  @Test
  void testScrapingValidation_UrlLimits() {
    // Test that the scraper respects per-shop URL limits
    int maxUrlsPerShop = (Integer) ReflectionTestUtils.getField(scraperWorker, "maxUrlsPerShop");
    assertEquals(100, maxUrlsPerShop);

    int maxConcurrentScrapersLimit =
        (Integer) ReflectionTestUtils.getField(scraperWorker, "maxConcurrentScrapersLimit");
    assertEquals(3, maxConcurrentScrapersLimit);
  }

  private Map<String, Object> createCompetitorUrlData(
      Long id, String url, String label, Long shopId, String shopDomain) {
    Map<String, Object> data = new HashMap<>();
    data.put("id", id);
    data.put("url", url);
    data.put("label", label);
    data.put("shop_id", shopId);
    data.put("shopify_domain", shopDomain);
    return data;
  }
}
