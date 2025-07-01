package com.storesight.backend.service;

import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

@Service
public class DatabaseMonitoringService {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseMonitoringService.class);
    
    private final DataSource dataSource;
    private long lastConnectionFailureTime = 0;
    private int consecutiveFailures = 0;

    public DatabaseMonitoringService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Scheduled(fixedRate = 60000) // Run every minute
    public void monitorDatabaseHealth() {
        if (dataSource instanceof HikariDataSource) {
            monitorHikariCPHealth((HikariDataSource) dataSource);
        } else {
            monitorBasicConnectionHealth();
        }
    }

    private void monitorHikariCPHealth(HikariDataSource hikariDataSource) {
        try {
            Map<String, Object> metrics = new HashMap<>();
            
            // Get HikariCP metrics
            metrics.put("activeConnections", hikariDataSource.getHikariPoolMXBean().getActiveConnections());
            metrics.put("idleConnections", hikariDataSource.getHikariPoolMXBean().getIdleConnections());
            metrics.put("totalConnections", hikariDataSource.getHikariPoolMXBean().getTotalConnections());
            metrics.put("threadsAwaitingConnection", hikariDataSource.getHikariPoolMXBean().getThreadsAwaitingConnection());
            metrics.put("maxPoolSize", hikariDataSource.getMaximumPoolSize());
            metrics.put("minimumIdle", hikariDataSource.getMinimumIdle());
            
            // Test actual connection
            try (Connection connection = hikariDataSource.getConnection()) {
                boolean isValid = connection.isValid(5); // 5 second timeout
                metrics.put("connectionValid", isValid);
                
                if (isValid) {
                    consecutiveFailures = 0;
                    if (lastConnectionFailureTime > 0) {
                        logger.info("Database connection recovered after {} failures", consecutiveFailures);
                        lastConnectionFailureTime = 0;
                    }
                    
                    // Log metrics if there are issues
                    if ((Integer) metrics.get("threadsAwaitingConnection") > 0) {
                        logger.warn("Database connection pool under pressure: {}", metrics);
                    } else if (logger.isDebugEnabled()) {
                        logger.debug("Database health check passed: {}", metrics);
                    }
                } else {
                    handleConnectionFailure("Connection validation failed", metrics);
                }
            } catch (SQLException e) {
                handleConnectionFailure("Connection test failed: " + e.getMessage(), metrics);
            }
        } catch (Exception e) {
            logger.error("Database monitoring failed", e);
        }
    }

    private void monitorBasicConnectionHealth() {
        try (Connection connection = dataSource.getConnection()) {
            boolean isValid = connection.isValid(5);
            if (isValid) {
                consecutiveFailures = 0;
                if (lastConnectionFailureTime > 0) {
                    logger.info("Database connection recovered");
                    lastConnectionFailureTime = 0;
                }
            } else {
                handleConnectionFailure("Connection validation failed", Map.of("connectionValid", false));
            }
        } catch (SQLException e) {
            handleConnectionFailure("Connection test failed: " + e.getMessage(), Map.of("error", e.getMessage()));
        }
    }

    private void handleConnectionFailure(String error, Map<String, Object> metrics) {
        consecutiveFailures++;
        long currentTime = System.currentTimeMillis();
        
        if (lastConnectionFailureTime == 0) {
            lastConnectionFailureTime = currentTime;
        }
        
        long failureDuration = currentTime - lastConnectionFailureTime;
        
        logger.error("Database connection failure #{} (duration: {}ms): {} - Metrics: {}", 
                    consecutiveFailures, failureDuration, error, metrics);
        
        // Alert on consecutive failures
        if (consecutiveFailures >= 3) {
            logger.error("CRITICAL: Database connection has failed {} consecutive times over {}ms", 
                        consecutiveFailures, failureDuration);
        }
    }

    public Map<String, Object> getDatabaseMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        
        if (dataSource instanceof HikariDataSource) {
            HikariDataSource hikariDataSource = (HikariDataSource) dataSource;
            metrics.put("activeConnections", hikariDataSource.getHikariPoolMXBean().getActiveConnections());
            metrics.put("idleConnections", hikariDataSource.getHikariPoolMXBean().getIdleConnections());
            metrics.put("totalConnections", hikariDataSource.getHikariPoolMXBean().getTotalConnections());
            metrics.put("threadsAwaitingConnection", hikariDataSource.getHikariPoolMXBean().getThreadsAwaitingConnection());
            metrics.put("maxPoolSize", hikariDataSource.getMaximumPoolSize());
            metrics.put("minimumIdle", hikariDataSource.getMinimumIdle());
        }
        
        metrics.put("consecutiveFailures", consecutiveFailures);
        metrics.put("lastFailureTime", lastConnectionFailureTime);
        
        return metrics;
    }
} 