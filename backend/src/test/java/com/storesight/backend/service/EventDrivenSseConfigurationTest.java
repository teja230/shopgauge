package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

import com.storesight.backend.config.ApplicationConfigurationProperties;
import com.storesight.backend.config.SchedulingConfiguration;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EventDrivenSseConfigurationTest {

  @Mock private ApplicationConfigurationProperties config;

  @InjectMocks private SchedulingConfiguration schedulingConfiguration;

  private ApplicationConfigurationProperties.SseConfiguration sseConfig;

  @BeforeEach
  void setUp() {
    sseConfig = new ApplicationConfigurationProperties.SseConfiguration();
  }

  @Test
  void testHeartbeatDisabledConfiguration() {
    // Set up SSE configuration with heartbeat disabled (PT0S)
    sseConfig.setHeartbeatInterval(Duration.ZERO);
    sseConfig.setConnectionTimeout(Duration.ofMinutes(10));
    sseConfig.setCleanupInterval(Duration.ofMinutes(10));

    // Mock the config to return our SSE configuration
    when(config.getSse()).thenReturn(sseConfig);

    // Test that heartbeat interval returns Long.MAX_VALUE when disabled
    long heartbeatIntervalMs = schedulingConfiguration.getHeartbeatIntervalMs();
    assertEquals(Long.MAX_VALUE, heartbeatIntervalMs);

    // Test that other intervals work normally
    long cleanupIntervalMs = schedulingConfiguration.getCleanupIntervalMs();
    assertEquals(Duration.ofMinutes(10).toMillis(), cleanupIntervalMs);
  }

  @Test
  void testHeartbeatEnabledConfiguration() {
    // Set up SSE configuration with heartbeat enabled
    sseConfig.setHeartbeatInterval(Duration.ofMinutes(2));
    sseConfig.setConnectionTimeout(Duration.ofMinutes(10));
    sseConfig.setCleanupInterval(Duration.ofMinutes(10));

    // Mock the config to return our SSE configuration
    when(config.getSse()).thenReturn(sseConfig);

    // Test that heartbeat interval returns the actual value when enabled
    long heartbeatIntervalMs = schedulingConfiguration.getHeartbeatIntervalMs();
    assertEquals(Duration.ofMinutes(2).toMillis(), heartbeatIntervalMs);
  }

  @Test
  void testEventDrivenConfigurationValues() {
    // Verify the expected Event-Driven SSE configuration values
    sseConfig.setHeartbeatInterval(Duration.ZERO); // PT0S - disabled
    sseConfig.setConnectionTimeout(Duration.ofMinutes(10)); // PT10M
    sseConfig.setCleanupInterval(Duration.ofMinutes(10)); // PT10M

    when(config.getSse()).thenReturn(sseConfig);

    // Verify configuration values match Event-Driven SSE requirements
    assertEquals(Long.MAX_VALUE, schedulingConfiguration.getHeartbeatIntervalMs());
    assertEquals(Duration.ofMinutes(10).toMillis(), schedulingConfiguration.getCleanupIntervalMs());

    // Connection timeout is not handled by SchedulingConfiguration, but we can verify the config
    assertEquals(Duration.ofMinutes(10), sseConfig.getConnectionTimeout());
  }
}
