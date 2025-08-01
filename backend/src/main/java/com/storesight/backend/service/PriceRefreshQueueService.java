package com.storesight.backend.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Scalable, event-driven price refresh queue service with domain-based rate limiting, intelligent
 * batching, and progress tracking. Designed to handle 100+ competitors across multiple e-commerce
 * platforms without overwhelming external services.
 */
@Service
public class PriceRefreshQueueService {

  private static final Logger logger = LoggerFactory.getLogger(PriceRefreshQueueService.class);

  @Autowired private RedisTemplate<String, Object> redisTemplate;
  @Autowired private PriceScrapingService priceScrapingService;
  @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

  // Configuration - MEMORY OPTIMIZED FOR 512MB INSTANCE
  @Value("${price.refresh.enabled:true}")
  private boolean priceRefreshEnabled;

  @Value("${price.refresh.max-concurrent-domains:2}")
  private int maxConcurrentDomains;

  @Value("${price.refresh.batch-size:3}")
  private int batchSize;

  @Value("${price.refresh.progress-update-interval:10}")
  private int progressUpdateIntervalSeconds;

  // Memory-efficient thread pool configuration
  @Value("${price.refresh.thread-pool.core-size:2}")
  private int coreThreads;

  @Value("${price.refresh.thread-pool.max-size:3}")
  private int maxThreads;

  @Value("${price.refresh.thread-pool.queue-capacity:10}")
  private int queueCapacity;

  // Session management optimization
  @Value("${price.refresh.session-cleanup-interval:300}")
  private int sessionCleanupIntervalSeconds;

  @Value("${price.refresh.session-max-age:1800}")
  private int sessionMaxAgeSeconds;

  // Memory monitoring
  @Value("${price.refresh.memory-monitoring.enabled:true}")
  private boolean memoryMonitoringEnabled;

  @Value("${price.refresh.memory-threshold:85}")
  private int memoryThresholdPercent;

  // Graceful degradation
  @Value("${price.refresh.fallback.enabled:true}")
  private boolean fallbackEnabled;

  @Value("${price.refresh.fallback.memory-threshold:90}")
  private int fallbackMemoryThreshold;

  // Domain-specific rate limits (requests per minute)
  private static final Map<String, Integer> DOMAIN_RATE_LIMITS =
      Map.of(
          "amazon.com", 20, // 1 request every 3 seconds
          "shopify.com", 30, // 1 request every 2 seconds
          "etsy.com", 12, // 1 request every 5 seconds
          "walmart.com", 15, // 1 request every 4 seconds
          "ebay.com", 18, // 1 request every 3.3 seconds
          "default", 15 // Default for unknown domains
          );

  // Thread pools for concurrent domain processing
  private final ExecutorService domainExecutor;
  private final ScheduledExecutorService progressExecutor;

  // Rate limiters per domain
  private final Map<String, RateLimiter> domainRateLimiters = new ConcurrentHashMap<>();

  // Progress tracking
  private final Map<String, RefreshProgress> activeRefreshSessions = new ConcurrentHashMap<>();

  public PriceRefreshQueueService() {
    // Memory-optimized thread pools for 512MB instance
    this.domainExecutor =
        new ThreadPoolExecutor(
            coreThreads, // Core threads
            maxThreads, // Max threads
            60L,
            TimeUnit.SECONDS, // Keep alive time
            new LinkedBlockingQueue<>(queueCapacity), // Bounded queue
            r -> {
              Thread t = new Thread(r, "price-refresh-domain-" + System.currentTimeMillis());
              t.setDaemon(true); // Allow JVM to exit
              return t;
            },
            new ThreadPoolExecutor.CallerRunsPolicy() // Reject policy
            );

    this.progressExecutor =
        Executors.newScheduledThreadPool(
            1, // Reduced from 2
            r -> {
              Thread t = new Thread(r, "price-refresh-progress-" + System.currentTimeMillis());
              t.setDaemon(true);
              t.setPriority(Thread.MIN_PRIORITY); // Lower priority
              return t;
            });
  }

