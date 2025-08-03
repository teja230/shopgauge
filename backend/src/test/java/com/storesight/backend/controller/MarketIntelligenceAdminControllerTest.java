package com.storesight.backend.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.storesight.backend.service.CostOptimizationService;
import com.storesight.backend.service.DataPrivacyService;
import com.storesight.backend.service.DatabaseMonitoringService;
import com.storesight.backend.service.RedisHealthService;
import com.storesight.backend.service.TransactionMonitoringService;
import com.storesight.backend.service.discovery.CompetitorDiscoveryService;
import com.storesight.backend.service.discovery.MultiSourceSearchClient;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Unit tests for MarketIntelligenceAdminController. Tests the cost analytics integration and
 * dashboard functionality.
 */
@ExtendWith(MockitoExtension.class)
class MarketIntelligenceAdminControllerTest {

  @Mock private CostOptimizationService costOptimizationService;
  @Mock private CompetitorDiscoveryService discoveryService;
  @Mock private MultiSourceSearchClient multiSourceSearchClient;
  @Mock private JdbcTemplate jdbcTemplate;
  @Mock private DatabaseMonitoringService databaseMonitoringService;
  @Mock private RedisHealthService redisHealthService;
  @Mock private TransactionMonitoringService transactionMonitoringService;
  @Mock private DataPrivacyService dataPrivacyService;

  @InjectMocks private MarketIntelligenceAdminController controller;

  @BeforeEach
  void setUp() {
    ReflectionTestUtils.setField(controller, "discoveryEnabled", true);
    ReflectionTestUtils.setField(controller, "costOptimizationEnabled", true);
  }

