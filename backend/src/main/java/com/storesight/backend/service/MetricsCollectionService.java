package com.storesight.backend.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Custom metrics collection service for application-specific metrics
 *
 * <p>This service provides comprehensive metrics collection for: - Session operations and
 * synchronization - SSE connections and events - Cache performance and hit rates - Database
 * operations and performance - System health and resource usage
 */
@Service
public class MetricsCollectionService {

  private static final Logger logger = LoggerFactory.getLogger(MetricsCollectionService.class);

  private final MeterRegistry meterRegistry;

  // Session metrics
  private final Counter sessionLockAcquisitions;
  private final Counter sessionLockFailures;
  private final Counter sessionInvalidations;
  private final Counter stuckSessionsCleared;
  private final Timer sessionOperationDuration;
  private final AtomicLong activeSessionLocks = new AtomicLong(0);

  // SSE metrics
  private final Counter sseConnectionsCreated;
  private final Counter sseConnectionsClosed;
  private final Counter sseEventsPublished;
  private final Counter sseBatchesSent;
  private final Counter sseConnectionErrors;
  private final Timer sseEventProcessingTime;
  private final AtomicLong activeSseConnections = new AtomicLong(0);

  // Cache metrics
  private final Counter cacheHits;
  private final Counter cacheMisses;
  private final Counter cacheEvictions;
  private final Counter cacheSizeViolations;
  private final Timer cacheOperationDuration;
  private final AtomicLong cacheSize = new AtomicLong(0);

  // Database metrics
  private final Counter databaseQueries;
  private final Counter databaseErrors;
  private final Timer databaseQueryDuration;
  private final Counter connectionPoolExhaustion;

  // Provider selection telemetry
  private final Map<String, Counter> providerRequests = new HashMap<>();
  private final Map<String, Counter> providerFailures = new HashMap<>();
  private final Map<String, Timer> providerLatency = new HashMap<>();

  // Scraping provider telemetry
  private final Map<String, Counter> scrapingProviderSuccess = new HashMap<>();
  private final Map<String, Counter> scrapingProviderFailure = new HashMap<>();
  private final Map<String, Timer> scrapingProviderLatency = new HashMap<>();

  // System health metrics
  private final AtomicLong memoryUsage = new AtomicLong(0);
  private final AtomicLong cpuUsage = new AtomicLong(0);
  private final AtomicLong diskUsage = new AtomicLong(0);

  @Autowired
  public MetricsCollectionService(MeterRegistry meterRegistry) {
    this.meterRegistry = meterRegistry;

    // Initialize session metrics
    this.sessionLockAcquisitions =
        Counter.builder("session.lock.acquisitions")
            .description("Total number of session lock acquisitions")
            .register(meterRegistry);

    this.sessionLockFailures =
        Counter.builder("session.lock.failures")
            .description("Total number of session lock acquisition failures")
            .register(meterRegistry);

    this.sessionInvalidations =
        Counter.builder("session.invalidations")
            .description("Total number of session invalidations")
            .register(meterRegistry);

    this.stuckSessionsCleared =
        Counter.builder("session.stuck.cleared")
            .description("Total number of stuck sessions cleared")
            .register(meterRegistry);

    this.sessionOperationDuration =
        Timer.builder("session.operation.duration")
            .description("Duration of session operations")
            .register(meterRegistry);

    // Initialize SSE metrics
    this.sseConnectionsCreated =
        Counter.builder("sse.connections.created")
            .description("Total number of SSE connections created")
            .register(meterRegistry);

    this.sseConnectionsClosed =
        Counter.builder("sse.connections.closed")
            .description("Total number of SSE connections closed")
            .register(meterRegistry);

    this.sseEventsPublished =
        Counter.builder("sse.events.published")
            .description("Total number of SSE events published")
            .register(meterRegistry);

    this.sseBatchesSent =
        Counter.builder("sse.batches.sent")
            .description("Total number of SSE batches sent")
            .register(meterRegistry);

    this.sseConnectionErrors =
        Counter.builder("sse.connection.errors")
            .description("Total number of SSE connection errors")
            .register(meterRegistry);

    this.sseEventProcessingTime =
        Timer.builder("sse.event.processing.time")
            .description("Time taken to process SSE events")
            .register(meterRegistry);

    // Initialize cache metrics
    this.cacheHits =
        Counter.builder("cache.hits")
            .description("Total number of cache hits")
            .register(meterRegistry);

    this.cacheMisses =
        Counter.builder("cache.misses")
            .description("Total number of cache misses")
            .register(meterRegistry);

    this.cacheEvictions =
        Counter.builder("cache.evictions")
            .description("Total number of cache evictions")
            .register(meterRegistry);

    this.cacheSizeViolations =
        Counter.builder("cache.size.violations")
            .description("Total number of cache size violations")
            .register(meterRegistry);

    this.cacheOperationDuration =
        Timer.builder("cache.operation.duration")
            .description("Duration of cache operations")
            .register(meterRegistry);

    // Initialize database metrics
    this.databaseQueries =
        Counter.builder("database.queries")
            .description("Total number of database queries")
            .register(meterRegistry);

    this.databaseErrors =
        Counter.builder("database.errors")
            .description("Total number of database errors")
            .register(meterRegistry);

    this.databaseQueryDuration =
        Timer.builder("database.query.duration")
            .description("Duration of database queries")
            .register(meterRegistry);

    this.connectionPoolExhaustion =
        Counter.builder("database.connection.pool.exhaustion")
            .description("Total number of connection pool exhaustion events")
            .register(meterRegistry);

    // Register gauges for current state metrics
    Gauge.builder("session.locks.active", this, MetricsCollectionService::getActiveSessionLocks)
        .description("Number of currently active session locks")
        .register(meterRegistry);

    Gauge.builder("sse.connections.active", this, MetricsCollectionService::getActiveSseConnections)
        .description("Number of currently active SSE connections")
        .register(meterRegistry);

    Gauge.builder("cache.size.current", this, MetricsCollectionService::getCurrentCacheSize)
        .description("Current cache size")
        .register(meterRegistry);

    Gauge.builder("system.memory.usage", this, MetricsCollectionService::getMemoryUsage)
        .description("Current memory usage percentage")
        .register(meterRegistry);

    Gauge.builder("system.cpu.usage", this, MetricsCollectionService::getCpuUsage)
        .description("Current CPU usage percentage")
        .register(meterRegistry);

    Gauge.builder("system.disk.usage", this, MetricsCollectionService::getDiskUsage)
        .description("Current disk usage percentage")
        .register(meterRegistry);

    logger.info("Metrics collection service initialized with comprehensive monitoring");
  }

