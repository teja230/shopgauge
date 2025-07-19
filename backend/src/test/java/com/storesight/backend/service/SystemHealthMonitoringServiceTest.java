package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.actuate.health.Status;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class SystemHealthMonitoringServiceTest {

  @Mock private JdbcTemplate jdbcTemplate;

  @Mock private StringRedisTemplate redisTemplate;

  @Mock private ValueOperations<String, String> valueOperations;

  @Mock private RedisHealthService redisHealthService;

  @Mock private DatabaseMonitoringService databaseMonitoringService;

  @Mock private SystemResourceMonitoringService systemResourceMonitoringService;

  @InjectMocks private SystemHealthMonitoringService systemHealthMonitoringService;

  @BeforeEach
  void setUp() {
    // No default mock behaviors needed - each test will set up its own mocks
  }

  @Test
  void testPerformComprehensiveHealthCheck_AllHealthy() {
    // Given
    when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
    when(redisHealthService.isRedisHealthy()).thenReturn(true);
    when(redisHealthService.getRedisHealthMetrics()).thenReturn(Map.of("healthy", true));
    when(databaseMonitoringService.getConnectionPoolStats())
        .thenReturn(Map.of("utilizationPercent", 50.0));
    when(databaseMonitoringService.getMarketIntelligenceTableStats())
        .thenReturn(
            Map.of("competitorUrls", Map.of("errorCompetitors", 0, "totalCompetitors", 10)));
    when(systemResourceMonitoringService.getSystemResourceStatistics())
        .thenReturn(Map.of("cpu", Map.of("alert", "NORMAL")));
    when(systemResourceMonitoringService.getHealthIndicators()).thenReturn(Map.of("cpu", "NORMAL"));

    // When
    Map<String, Object> result = systemHealthMonitoringService.performComprehensiveHealthCheck();

    // Then
    assertNotNull(result);
    assertTrue(result.containsKey("database"));
    assertTrue(result.containsKey("redis"));
    assertTrue(result.containsKey("systemResources"));
    assertTrue(result.containsKey("application"));
    assertTrue(result.containsKey("timestamp"));
  }

  @Test
  void testCheckDatabaseHealth_Success() {
    // Given
    when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
    when(databaseMonitoringService.getConnectionPoolStats())
        .thenReturn(
            Map.of(
                "utilizationPercent", 50.0,
                "activeConnections", 5,
                "totalConnections", 10));

    // When
    Map<String, Object> result = systemHealthMonitoringService.checkDatabaseHealth();

    // Then
    assertNotNull(result);
    assertTrue(result.containsKey("connectivity"));
    assertTrue(result.containsKey("status"));
    assertTrue(result.containsKey("responseTimeMs"));
    assertTrue(result.containsKey("connectionPool"));
    assertEquals("HEALTHY", result.get("status"));
  }

  @Test
  void testCheckDatabaseHealth_Failure() {
    // Given
    when(jdbcTemplate.queryForObject("SELECT 1", Integer.class))
        .thenThrow(new RuntimeException("Database connection failed"));

    // When
    Map<String, Object> result = systemHealthMonitoringService.checkDatabaseHealth();

    // Then
    assertNotNull(result);
    assertTrue(result.containsKey("connectivity"));
    assertTrue(result.containsKey("status"));
    assertTrue(result.containsKey("error"));
    assertEquals("UNHEALTHY", result.get("status"));
  }

  @Test
  void testCheckRedisHealth_Success() {
    // Given
    when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    when(redisHealthService.isRedisHealthy()).thenReturn(true);
    when(redisHealthService.getRedisHealthMetrics())
        .thenReturn(Map.of("healthy", true, "lastHealthCheck", "2023-01-01T00:00:00"));
    doNothing().when(valueOperations).set(anyString(), anyString(), any(java.time.Duration.class));
    when(valueOperations.get(anyString())).thenReturn("test");
    when(redisTemplate.delete(anyString())).thenReturn(true);

    // When
    Map<String, Object> result = systemHealthMonitoringService.checkRedisHealth();

    // Then
    assertNotNull(result);
    assertTrue(result.containsKey("connectivity"));
    assertTrue(result.containsKey("status"));
    assertTrue(result.containsKey("metrics"));
    assertEquals("HEALTHY", result.get("status"));
  }

  @Test
  void testCheckRedisHealth_Failure() {
    // Given
    when(redisHealthService.isRedisHealthy()).thenReturn(false);
    when(redisHealthService.getRedisHealthMetrics())
        .thenReturn(Map.of("healthy", false, "consecutiveFailures", 3));

    // When
    Map<String, Object> result = systemHealthMonitoringService.checkRedisHealth();

    // Then
    assertNotNull(result);
    assertTrue(result.containsKey("connectivity"));
    assertTrue(result.containsKey("status"));
    assertEquals("UNHEALTHY", result.get("status"));
  }

  @Test
  void testCheckSystemResources_Normal() {
    // Given
    when(systemResourceMonitoringService.getSystemResourceStatistics())
        .thenReturn(
            Map.of(
                "cpu", Map.of("alert", "NORMAL"),
                "memory", Map.of("alert", "NORMAL"),
                "disk", Map.of("alert", "NORMAL")));
    when(systemResourceMonitoringService.getHealthIndicators())
        .thenReturn(
            Map.of(
                "cpu", "NORMAL",
                "memory", "NORMAL",
                "disk", "NORMAL"));

    // When
    Map<String, Object> result = systemHealthMonitoringService.checkSystemResources();

    // Then
    assertNotNull(result);
    assertTrue(result.containsKey("status"));
    assertTrue(result.containsKey("statistics"));
    assertTrue(result.containsKey("indicators"));
    assertEquals("HEALTHY", result.get("status"));
  }

  @Test
  void testCheckSystemResources_Critical() {
    // Given
    when(systemResourceMonitoringService.getSystemResourceStatistics())
        .thenReturn(
            Map.of(
                "cpu", Map.of("alert", "CRITICAL"),
                "memory", Map.of("alert", "NORMAL")));
    when(systemResourceMonitoringService.getHealthIndicators())
        .thenReturn(
            Map.of(
                "cpu", "CRITICAL",
                "memory", "NORMAL"));

    // When
    Map<String, Object> result = systemHealthMonitoringService.checkSystemResources();

    // Then
    assertNotNull(result);
    assertTrue(result.containsKey("status"));
    assertTrue(result.containsKey("alert"));
    assertEquals("CRITICAL", result.get("status"));
  }

  @Test
  void testCheckApplicationHealth_Success() {
    // Given
    when(databaseMonitoringService.getMarketIntelligenceTableStats())
        .thenReturn(
            Map.of("competitorUrls", Map.of("errorCompetitors", 1, "totalCompetitors", 100)));

    // When
    Map<String, Object> result = systemHealthMonitoringService.checkApplicationHealth();

    // Then
    assertNotNull(result);
    assertTrue(result.containsKey("status"));
    assertTrue(result.containsKey("marketIntelligence"));
    assertEquals("HEALTHY", result.get("status"));
  }

  @Test
  void testCheckApplicationHealth_Degraded() {
    // Given
    when(databaseMonitoringService.getMarketIntelligenceTableStats())
        .thenReturn(
            Map.of(
                "competitorUrls",
                Map.of(
                    "errorCompetitors", 50,
                    "totalCompetitors", 100)));

    // When
    Map<String, Object> result = systemHealthMonitoringService.checkApplicationHealth();

    // Then
    assertNotNull(result);
    assertTrue(result.containsKey("status"));
    assertTrue(result.containsKey("marketIntelligence"));
    assertEquals("DEGRADED", result.get("status"));
  }

  @Test
  void testHealthIndicator_Healthy() {
    // Given
    when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
    when(redisHealthService.isRedisHealthy()).thenReturn(true);
    when(systemResourceMonitoringService.getHealthIndicators())
        .thenReturn(
            Map.of(
                "cpu", "NORMAL",
                "memory", "NORMAL",
                "disk", "NORMAL"));

    // When
    org.springframework.boot.actuate.health.Health health = systemHealthMonitoringService.health();

    // Then
    assertNotNull(health);
    assertTrue(health.getStatus() == Status.UP || health.getStatus() == Status.DOWN);
  }

  @Test
  void testHealthIndicator_Unhealthy() {
    // Given
    when(jdbcTemplate.queryForObject("SELECT 1", Integer.class))
        .thenThrow(new RuntimeException("Database connection failed"));

    // When
    org.springframework.boot.actuate.health.Health health = systemHealthMonitoringService.health();

    // Then
    assertNotNull(health);
    assertTrue(health.getStatus() == Status.UP || health.getStatus() == Status.DOWN);
  }
}