  @Test
  void testGetDashboard_Success() {
    // Given
    CostOptimizationService.CostAnalytics mockAnalytics = createMockCostAnalytics();
    Map<String, Object> mockDiscoveryStats = createMockDiscoveryStats();
    Map<String, Object> mockProviderStats = createMockProviderStats();
    Map<String, Object> mockDbMetrics = createMockDatabaseMetrics();
    Map<String, Object> mockRedisMetrics = createMockRedisMetrics();
    Map<String, Object> mockTransactionMetrics = createMockTransactionMetrics();
    List<Map<String, Object>> mockActiveShops = createMockActiveShops();

    when(costOptimizationService.getCostAnalytics()).thenReturn(mockAnalytics);
    when(costOptimizationService.getOptimizationRecommendations()).thenReturn(new ArrayList<>());
    when(discoveryService.getDiscoveryStats()).thenReturn(mockDiscoveryStats);
    when(multiSourceSearchClient.getProviderStats()).thenReturn(mockProviderStats);
    when(databaseMonitoringService.getDatabaseMetrics()).thenReturn(mockDbMetrics);
    when(redisHealthService.getRedisHealthMetrics()).thenReturn(mockRedisMetrics);
    when(transactionMonitoringService.getHealthMetrics()).thenReturn(mockTransactionMetrics);
    when(transactionMonitoringService.isHealthy()).thenReturn(true);
    when(dataPrivacyService.getActiveShops()).thenReturn(mockActiveShops);
    when(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM competitor_urls", Integer.class))
        .thenReturn(10);
    when(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM competitor_suggestions", Integer.class))
        .thenReturn(5);
    when(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM price_snapshots", Integer.class))
        .thenReturn(100);

    // When
    ResponseEntity<Map<String, Object>> response = controller.getDashboard();

    // Then
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertNotNull(response.getBody());

    Map<String, Object> dashboard = response.getBody();
    assertTrue(dashboard.containsKey("systemStatus"));
    assertTrue(dashboard.containsKey("costAnalytics"));
    assertTrue(dashboard.containsKey("discoveryStats"));
    assertTrue(dashboard.containsKey("providerStats"));
    assertTrue(dashboard.containsKey("databaseStats"));
    assertTrue(dashboard.containsKey("performanceMetrics"));

    // Verify cost analytics integration
    assertEquals(mockAnalytics, dashboard.get("costAnalytics"));

    // Verify system status
    @SuppressWarnings("unchecked")
    Map<String, Object> systemStatus = (Map<String, Object>) dashboard.get("systemStatus");
    assertTrue((Boolean) systemStatus.get("discoveryEnabled"));
    assertTrue((Boolean) systemStatus.get("costOptimizationEnabled"));
  }

  @Test
  void testGetCostAnalytics_Success() {
    // Given
    CostOptimizationService.CostAnalytics mockAnalytics = createMockCostAnalytics();
    List<CostOptimizationService.CostOptimizationRecommendation> mockRecommendations =
        createMockRecommendations();

    when(costOptimizationService.getCostAnalytics()).thenReturn(mockAnalytics);
    when(costOptimizationService.getOptimizationRecommendations()).thenReturn(mockRecommendations);

    // When
    ResponseEntity<Map<String, Object>> response = controller.getCostAnalytics();

    // Then
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertNotNull(response.getBody());

    Map<String, Object> responseBody = response.getBody();
    assertTrue(responseBody.containsKey("analytics"));
    assertTrue(responseBody.containsKey("recommendations"));
    assertTrue(responseBody.containsKey("savings"));

    assertEquals(mockAnalytics, responseBody.get("analytics"));
    assertEquals(mockRecommendations, responseBody.get("recommendations"));
  }

  @Test
  void testGetCostAnalytics_WhenDisabled() {
    // Given
    ReflectionTestUtils.setField(controller, "costOptimizationEnabled", false);

    // When
    ResponseEntity<Map<String, Object>> response = controller.getCostAnalytics();

    // Then
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertNotNull(response.getBody());

    Map<String, Object> responseBody = response.getBody();
    assertFalse((Boolean) responseBody.get("enabled"));
    assertTrue(responseBody.containsKey("message"));
  }

  @Test
  void testGetProviderComparison_Success() {
    // Given
    Map<String, Object> mockProviderStats = createMockProviderStats();
    when(multiSourceSearchClient.getProviderStats()).thenReturn(mockProviderStats);

    // When
    ResponseEntity<Map<String, Object>> response = controller.getProviderComparison();

    // Then
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertNotNull(response.getBody());

    Map<String, Object> responseBody = response.getBody();
    assertTrue(responseBody.containsKey("providerStats"));
    assertTrue(responseBody.containsKey("costEfficiency"));
    assertTrue(responseBody.containsKey("recommendations"));

    assertEquals(mockProviderStats, responseBody.get("providerStats"));
  }

  @Test
  void testGetCostHistory_Success() {
    // Given
    Long shopId = 1L;
    int days = 30;
    List<Map<String, Object>> mockHistoricalData = createMockHistoricalData();
    Map<String, Object> mockProviderData = createMockProviderCostData();

    when(costOptimizationService.getHistoricalCostData(shopId, days))
        .thenReturn(mockHistoricalData);
    when(costOptimizationService.getProviderCostData(shopId, days)).thenReturn(mockProviderData);

    // When
    ResponseEntity<Map<String, Object>> response = controller.getCostHistory(days, shopId);

    // Then
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertNotNull(response.getBody());

    Map<String, Object> responseBody = response.getBody();
    assertTrue(responseBody.containsKey("historicalData"));
    assertTrue(responseBody.containsKey("providerData"));
    assertTrue(responseBody.containsKey("days"));
    assertTrue(responseBody.containsKey("shopId"));

    assertEquals(mockHistoricalData, responseBody.get("historicalData"));
    assertEquals(mockProviderData, responseBody.get("providerData"));
    assertEquals(days, responseBody.get("days"));
    assertEquals(shopId, responseBody.get("shopId"));
  }

  @Test
  void testGetCostHistory_MissingShopId() {
    // When
    ResponseEntity<Map<String, Object>> response = controller.getCostHistory(30, null);

    // Then
    assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    assertNotNull(response.getBody());
    assertTrue(response.getBody().containsKey("error"));
  }

  @Test
  void testResetCosts_Success() {
    // When
    ResponseEntity<Map<String, Object>> response = controller.resetCosts();

    // Then
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertNotNull(response.getBody());

    Map<String, Object> responseBody = response.getBody();
    assertTrue(responseBody.containsKey("message"));
    assertTrue(responseBody.containsKey("timestamp"));

    verify(costOptimizationService).resetDailyCosts();
    verify(multiSourceSearchClient).resetCostTracking();
  }

  @Test
  void testResetCosts_WhenDisabled() {
    // Given
    ReflectionTestUtils.setField(controller, "costOptimizationEnabled", false);

    // When
    ResponseEntity<Map<String, Object>> response = controller.resetCosts();

    // Then
    assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    assertNotNull(response.getBody());
    assertTrue(response.getBody().containsKey("error"));
  }

  @Test
  void testGetHealth_AllHealthy() {
    // Given
    when(discoveryService.getSearchClient()).thenReturn(multiSourceSearchClient);
    when(multiSourceSearchClient.isEnabled()).thenReturn(true);
    when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);

    // When
    ResponseEntity<Map<String, Object>> response = controller.getHealth();

    // Then
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertNotNull(response.getBody());

    Map<String, Object> health = response.getBody();
    assertTrue(health.containsKey("discovery"));
    assertTrue(health.containsKey("costOptimization"));
    assertTrue(health.containsKey("database"));
    assertTrue(health.containsKey("overall"));

    @SuppressWarnings("unchecked")
    Map<String, Object> overall = (Map<String, Object>) health.get("overall");
    assertEquals("healthy", overall.get("status"));
  }

  @Test
  void testGetHealth_DatabaseUnhealthy() {
    // Given
    when(discoveryService.getSearchClient()).thenReturn(multiSourceSearchClient);
    when(multiSourceSearchClient.isEnabled()).thenReturn(true);
    when(jdbcTemplate.queryForObject("SELECT 1", Integer.class))
        .thenThrow(new RuntimeException("DB Error"));

    // When
    ResponseEntity<Map<String, Object>> response = controller.getHealth();

    // Then
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertNotNull(response.getBody());

    Map<String, Object> health = response.getBody();
    @SuppressWarnings("unchecked")
    Map<String, Object> database = (Map<String, Object>) health.get("database");
    assertEquals("unhealthy", database.get("status"));

    @SuppressWarnings("unchecked")
    Map<String, Object> overall = (Map<String, Object>) health.get("overall");
    assertEquals("unhealthy", overall.get("status"));
  }

  // Helper methods to create mock data

  private CostOptimizationService.CostAnalytics createMockCostAnalytics() {
    Map<String, BigDecimal> todayCosts = Map.of("Provider1", BigDecimal.valueOf(0.005));
    Map<String, BigDecimal> thisMonthCosts = Map.of("Provider1", BigDecimal.valueOf(0.15));
    Map<String, Integer> todayRequests = Map.of("Provider1", 5);
    Map<String, Integer> thisMonthRequests = Map.of("Provider1", 150);

    return new CostOptimizationService.CostAnalytics(
        todayCosts,
        thisMonthCosts,
        todayRequests,
        thisMonthRequests,
        BigDecimal.valueOf(0.005),
        BigDecimal.valueOf(0.15),
        5,
        150,
        BigDecimal.valueOf(5.00),
        BigDecimal.valueOf(100.00),
        BigDecimal.valueOf(2.50));
  }

  private List<CostOptimizationService.CostOptimizationRecommendation> createMockRecommendations() {
    return List.of(
        new CostOptimizationService.CostOptimizationRecommendation(
            "ENABLE_CACHING",
            "Enable aggressive caching",
            "Reduce API costs by 50%",
            CostOptimizationService.CostOptimizationRecommendation.Priority.HIGH));
  }

  private Map<String, Object> createMockDiscoveryStats() {
    Map<String, Object> stats = new HashMap<>();
    stats.put("totalDiscoveries", 100);
    stats.put("successfulDiscoveries", 95);
    stats.put("failedDiscoveries", 5);
    stats.put("successRate", 95.0);
    stats.put("lastDiscoveryTime", "2024-01-15T10:30:00Z");
    stats.put("averageDiscoveryTime", 2500);
    return stats;
  }

  private Map<String, Object> createMockProviderStats() {
    Map<String, Object> stats = new HashMap<>();
    stats.put("totalProviders", 3);
    stats.put("enabledProviders", List.of("Scrapingdog", "Serper"));
    stats.put("providerCosts", Map.of("Scrapingdog", 0.005, "Serper", 0.008));
    return stats;
  }

  private Map<String, Object> createMockDatabaseMetrics() {
    Map<String, Object> metrics = new HashMap<>();
    metrics.put("healthStatus", "HEALTHY");
    return metrics;
  }

  private Map<String, Object> createMockRedisMetrics() {
    Map<String, Object> metrics = new HashMap<>();
    metrics.put("healthy", true);
    metrics.put("responseTimeMs", 5L);
    return metrics;
  }

  private Map<String, Object> createMockTransactionMetrics() {
    Map<String, Object> metrics = new HashMap<>();
    metrics.put("total_transactions", 1000L);
    metrics.put("failed_transactions", 10L);
    return metrics;
  }

  private List<Map<String, Object>> createMockActiveShops() {
    return List.of(Map.of("shopId", 1L, "domain", "test-shop.myshopify.com"));
  }

  private List<Map<String, Object>> createMockHistoricalData() {
    return List.of(
        Map.of("timestamp", "2024-01-15", "dailyCost", 0.005, "requests", 5, "discoveries", 10),
        Map.of("timestamp", "2024-01-16", "dailyCost", 0.008, "requests", 8, "discoveries", 15));
  }

  private Map<String, Object> createMockProviderCostData() {
    Map<String, Object> data = new HashMap<>();
    data.put("providerCosts", Map.of("Provider1", 0.15, "Provider2", 0.25));
    data.put("providerRequests", Map.of("Provider1", 150, "Provider2", 100));
    data.put("providerDiscoveries", Map.of("Provider1", 500, "Provider2", 300));
    return data;
  }
}