  // Session metrics methods
  public void recordSessionLockAcquisition() {
    sessionLockAcquisitions.increment();
    activeSessionLocks.incrementAndGet();
  }

  public void recordSessionLockFailure() {
    sessionLockFailures.increment();
  }

  public void recordSessionLockRelease() {
    activeSessionLocks.decrementAndGet();
  }

  public void recordSessionInvalidation() {
    sessionInvalidations.increment();
  }

  public void recordStuckSessionCleared() {
    stuckSessionsCleared.increment();
  }

  public Timer.Sample startSessionOperation() {
    return Timer.start(meterRegistry);
  }

  public void recordSessionOperationDuration(Timer.Sample sample) {
    sample.stop(sessionOperationDuration);
  }

  // SSE metrics methods
  public void recordSseConnectionCreated() {
    sseConnectionsCreated.increment();
    activeSseConnections.incrementAndGet();
  }

  public void recordSseConnectionClosed() {
    sseConnectionsClosed.increment();
    activeSseConnections.decrementAndGet();
  }

  public void recordSseEventPublished() {
    sseEventsPublished.increment();
  }

  public void recordSseBatchSent() {
    sseBatchesSent.increment();
  }

  public void recordSseConnectionError() {
    sseConnectionErrors.increment();
  }

  public Timer.Sample startSseEventProcessing() {
    return Timer.start(meterRegistry);
  }

  public void recordSseEventProcessingTime(Timer.Sample sample) {
    sample.stop(sseEventProcessingTime);
  }

  // Cache metrics methods
  public void recordCacheHit() {
    cacheHits.increment();
  }

  public void recordCacheMiss() {
    cacheMisses.increment();
  }

  public void recordCacheEviction() {
    cacheEvictions.increment();
  }

  public void recordCacheSizeViolation() {
    cacheSizeViolations.increment();
  }

  public Timer.Sample startCacheOperation() {
    return Timer.start(meterRegistry);
  }

  public void recordCacheOperationDuration(Timer.Sample sample) {
    sample.stop(cacheOperationDuration);
  }

  public void updateCacheSize(long size) {
    cacheSize.set(size);
  }

  // Database metrics methods
  public void recordDatabaseQuery() {
    databaseQueries.increment();
  }

  public void recordDatabaseError() {
    databaseErrors.increment();
  }

  public Timer.Sample startDatabaseQuery() {
    return Timer.start(meterRegistry);
  }

  public void recordDatabaseQueryDuration(Timer.Sample sample) {
    sample.stop(databaseQueryDuration);
  }