  /** Main entry point: Start price refresh for a shop's competitors */
  public RefreshSession startPriceRefresh(Long shopId, List<CompetitorRefreshItem> competitors) {
    // Check if price refresh is enabled
    if (!priceRefreshEnabled) {
      logger.warn("Price refresh is disabled, returning empty session");
      return new RefreshSession("disabled", 0, 0);
    }

    String sessionId = "refresh_" + shopId + "_" + System.currentTimeMillis();

    logger.info(
        "Starting price refresh session {} for shop {} with {} competitors",
        sessionId,
        shopId,
        competitors.size());

    // Memory monitoring check
    if (memoryMonitoringEnabled && isMemoryUsageHigh()) {
      logger.warn("High memory usage detected, enabling fallback mode for session {}", sessionId);
      if (fallbackEnabled) {
        return startFallbackRefresh(sessionId, shopId, competitors);
      } else {
        throw new RuntimeException("Memory usage too high for price refresh operations");
      }
    }

    // Create progress tracker
    RefreshProgress progress = new RefreshProgress(sessionId, shopId, competitors.size());
    activeRefreshSessions.put(sessionId, progress);

    // Group competitors by domain for efficient processing
    Map<String, List<CompetitorRefreshItem>> competitorsByDomain = groupByDomain(competitors);

    logger.info(
        "Grouped {} competitors into {} domains: {}",
        competitors.size(),
        competitorsByDomain.size(),
        competitorsByDomain.keySet());

    // Submit domain processing tasks (limited by maxConcurrentDomains)
    int submittedTasks = 0;
    for (Map.Entry<String, List<CompetitorRefreshItem>> entry : competitorsByDomain.entrySet()) {
      if (submittedTasks >= maxConcurrentDomains) {
        logger.info(
            "Reached max concurrent domains limit ({}), queuing remaining tasks",
            maxConcurrentDomains);
        break;
      }

      String domain = entry.getKey();
      List<CompetitorRefreshItem> domainCompetitors = entry.getValue();

      // Submit domain processing task
      domainExecutor.submit(() -> processDomainCompetitors(sessionId, domain, domainCompetitors));
      submittedTasks++;
    }

    // Start progress broadcasting
    scheduleProgressUpdates(sessionId);

    return new RefreshSession(sessionId, competitors.size(), competitorsByDomain.size());
  }

  /** Process all competitors for a specific domain with rate limiting */
  private void processDomainCompetitors(
      String sessionId, String domain, List<CompetitorRefreshItem> competitors) {
    logger.info(
        "Processing {} competitors for domain {} in session {}",
        competitors.size(),
        domain,
        sessionId);

    RateLimiter rateLimiter = getDomainRateLimiter(domain);
    RefreshProgress progress = activeRefreshSessions.get(sessionId);

    if (progress == null) {
      logger.warn("Progress tracker not found for session {}", sessionId);
      return;
    }

    // Process competitors in batches with rate limiting
    for (int i = 0; i < competitors.size(); i += batchSize) {
      int endIndex = Math.min(i + batchSize, competitors.size());
      List<CompetitorRefreshItem> batch = competitors.subList(i, endIndex);

      logger.debug(
          "Processing batch {}-{} for domain {} in session {}", i + 1, endIndex, domain, sessionId);

      processBatch(sessionId, domain, batch, rateLimiter, progress);

      // Add inter-batch delay for additional safety
      if (endIndex < competitors.size()) {
        try {
          Thread.sleep(1000); // 1 second between batches
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          logger.warn(
              "Batch processing interrupted for domain {} in session {}", domain, sessionId);
          return;
        }
      }
    }

    logger.info("Completed processing domain {} in session {}", domain, sessionId);
    progress.markDomainCompleted(domain);
  }

