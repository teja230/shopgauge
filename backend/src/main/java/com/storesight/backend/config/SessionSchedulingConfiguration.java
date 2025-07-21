package com.storesight.backend.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration class that provides millisecond values for session cleanup @Scheduled annotations.
 * This allows us to use the existing Duration properties while avoiding the toMillis() issue.
 */
@Configuration
public class SessionSchedulingConfiguration {

  @Autowired private ApplicationConfigurationProperties config;

  /** Get synchronization cleanup interval in milliseconds for @Scheduled annotations */
  public long getSynchronizationCleanupIntervalMs() {
    return config.getSession().getSynchronizationCleanupInterval().toMillis();
  }

  /** Get synchronization cleanup startup delay in milliseconds for @Scheduled annotations */
  public long getSynchronizationCleanupStartupDelayMs() {
    return config.getSession().getSynchronizationCleanupStartupDelay().toMillis();
  }

  /** Get stuck markers cleanup interval in milliseconds for @Scheduled annotations */
  public long getStuckMarkersCleanupIntervalMs() {
    return config.getSession().getStuckMarkersCleanupInterval().toMillis();
  }

  /** Get stuck markers cleanup startup delay in milliseconds for @Scheduled annotations */
  public long getStuckMarkersCleanupStartupDelayMs() {
    return config.getSession().getStuckMarkersCleanupStartupDelay().toMillis();
  }

  /** Get critical stuck markers cleanup interval in milliseconds for @Scheduled annotations */
  public long getCriticalStuckMarkersCleanupIntervalMs() {
    return config.getSession().getCriticalStuckMarkersCleanupInterval().toMillis();
  }

  /** Get critical stuck markers cleanup startup delay in milliseconds for @Scheduled annotations */
  public long getCriticalStuckMarkersCleanupStartupDelayMs() {
    return config.getSession().getCriticalStuckMarkersCleanupStartupDelay().toMillis();
  }

  /** Get expired sessions cleanup interval in milliseconds for @Scheduled annotations */
  public long getExpiredSessionsCleanupIntervalMs() {
    return config.getSession().getExpiredSessionsCleanupInterval().toMillis();
  }

  /** Get expired sessions cleanup startup delay in milliseconds for @Scheduled annotations */
  public long getExpiredSessionsCleanupStartupDelayMs() {
    return config.getSession().getExpiredSessionsCleanupStartupDelay().toMillis();
  }

  /** Get stale sessions cleanup interval in milliseconds for @Scheduled annotations */
  public long getStaleSessionsCleanupIntervalMs() {
    return config.getSession().getStaleSessionsCleanupInterval().toMillis();
  }

  /** Get stale sessions cleanup startup delay in milliseconds for @Scheduled annotations */
  public long getStaleSessionsCleanupStartupDelayMs() {
    return config.getSession().getStaleSessionsCleanupStartupDelay().toMillis();
  }

  /** Get throttling cache cleanup interval in milliseconds for @Scheduled annotations */
  public long getThrottlingCacheCleanupIntervalMs() {
    return config.getSession().getThrottlingCacheCleanupInterval().toMillis();
  }

  /** Get throttling cache cleanup startup delay in milliseconds for @Scheduled annotations */
  public long getThrottlingCacheCleanupStartupDelayMs() {
    return config.getSession().getThrottlingCacheCleanupStartupDelay().toMillis();
  }
} 