  public void recordConnectionPoolExhaustion() {
    connectionPoolExhaustion.increment();
  }

  // Provider selection telemetry methods
  public void recordProviderRequest(String provider) {
    providerRequests
        .computeIfAbsent(
            provider,
            p ->
                Counter.builder("discovery.provider.requests")
                    .tag("provider", p)
                    .description("Discovery provider requests")
                    .register(meterRegistry))
        .increment();
  }

  public void recordProviderFailure(String provider) {
    providerFailures
        .computeIfAbsent(
            provider,
            p ->
                Counter.builder("discovery.provider.failures")
                    .tag("provider", p)
                    .description("Discovery provider failures")
                    .register(meterRegistry))
        .increment();
  }

  public Timer.Sample startProviderLatency(String provider) {
    Timer timer =
        providerLatency.computeIfAbsent(
            provider,
            p ->
                Timer.builder("discovery.provider.latency")
                    .tag("provider", p)
                    .description("Discovery provider latency")
                    .register(meterRegistry));
    return Timer.start(meterRegistry);
  }

  public void recordProviderLatency(Timer.Sample sample, String provider) {
    Timer timer = providerLatency.get(provider);
    if (timer != null) sample.stop(timer);
  }

  // Scraping provider telemetry methods
  public void recordScrapingSuccess(String provider) {
    scrapingProviderSuccess
        .computeIfAbsent(
            provider,
            p ->
                Counter.builder("scraping.provider.success")
                    .tag("provider", p)
                    .description("Scraping success by provider")
                    .register(meterRegistry))
        .increment();
  }

  public void recordScrapingFailure(String provider) {
    scrapingProviderFailure
        .computeIfAbsent(
            provider,
            p ->
                Counter.builder("scraping.provider.failure")
                    .tag("provider", p)
                    .description("Scraping failures by provider")
                    .register(meterRegistry))
        .increment();
  }

  public Timer.Sample startScrapingLatency(String provider) {
    Timer timer =
        scrapingProviderLatency.computeIfAbsent(
            provider,
            p ->
                Timer.builder("scraping.provider.latency")
                    .tag("provider", p)
                    .description("Scraping provider latency")
                    .register(meterRegistry));
    return Timer.start(meterRegistry);
  }

  public void recordScrapingLatency(Timer.Sample sample, String provider) {
    Timer timer = scrapingProviderLatency.get(provider);
    if (timer != null) sample.stop(timer);
  }

  // System health metrics methods
  public void updateMemoryUsage(long usage) {
    memoryUsage.set(usage);
  }

  public void updateCpuUsage(long usage) {
    cpuUsage.set(usage);
  }

  public void updateDiskUsage(long usage) {
    diskUsage.set(usage);
  }

  // Gauge value providers
  public double getActiveSessionLocks() {
    return activeSessionLocks.get();
  }

  public double getActiveSseConnections() {
    return activeSseConnections.get();
  }

  public double getCurrentCacheSize() {
    return cacheSize.get();
  }

  public double getMemoryUsage() {
    return memoryUsage.get();
  }

  public double getCpuUsage() {
    return cpuUsage.get();
  }

  public double getDiskUsage() {
    return diskUsage.get();
  }

