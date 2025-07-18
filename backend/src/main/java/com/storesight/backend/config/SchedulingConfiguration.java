package com.storesight.backend.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration class that provides millisecond values for @Scheduled annotations This allows us to
 * use the existing Duration properties while avoiding the toMillis() issue
 */
@Configuration
public class SchedulingConfiguration {

  @Autowired private ApplicationConfigurationProperties config;

  /** Get cleanup interval in milliseconds for @Scheduled annotations */
  public long getCleanupIntervalMs() {
    return config.getSse().getCleanupInterval().toMillis();
  }

  /** Get heartbeat interval in milliseconds for @Scheduled annotations */
  public long getHeartbeatIntervalMs() {
    return config.getSse().getHeartbeatInterval().toMillis();
  }

  /** Get connection health check interval in milliseconds for @Scheduled annotations */
  public long getConnectionHealthCheckIntervalMs() {
    return config.getSse().getConnectionHealthCheckInterval().toMillis();
  }

  /** Get batch cleanup interval in milliseconds for @Scheduled annotations */
  public long getBatchCleanupIntervalMs() {
    return config.getSse().getBatchCleanupInterval().toMillis();
  }
}
