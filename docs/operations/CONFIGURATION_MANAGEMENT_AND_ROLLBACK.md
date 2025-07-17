# Configuration Management and Rollback Procedures

## Overview

This document describes the configuration management system and rollback procedures for the Storesight application. The system provides centralized configuration management, feature flags, gradual rollout capabilities, and emergency rollback procedures.

## Configuration Architecture

### 1. Centralized Configuration

All application configuration is centralized in `ApplicationConfigurationProperties.java`:

- **SSE Configuration**: Connection limits, timeouts, batching settings
- **Session Configuration**: Lock durations, cleanup intervals, TTL settings
- **Cache Configuration**: TTL settings, memory limits, cleanup intervals
- **Monitoring Configuration**: Health check intervals, alert thresholds
- **Security Configuration**: Rate limiting, authentication settings
- **Discovery Configuration**: API limits, timeouts, caching settings

### 2. Feature Flags

Feature flags are managed through `FeatureFlagConfiguration.java` and `FeatureFlagService.java`:

- **Session Management Features**: Enhanced synchronization, stuck session cleanup, distributed locking
- **SSE Features**: Event batching, connection health checks, memory management
- **Cache Features**: Multi-level caching, session-aware caching, statistics
- **Monitoring Features**: Enhanced metrics, performance monitoring, alerting
- **Security Features**: Enhanced authentication, audit logging, IP validation
- **Discovery Features**: Multi-source discovery, cache optimization, rate limiting

### 3. Gradual Rollout

The system supports gradual rollout of new features:

- **Percentage-based rollout**: Roll out to a percentage of instances
- **User-based rollout**: Roll out to specific users (placeholder)
- **Shop-based rollout**: Roll out to specific shops (placeholder)
- **Time-based rollout**: Gradually increase rollout over time
- **Canary rollout**: Roll out to canary instances (placeholder)

## Configuration Properties

### Environment Variables

All configuration can be controlled via environment variables:

```bash
# SSE Configuration
SSE_MAX_CONNECTIONS_PER_SHOP=5
SSE_MAX_CONNECTIONS_GLOBAL=50
SSE_CONNECTION_TIMEOUT=PT2M
SSE_HEARTBEAT_INTERVAL=PT30S
SSE_CLEANUP_INTERVAL=PT1M

# Session Configuration
SESSION_LOCK_DURATION=PT5S
SESSION_STUCK_SESSION_TIMEOUT=PT5M
SESSION_ORPHANED_LOCK_TIMEOUT=PT10M

# Feature Flags
FEATURE_SESSION_ENHANCED_SYNCHRONIZATION=true
FEATURE_SSE_EVENT_BATCHING=true
FEATURE_CACHE_MULTI_LEVEL_CACHING=true

# Gradual Rollout
FEATURE_ROLLOUT_ENABLED=false
FEATURE_ROLLOUT_SESSION_MANAGEMENT_PERCENTAGE=100
FEATURE_ROLLOUT_SSE_IMPROVEMENTS_PERCENTAGE=100
FEATURE_ROLLOUT_STRATEGY=PERCENTAGE_BASED
```

### Application Properties

Configuration is also available through `application.properties`:

```properties
# SSE Configuration
storesight.sse.max-connections-per-shop=${SSE_MAX_CONNECTIONS_PER_SHOP:5}
storesight.sse.max-connections-global=${SSE_MAX_CONNECTIONS_GLOBAL:50}

# Feature Flags
storesight.features.session.enhanced-synchronization=${FEATURE_SESSION_ENHANCED_SYNCHRONIZATION:true}
storesight.features.rollout.enabled=${FEATURE_ROLLOUT_ENABLED:false}
```

## Feature Flag Usage

### In Service Classes

```java
@Service
public class MyService {
    @Autowired
    private FeatureFlagService featureFlagService;
    
    public void performOperation() {
        if (featureFlagService.isEnhancedSynchronizationEnabled()) {
            // Use enhanced synchronization
            performEnhancedOperation();
        } else {
            // Use legacy operation
            performLegacyOperation();
        }
    }
}
```

### Gradual Rollout

```java
// Enable gradual rollout
FEATURE_ROLLOUT_ENABLED=true
FEATURE_ROLLOUT_SESSION_MANAGEMENT_PERCENTAGE=25  // 25% rollout

// The system will automatically determine which instances get the new features
// based on consistent hashing to ensure stability
```

## Rollback Procedures

### 1. Emergency Rollback

For immediate rollback to last known good configuration:

```java
@Autowired
private ConfigurationRollbackService rollbackService;

// Emergency rollback
RollbackResult result = rollbackService.emergencyRollbackToLastKnownGood();
if (result.success) {
    logger.info("Emergency rollback successful: {}", result.message);
} else {
    logger.error("Emergency rollback failed: {}", result.message);
}
```

### 2. Safe Mode

To disable all enhanced features and use conservative settings:

```java
// Enable safe mode
RollbackResult result = rollbackService.enableSafeMode();
```

Safe mode configuration:
- Reduces connection limits
- Disables all enhanced features
- Uses conservative timeouts
- Disables batching and optimization features

### 3. Snapshot-based Rollback

```java
// Save current configuration
rollbackService.saveConfigurationSnapshot("before-deployment");

// Later, rollback to saved snapshot
RollbackResult result = rollbackService.rollbackToSnapshot("before-deployment");
```