  // Comprehensive metrics summary
  public Map<String, Object> getMetricsSummary() {
    Map<String, Object> summary = new HashMap<>();

    // Session metrics
    Map<String, Object> sessionMetrics = new HashMap<>();
    sessionMetrics.put("lockAcquisitions", sessionLockAcquisitions.count());
    sessionMetrics.put("lockFailures", sessionLockFailures.count());
    sessionMetrics.put("invalidations", sessionInvalidations.count());
    sessionMetrics.put("stuckSessionsCleared", stuckSessionsCleared.count());
    sessionMetrics.put("activeLocks", activeSessionLocks.get());
    sessionMetrics.put(
        "averageOperationDuration", sessionOperationDuration.mean(TimeUnit.MILLISECONDS));
    summary.put("session", sessionMetrics);

    // SSE metrics
    Map<String, Object> sseMetrics = new HashMap<>();
    sseMetrics.put("connectionsCreated", sseConnectionsCreated.count());
    sseMetrics.put("connectionsClosed", sseConnectionsClosed.count());
    sseMetrics.put("eventsPublished", sseEventsPublished.count());
    sseMetrics.put("batchesSent", sseBatchesSent.count());
    sseMetrics.put("connectionErrors", sseConnectionErrors.count());
    sseMetrics.put("activeConnections", activeSseConnections.get());
    sseMetrics.put(
        "averageEventProcessingTime", sseEventProcessingTime.mean(TimeUnit.MILLISECONDS));
    summary.put("sse", sseMetrics);

    // Cache metrics
    Map<String, Object> cacheMetrics = new HashMap<>();
    cacheMetrics.put("hits", cacheHits.count());
    cacheMetrics.put("misses", cacheMisses.count());
    cacheMetrics.put("evictions", cacheEvictions.count());
    cacheMetrics.put("sizeViolations", cacheSizeViolations.count());
    cacheMetrics.put("currentSize", cacheSize.get());

    double totalCacheRequests = cacheHits.count() + cacheMisses.count();
    double hitRate = totalCacheRequests > 0 ? (cacheHits.count() / totalCacheRequests) * 100 : 0;
    cacheMetrics.put("hitRate", hitRate);
    cacheMetrics.put(
        "averageOperationDuration", cacheOperationDuration.mean(TimeUnit.MILLISECONDS));
    summary.put("cache", cacheMetrics);

    // Database metrics
    Map<String, Object> databaseMetrics = new HashMap<>();
    databaseMetrics.put("queries", databaseQueries.count());
    databaseMetrics.put("errors", databaseErrors.count());
    databaseMetrics.put("connectionPoolExhaustion", connectionPoolExhaustion.count());
    databaseMetrics.put("averageQueryDuration", databaseQueryDuration.mean(TimeUnit.MILLISECONDS));

    double totalQueries = databaseQueries.count();
    double errorRate = totalQueries > 0 ? (databaseErrors.count() / totalQueries) * 100 : 0;
    databaseMetrics.put("errorRate", errorRate);
    summary.put("database", databaseMetrics);

    // System health metrics
    Map<String, Object> systemMetrics = new HashMap<>();
    systemMetrics.put("memoryUsage", memoryUsage.get());
    systemMetrics.put("cpuUsage", cpuUsage.get());
    systemMetrics.put("diskUsage", diskUsage.get());
    summary.put("system", systemMetrics);

    return summary;
  }

  // Performance health indicators
  public Map<String, String> getHealthIndicators() {
    Map<String, String> indicators = new HashMap<>();

    // Session health
    double lockFailureRate =
        sessionLockAcquisitions.count() > 0
            ? (sessionLockFailures.count() / sessionLockAcquisitions.count()) * 100
            : 0;
    indicators.put(
        "sessionLockHealth",
        lockFailureRate < 5 ? "HEALTHY" : lockFailureRate < 15 ? "WARNING" : "CRITICAL");

    // SSE health
    double sseErrorRate =
        sseConnectionsCreated.count() > 0
            ? (sseConnectionErrors.count() / sseConnectionsCreated.count()) * 100
            : 0;
    indicators.put(
        "sseHealth", sseErrorRate < 5 ? "HEALTHY" : sseErrorRate < 15 ? "WARNING" : "CRITICAL");

    // Cache health
    double totalCacheRequests = cacheHits.count() + cacheMisses.count();
    double hitRate = totalCacheRequests > 0 ? (cacheHits.count() / totalCacheRequests) * 100 : 0;
    indicators.put("cacheHealth", hitRate > 70 ? "HEALTHY" : hitRate > 50 ? "WARNING" : "CRITICAL");

    // Database health
    double dbErrorRate =
        databaseQueries.count() > 0 ? (databaseErrors.count() / databaseQueries.count()) * 100 : 0;
    indicators.put(
        "databaseHealth", dbErrorRate < 1 ? "HEALTHY" : dbErrorRate < 5 ? "WARNING" : "CRITICAL");

    // System health
    indicators.put(
        "memoryHealth",
        memoryUsage.get() < 80 ? "HEALTHY" : memoryUsage.get() < 90 ? "WARNING" : "CRITICAL");
    indicators.put(
        "cpuHealth",
        cpuUsage.get() < 80 ? "HEALTHY" : cpuUsage.get() < 90 ? "WARNING" : "CRITICAL");
    indicators.put(
        "diskHealth",
        diskUsage.get() < 80 ? "HEALTHY" : diskUsage.get() < 90 ? "WARNING" : "CRITICAL");

    return indicators;
  }

  // Reset metrics (useful for testing)
  public void resetMetrics() {
    // Note: Micrometer counters cannot be reset, but we can log the reset
    activeSessionLocks.set(0);
    activeSseConnections.set(0);
    cacheSize.set(0);
    memoryUsage.set(0);
    cpuUsage.set(0);
    diskUsage.set(0);

    logger.info("Metrics collection service state reset (counters retain historical values)");
  }
}