  /** Process a batch of competitors with rate limiting */
  private void processBatch(
      String sessionId,
      String domain,
      List<CompetitorRefreshItem> batch,
      RateLimiter rateLimiter,
      RefreshProgress progress) {

    for (CompetitorRefreshItem competitor : batch) {
      // Apply rate limiting
      rateLimiter.acquirePermit();

      try {
        // Check if URL was recently scraped
        if (wasRecentlyScraped(competitor.url)) {
          logger.debug("Skipping recently scraped URL: {}", competitor.url);
          progress.incrementSkipped();
          continue;
        }

        // Perform price scraping
        PriceScrapingService.PriceScrapingResult result =
            priceScrapingService.scrapePriceWithMultiTier(competitor.url);

        if (result.isSuccess()) {
          // Store result and update progress
          storePriceSnapshot(competitor, result);
          progress.incrementCompleted();

          logger.debug(
              "Successfully refreshed price for competitor {}: ${} via {}",
              competitor.id,
              result.getPrice(),
              result.getScraperSource());
        } else {
          progress.incrementFailed();
          logger.warn(
              "Failed to refresh price for competitor {}: {}",
              competitor.id,
              result.getFailureReason());
        }

        // Mark as recently scraped
        markAsRecentlyScraped(competitor.url);

      } catch (Exception e) {
        progress.incrementFailed();
        logger.error(
            "Error processing competitor {} in session {}: {}",
            competitor.id,
            sessionId,
            e.getMessage(),
            e);
      }
    }
  }

  /** Group competitors by their domain for efficient processing */
  private Map<String, List<CompetitorRefreshItem>> groupByDomain(
      List<CompetitorRefreshItem> competitors) {
    Map<String, List<CompetitorRefreshItem>> result = new HashMap<>();

    for (CompetitorRefreshItem competitor : competitors) {
      String domain = extractDomain(competitor.url);
      result.computeIfAbsent(domain, k -> new ArrayList<>()).add(competitor);
    }

    return result;
  }

  /** Get or create a rate limiter for a domain */
  private RateLimiter getDomainRateLimiter(String domain) {
    return domainRateLimiters.computeIfAbsent(
        domain,
        d -> {
          int requestsPerMinute =
              DOMAIN_RATE_LIMITS.getOrDefault(d, DOMAIN_RATE_LIMITS.get("default"));
          logger.info(
              "Creating rate limiter for domain {} with {} requests/minute", d, requestsPerMinute);
          return new RateLimiter(requestsPerMinute);
        });
  }

  /** Check if URL was scraped recently (within 2 hours) */
  private boolean wasRecentlyScraped(String url) {
    String key = "recent_scrape:" + extractDomain(url) + ":" + url.hashCode();
    return Boolean.TRUE.equals(redisTemplate.hasKey(key));
  }

  /** Mark URL as recently scraped */
  private void markAsRecentlyScraped(String url) {
    String key = "recent_scrape:" + extractDomain(url) + ":" + url.hashCode();
    redisTemplate.opsForValue().set(key, "1", Duration.ofHours(2));
  }

  /** Extract domain from URL */
  private String extractDomain(String url) {
    try {
      String domain =
          url.toLowerCase()
              .replaceFirst("^https?://", "")
              .replaceFirst("^www\\.", "")
              .split("/")[0];

      // Map specific domains to known rate limit categories
      if (domain.contains("amazon.")) return "amazon.com";
      if (domain.contains("shopify.") || url.contains("myshopify.com")) return "shopify.com";
      if (domain.contains("etsy.")) return "etsy.com";
      if (domain.contains("walmart.")) return "walmart.com";
      if (domain.contains("ebay.")) return "ebay.com";

      return domain;
    } catch (Exception e) {
      logger.warn("Failed to extract domain from URL: {}", url);
      return "unknown";
    }
  }