### 4. Environment Variable Rollback

For production environments, rollback via environment variables:

```bash
# Disable problematic features
export FEATURE_SESSION_ENHANCED_SYNCHRONIZATION=false
export FEATURE_SSE_EVENT_BATCHING=false

# Reduce limits
export SSE_MAX_CONNECTIONS_PER_SHOP=3
export SSE_MAX_CONNECTIONS_GLOBAL=20

# Restart application
systemctl restart storesight-backend
```

## Monitoring Configuration Health

### Configuration Health Check

```java
ConfigurationHealthStatus status = rollbackService.getConfigurationHealth();
logger.info("Current version: {}", status.currentVersion);
logger.info("Last known good: {}", status.lastKnownGoodVersion);
logger.info("Safe mode active: {}", status.safeModeActive);
```

### Available Snapshots

```java
Map<String, String> snapshots = rollbackService.getAvailableSnapshots();
snapshots.forEach((name, timestamp) -> 
    logger.info("Snapshot '{}' from {}", name, timestamp));
```

## Best Practices

### 1. Configuration Changes

1. **Test in Development**: Always test configuration changes in development first
2. **Gradual Rollout**: Use gradual rollout for risky changes
3. **Save Snapshots**: Save configuration snapshots before major changes
4. **Monitor Metrics**: Monitor application metrics after configuration changes
5. **Mark Known Good**: Mark stable configurations as known good

### 2. Feature Flag Management

1. **Conservative Defaults**: Use conservative defaults for new features
2. **Gradual Enablement**: Enable features gradually using rollout percentages
3. **Clear Naming**: Use clear, descriptive names for feature flags
4. **Documentation**: Document what each feature flag controls
5. **Cleanup**: Remove unused feature flags regularly

### 3. Rollback Procedures

1. **Quick Access**: Ensure rollback procedures are easily accessible
2. **Automation**: Automate rollback procedures where possible
3. **Testing**: Test rollback procedures regularly
4. **Documentation**: Keep rollback procedures well-documented
5. **Communication**: Communicate rollback events to the team

## Emergency Procedures

### 1. Application Instability

If the application becomes unstable:

1. **Enable Safe Mode**: `rollbackService.enableSafeMode()`
2. **Check Logs**: Review application logs for errors
3. **Monitor Metrics**: Check system metrics and alerts
4. **Gradual Recovery**: Re-enable features gradually

### 2. Performance Issues

If performance degrades:

1. **Disable Performance Features**: Turn off batching, caching optimizations
2. **Reduce Limits**: Lower connection limits and timeouts
3. **Monitor Resources**: Check CPU, memory, and database usage
4. **Gradual Re-enablement**: Re-enable features one by one

### 3. Memory Issues

If memory usage is high:

1. **Disable Memory-Intensive Features**: Turn off caching, batching
2. **Reduce Cache Sizes**: Lower memory cache limits
3. **Force Cleanup**: Trigger manual cleanup procedures
4. **Monitor GC**: Check garbage collection metrics

## Configuration Validation

The system automatically validates configuration on startup:

```java
@Component
public class ConfigurationValidator {
    @EventListener(ApplicationReadyEvent.class)
    public void validateConfiguration() {
        // Validates all configuration properties
        // Logs warnings for suboptimal settings
        // Throws exceptions for invalid configurations
    }
}
```

Validation includes:
- **Range Checks**: Ensures values are within acceptable ranges
- **Relationship Validation**: Ensures related settings are consistent
- **Performance Warnings**: Warns about potentially problematic settings
- **Security Validation**: Ensures security settings are appropriate

## Troubleshooting

### Common Issues

1. **Feature Not Working**: Check if feature flag is enabled
2. **Rollout Not Applied**: Verify rollout percentage and strategy
3. **Configuration Not Loading**: Check environment variable names
4. **Validation Errors**: Review startup logs for validation messages

### Debug Commands

```java
// Check feature flag status
boolean enabled = featureFlagService.isEnhancedSynchronizationEnabled();

// Check rollout cache
int cacheSize = featureFlagService.getRolloutCacheSize();

// Clear rollout cache
featureFlagService.clearRolloutCache();

// Get configuration health
ConfigurationHealthStatus health = rollbackService.getConfigurationHealth();
```

## API Endpoints

### Configuration Management Endpoints

```http
# Get current configuration health
GET /api/admin/config/health

# Get available snapshots
GET /api/admin/config/snapshots

# Save configuration snapshot
POST /api/admin/config/snapshots/{name}

# Rollback to snapshot
POST /api/admin/config/rollback/{snapshotName}

# Emergency rollback
POST /api/admin/config/emergency-rollback

# Enable safe mode
POST /api/admin/config/safe-mode
```

### Feature Flag Endpoints

```http
# Get all feature flags status
GET /api/admin/features

# Get specific feature status
GET /api/admin/features/{featureName}

# Clear rollout cache
POST /api/admin/features/clear-cache
```

## Conclusion

The configuration management and rollback system provides:

- **Centralized Configuration**: All settings in one place
- **Feature Flags**: Safe feature rollout and testing
- **Gradual Rollout**: Controlled feature deployment
- **Emergency Procedures**: Quick rollback capabilities
- **Monitoring**: Configuration health and status tracking
- **Validation**: Automatic configuration validation

This system ensures that configuration changes can be made safely and rolled back quickly if issues arise.