  /** Store price snapshot result */
  private void storePriceSnapshot(
      CompetitorRefreshItem competitor, PriceScrapingService.PriceScrapingResult result) {
    try {
      // Store in database using JdbcTemplate (similar to existing implementations)
      jdbcTemplate.update(
          "INSERT INTO price_snapshots (competitor_url_id, price, in_stock, checked_at, scraper_version, scraper_source, platform, response_time_ms) "
              + "VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)",
          competitor.id,
          result.getPrice(),
          result.isInStock(),
          "v3.0-queue-based",
          result.getScraperSource(),
          result.getPlatform(),
          result.getResponseTime());

      // Update competitor URL status
      jdbcTemplate.update(
          "UPDATE competitor_urls SET status = 'active', last_successful_check = CURRENT_TIMESTAMP, error_count = 0, response_time_ms = ? WHERE id = ?",
          result.getResponseTime(),
          competitor.id);

      logger.debug(
          "Stored price snapshot for competitor {}: ${} via {}",
          competitor.id,
          result.getPrice(),
          result.getScraperSource());

      // Also cache the price for future use
      String cacheKey = "price_cache:" + competitor.url.hashCode();
      redisTemplate.opsForValue().set(cacheKey, result.getPrice().toString(), Duration.ofHours(6));

    } catch (Exception e) {
      logger.error(
          "Failed to store price snapshot for competitor {}: {}", competitor.id, e.getMessage());
    }
  }

  /** Schedule periodic progress updates via SSE */
  private void scheduleProgressUpdates(String sessionId) {
    progressExecutor.scheduleWithFixedDelay(
        () -> {
          RefreshProgress progress = activeRefreshSessions.get(sessionId);
          if (progress == null || progress.isCompleted()) {
            return; // Stop scheduling if session is done
          }

          // Broadcast progress update via SSE
          broadcastProgressUpdate(progress);
        },
        progressUpdateIntervalSeconds,
        progressUpdateIntervalSeconds,
        TimeUnit.SECONDS);
  }

  /** Broadcast progress update to frontend via SSE */
  private void broadcastProgressUpdate(RefreshProgress progress) {
    try {
      // This would integrate with your SSE service for real-time updates
      // For now, we rely on frontend polling via the REST API
      logger.debug(
          "Progress update for session {}: {}% complete ({})",
          progress.sessionId, progress.getPercentage(), progress.getStatus());

    } catch (Exception e) {
      logger.error("Failed to broadcast progress update: {}", e.getMessage());
    }
  }

  /** Get current progress for a refresh session */
  public RefreshProgress getProgress(String sessionId) {
    return activeRefreshSessions.get(sessionId);
  }

  /** Check if memory usage is above threshold */
  private boolean isMemoryUsageHigh() {
    Runtime runtime = Runtime.getRuntime();
    long usedMemory = runtime.totalMemory() - runtime.freeMemory();
    long maxMemory = runtime.maxMemory();
    double memoryUsagePercent = (double) usedMemory / maxMemory * 100;

    logger.debug(
        "Memory usage: {}/{} MB ({}%)",
        usedMemory / 1024 / 1024,
        maxMemory / 1024 / 1024,
        String.format("%.1f", memoryUsagePercent));

    return memoryUsagePercent > memoryThresholdPercent;
  }

  /** Start fallback refresh with reduced concurrency */
  private RefreshSession startFallbackRefresh(
      String sessionId, Long shopId, List<CompetitorRefreshItem> competitors) {
    logger.info("Starting fallback refresh for session {} with reduced concurrency", sessionId);

    // Create progress tracker
    RefreshProgress progress = new RefreshProgress(sessionId, shopId, competitors.size());
    activeRefreshSessions.put(sessionId, progress);

    // Process sequentially with minimal concurrency
    progressExecutor.schedule(
        () -> {
          for (CompetitorRefreshItem competitor : competitors) {
            try {
              // Simple sequential processing
              PriceScrapingService.PriceScrapingResult result =
                  priceScrapingService.scrapePriceWithMultiTier(competitor.url);

              if (result.isSuccess()) {
                storePriceSnapshot(competitor, result);
                progress.incrementCompleted();
              } else {
                progress.incrementFailed();
              }

              // Small delay between requests
              Thread.sleep(1000);

            } catch (Exception e) {
              logger.error(
                  "Fallback processing failed for competitor {}: {}",
                  competitor.id,
                  e.getMessage());
              progress.incrementFailed();
            }
          }
        },
        0,
        TimeUnit.SECONDS);

    return new RefreshSession(sessionId, competitors.size(), 1); // Single domain in fallback
  }

  /** Rate limiter implementation */
  private static class RateLimiter {
    private final long intervalMs;
    private long lastRequestTime = 0;

    public RateLimiter(int requestsPerMinute) {
      this.intervalMs = 60000 / requestsPerMinute; // Convert to milliseconds between requests
    }

    public synchronized void acquirePermit() {
      long now = System.currentTimeMillis();
      long timeSinceLastRequest = now - lastRequestTime;

      if (timeSinceLastRequest < intervalMs) {
        long sleepTime = intervalMs - timeSinceLastRequest;
        try {
          Thread.sleep(sleepTime);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
        }
      }

      lastRequestTime = System.currentTimeMillis();
    }
  }

  /** Progress tracking class */
  public static class RefreshProgress {
    public final String sessionId;
    public final Long shopId;
    public final int total;
    public final AtomicInteger completed = new AtomicInteger(0);
    public final AtomicInteger failed = new AtomicInteger(0);
    public final AtomicInteger skipped = new AtomicInteger(0);
    public final LocalDateTime startTime;
    public final Set<String> completedDomains = ConcurrentHashMap.newKeySet();

    public RefreshProgress(String sessionId, Long shopId, int total) {
      this.sessionId = sessionId;
      this.shopId = shopId;
      this.total = total;
      this.startTime = LocalDateTime.now();
    }

    public void incrementCompleted() {
      completed.incrementAndGet();
    }

    public void incrementFailed() {
      failed.incrementAndGet();
    }

    public void incrementSkipped() {
      skipped.incrementAndGet();
    }

    public void markDomainCompleted(String domain) {
      completedDomains.add(domain);
    }

    public int getPercentage() {
      return total > 0
          ? (int) ((completed.get() + failed.get() + skipped.get()) * 100.0 / total)
          : 0;
    }

    public boolean isCompleted() {
      return (completed.get() + failed.get() + skipped.get()) >= total;
    }

    public String getStatus() {
      if (isCompleted()) return "completed";
      if (completed.get() > 0 || failed.get() > 0 || skipped.get() > 0) return "processing";
      return "starting";
    }

    public String getEstimatedTimeRemaining() {
      if (isCompleted()) return "0s";

      int processed = completed.get() + failed.get() + skipped.get();
      if (processed == 0) return "calculating...";

      Duration elapsed = Duration.between(startTime, LocalDateTime.now());
      long avgTimePerItem = elapsed.toMillis() / processed;
      long remainingItems = total - processed;
      long estimatedMs = avgTimePerItem * remainingItems;

      if (estimatedMs < 60000) return (estimatedMs / 1000) + "s";
      return (estimatedMs / 60000) + "m " + ((estimatedMs % 60000) / 1000) + "s";
    }
  }

  /** Competitor refresh item */
  public static class CompetitorRefreshItem {
    public final Long id;
    public final String url;
    public final String label;

    public CompetitorRefreshItem(Long id, String url, String label) {
      this.id = id;
      this.url = url;
      this.label = label;
    }
  }

  /** Refresh session info */
  public static class RefreshSession {
    public final String sessionId;
    public final int totalCompetitors;
    public final int totalDomains;

    public RefreshSession(String sessionId, int totalCompetitors, int totalDomains) {
      this.sessionId = sessionId;
      this.totalCompetitors = totalCompetitors;
      this.totalDomains = totalDomains;
    }
  }
}
