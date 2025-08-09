package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
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

@Service
public class RedisPriceRefreshQueueService {

  private static final Logger logger = LoggerFactory.getLogger(RedisPriceRefreshQueueService.class);

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

  // Redis configuration
  @Value("${price.refresh.redis.enabled:true}")
  private boolean redisEnabled;

  @Value("${price.refresh.redis.key-prefix:mi:price_refresh}")
  private String redisKeyPrefix;

  @Value("${price.refresh.redis.ttl:3600}")
  private int redisTtlSeconds;

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
  private ExecutorService domainExecutor;
  private ScheduledExecutorService progressExecutor;

  // Rate limiters per domain (minimal in-memory storage)
  private final Map<String, RateLimiter> domainRateLimiters = new ConcurrentHashMap<>();

  // Object mapper for JSON serialization
  private final ObjectMapper objectMapper = new ObjectMapper();

  public RedisPriceRefreshQueueService() {
    // Constructor left empty - initialization moved to @PostConstruct
  }

  @PostConstruct
  public void initialize() {
    // Memory-optimized thread pools for 512MB instance
    // Ensure queueCapacity is valid (default to 10 if null or invalid)
    int safeQueueCapacity = (queueCapacity > 0) ? queueCapacity : 10;

    this.domainExecutor =
        new ThreadPoolExecutor(
            coreThreads, // Core threads
            maxThreads, // Max threads
            60L,
            TimeUnit.SECONDS, // Keep alive time
            new LinkedBlockingQueue<>(safeQueueCapacity), // Bounded queue
            r -> {
              Thread t = new Thread(r, "redis-price-refresh-domain-" + System.currentTimeMillis());
              t.setDaemon(true); // Allow JVM to exit
              return t;
            },
            new ThreadPoolExecutor.CallerRunsPolicy() // Reject policy
            );

    this.progressExecutor =
        Executors.newScheduledThreadPool(
            1, // Reduced from 2
            r -> {
              Thread t =
                  new Thread(r, "redis-price-refresh-progress-" + System.currentTimeMillis());
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

    // Check if Redis is available and enabled
    boolean redisAvailable = redisEnabled && isRedisAvailable();

    if (!redisAvailable) {
      logger.warn("Redis is not available, using in-memory processing");
      return startInMemoryRefresh(shopId, competitors);
    }

    String sessionId = "refresh_" + shopId + "_" + System.currentTimeMillis();

    logger.info(
        "Starting Redis-based price refresh session {} for shop {} with {} competitors",
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

    try {
      // Store session data in Redis
      storeSessionInRedis(sessionId, shopId, competitors);

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

    } catch (Exception e) {
      logger.error("Failed to start Redis-based refresh session {}: {}", sessionId, e.getMessage());
      // Fallback to in-memory processing
      return startInMemoryRefresh(shopId, competitors);
    }
  }

  /** Store session data in Redis */
  private void storeSessionInRedis(
      String sessionId, Long shopId, List<CompetitorRefreshItem> competitors) {
    try {
      String sessionKey = redisKeyPrefix + ":session:" + sessionId;
      String progressKey = redisKeyPrefix + ":progress:" + sessionId;
      String queueKey = redisKeyPrefix + ":queue:" + sessionId;

      // Store session metadata
      Map<String, String> sessionData = new HashMap<>();
      sessionData.put("sessionId", sessionId);
      sessionData.put("shopId", String.valueOf(shopId));
      sessionData.put("totalCompetitors", String.valueOf(competitors.size()));
      sessionData.put("createdAt", LocalDateTime.now().toString());
      sessionData.put("status", "STARTED");

      redisTemplate.opsForHash().putAll(sessionKey, sessionData);
      redisTemplate.expire(sessionKey, Duration.ofSeconds(redisTtlSeconds));

      // Store progress data
      Map<String, String> progressData = new HashMap<>();
      progressData.put("completed", "0");
      progressData.put("failed", "0");
      progressData.put("skipped", "0");
      progressData.put("total", String.valueOf(competitors.size()));
      progressData.put("startTime", LocalDateTime.now().toString());
      progressData.put("lastUpdated", LocalDateTime.now().toString());

      redisTemplate.opsForHash().putAll(progressKey, progressData);
      redisTemplate.expire(progressKey, Duration.ofSeconds(redisTtlSeconds));

      // Store competitors in queue
      for (CompetitorRefreshItem competitor : competitors) {
        String competitorJson = objectMapper.writeValueAsString(competitor);
        redisTemplate.opsForList().rightPush(queueKey, competitorJson);
      }
      redisTemplate.expire(queueKey, Duration.ofSeconds(redisTtlSeconds));

      logger.debug("Stored session {} data in Redis", sessionId);

    } catch (Exception e) {
      logger.error("Failed to store session {} in Redis: {}", sessionId, e.getMessage());
      throw new RuntimeException("Failed to store session in Redis", e);
    }
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

    // Process competitors in batches with rate limiting
    for (int i = 0; i < competitors.size(); i += batchSize) {
      int endIndex = Math.min(i + batchSize, competitors.size());
      List<CompetitorRefreshItem> batch = competitors.subList(i, endIndex);

      processBatch(sessionId, domain, batch, rateLimiter);
    }

    // Mark domain as completed
    markDomainCompleted(sessionId, domain);
  }

  /** Process a batch of competitors */
  private void processBatch(
      String sessionId, String domain, List<CompetitorRefreshItem> batch, RateLimiter rateLimiter) {

    for (CompetitorRefreshItem competitor : batch) {
      try {
        // Apply rate limiting
        rateLimiter.acquirePermit();

        // Check if URL was recently scraped (Redis-based cache)
        if (wasRecentlyScraped(competitor.url)) {
          logger.debug("Skipping recently scraped URL: {}", competitor.url);
          incrementProgress(sessionId, "skipped");
          continue;
        }

        // Shared cache reuse: if we recently scraped this canonical URL, try to reuse
        String urlKey = normalizeUrlToKey(competitor.url);
        PriceScrapingService.PriceScrapingResult result;
        if (wasRecentlyScraped(competitor.url)) {
          result =
              priceScrapingService
                  .getCachedPriceResult(urlKey)
                  .orElseGet(() -> priceScrapingService.scrapePriceWithMultiTier(competitor.url));
        } else {
          result = priceScrapingService.scrapePriceWithMultiTier(competitor.url);
        }

        if (result.isSuccess()) {
          // Store price snapshot
          storePriceSnapshot(competitor, result);
          incrementProgress(sessionId, "completed");
          // Publish shared cache so other shops with the same URL can reuse
          priceScrapingService.cachePriceResult(urlKey, result, Duration.ofMinutes(30));
          markAsRecentlyScraped(competitor.url);
        } else {
          logger.warn(
              "Failed to scrape price for {}: {}", competitor.url, result.getFailureReason());
          incrementProgress(sessionId, "failed");
        }

      } catch (Exception e) {
        logger.error("Error processing competitor {}: {}", competitor.id, e.getMessage());
        incrementProgress(sessionId, "failed");
      }
    }
  }

  /** Increment progress counter in Redis */
  private void incrementProgress(String sessionId, String counter) {
    try {
      String progressKey = redisKeyPrefix + ":progress:" + sessionId;
      String lastUpdatedKey = "lastUpdated";

      redisTemplate.opsForHash().increment(progressKey, counter, 1);
      redisTemplate.opsForHash().put(progressKey, lastUpdatedKey, LocalDateTime.now().toString());

    } catch (Exception e) {
      logger.error("Failed to increment progress for session {}: {}", sessionId, e.getMessage());
    }
  }

  /** Mark domain as completed in Redis */
  private void markDomainCompleted(String sessionId, String domain) {
    try {
      String sessionKey = redisKeyPrefix + ":session:" + sessionId;
      String completedDomainsKey = "completedDomains";

      redisTemplate.opsForHash().put(sessionKey, completedDomainsKey + ":" + domain, "true");

    } catch (Exception e) {
      logger.error(
          "Failed to mark domain {} as completed for session {}: {}",
          domain,
          sessionId,
          e.getMessage());
    }
  }

  /** Get progress from Redis */
  public RefreshProgress getProgress(String sessionId) {
    if (!redisEnabled) {
      logger.warn("Redis is disabled, cannot get progress for session {}", sessionId);
      return null;
    }

    try {
      String progressKey = redisKeyPrefix + ":progress:" + sessionId;
      String sessionKey = redisKeyPrefix + ":session:" + sessionId;

      // Get progress data from Redis
      Map<Object, Object> progressData = redisTemplate.opsForHash().entries(progressKey);
      Map<Object, Object> sessionData = redisTemplate.opsForHash().entries(sessionKey);

      if (progressData.isEmpty()) {
        logger.warn("No progress data found for session {}", sessionId);
        return null;
      }

      // Parse progress data
      int completed = Integer.parseInt(progressData.get("completed").toString());
      int failed = Integer.parseInt(progressData.get("failed").toString());
      int skipped = Integer.parseInt(progressData.get("skipped").toString());
      int total = Integer.parseInt(progressData.get("total").toString());
      Long shopId = Long.parseLong(sessionData.get("shopId").toString());

      // Create progress object
      RefreshProgress progress = new RefreshProgress(sessionId, shopId, total);
      progress.completed.set(completed);
      progress.failed.set(failed);
      progress.skipped.set(skipped);

      return progress;

    } catch (Exception e) {
      logger.error("Failed to get progress for session {}: {}", sessionId, e.getMessage());
      return null;
    }
  }

  /** Check if URL was recently scraped using Redis cache */
  private boolean wasRecentlyScraped(String url) {
    try {
      String cacheKey = redisKeyPrefix + ":cache:" + normalizeUrlToKey(url);
      return Boolean.TRUE.equals(redisTemplate.hasKey(cacheKey));
    } catch (Exception e) {
      logger.debug("Failed to check cache for URL {}: {}", url, e.getMessage());
      return false;
    }
  }

  /** Mark URL as recently scraped in Redis cache */
  private void markAsRecentlyScraped(String url) {
    try {
      String cacheKey = redisKeyPrefix + ":cache:" + normalizeUrlToKey(url);
      redisTemplate.opsForValue().set(cacheKey, "true", Duration.ofMinutes(30));
    } catch (Exception e) {
      logger.debug("Failed to mark URL as recently scraped: {}", e.getMessage());
    }
  }

  /** Normalize a competitor URL to a canonical cache key (stable across shops) */
  private String normalizeUrlToKey(String rawUrl) {
    try {
      java.net.URI uri = new java.net.URI(rawUrl);
      String host = (uri.getHost() != null) ? uri.getHost().toLowerCase() : "";
      String path = (uri.getPath() != null) ? uri.getPath() : "";
      // Drop tracking params that shouldn't affect price page identity
      java.util.Set<String> drop =
          java.util.Set.of(
              "utm_source",
              "utm_medium",
              "utm_campaign",
              "utm_term",
              "utm_content",
              "tag",
              "affid",
              "aff",
              "ascsubtag",
              "_encoding",
              "ref",
              "ref_",
              "pf_rd_p",
              "pf_rd_r",
              "qid",
              "sr",
              "srsltid");
      String query = uri.getQuery();
      String keptQuery = null;
      if (query != null && !query.isEmpty()) {
        String[] parts = query.split("&");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
          int eq = part.indexOf('=');
          String key = eq >= 0 ? part.substring(0, eq) : part;
          if (!drop.contains(key)) {
            if (sb.length() > 0) sb.append('&');
            sb.append(part);
          }
        }
        keptQuery = sb.length() > 0 ? sb.toString() : null;
      }
      String canonical = host + path + (keptQuery != null ? ("?" + keptQuery) : "");
      return Integer.toHexString(canonical.hashCode());
    } catch (Exception e) {
      // Fallback to simple hash on failure
      return Integer.toHexString(String.valueOf(rawUrl).hashCode());
    }
  }

  /** Start in-memory fallback processing */
  private RefreshSession startInMemoryRefresh(
      Long shopId, List<CompetitorRefreshItem> competitors) {
    String sessionId = "fallback_" + shopId + "_" + System.currentTimeMillis();
    logger.info("Starting in-memory fallback refresh for session {}", sessionId);

    // Create progress tracker in memory
    RefreshProgress progress = new RefreshProgress(sessionId, shopId, competitors.size());

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

  /** Start fallback refresh with reduced concurrency */
  private RefreshSession startFallbackRefresh(
      String sessionId, Long shopId, List<CompetitorRefreshItem> competitors) {
    logger.info("Starting fallback refresh for session {} with reduced concurrency", sessionId);

    // Create progress tracker
    RefreshProgress progress = new RefreshProgress(sessionId, shopId, competitors.size());

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

  /** Check if Redis is available */
  private boolean isRedisAvailable() {
    try {
      redisTemplate.opsForValue().set("health_check", "ok", Duration.ofSeconds(5));
      String result = (String) redisTemplate.opsForValue().get("health_check");
      return "ok".equals(result);
    } catch (Exception e) {
      logger.warn("Redis health check failed: {}", e.getMessage());
      return false;
    }
  }

  /** Group competitors by domain */
  private Map<String, List<CompetitorRefreshItem>> groupByDomain(
      List<CompetitorRefreshItem> competitors) {
    Map<String, List<CompetitorRefreshItem>> grouped = new HashMap<>();

    for (CompetitorRefreshItem competitor : competitors) {
      String domain = extractDomain(competitor.url);
      grouped.computeIfAbsent(domain, k -> new ArrayList<>()).add(competitor);
    }

    return grouped;
  }

  /** Extract domain from URL */
  private String extractDomain(String url) {
    try {
      String domain = url.toLowerCase();
      if (domain.contains("amazon.com")) return "amazon.com";
      if (domain.contains("shopify.com")) return "shopify.com";
      if (domain.contains("etsy.com")) return "etsy.com";
      if (domain.contains("walmart.com")) return "walmart.com";
      if (domain.contains("ebay.com")) return "ebay.com";
      return "default";
    } catch (Exception e) {
      return "default";
    }
  }

  /** Get or create rate limiter for domain */
  private RateLimiter getDomainRateLimiter(String domain) {
    return domainRateLimiters.computeIfAbsent(
        domain,
        k -> {
          int requestsPerMinute = DOMAIN_RATE_LIMITS.getOrDefault(domain, 15);
          return new RateLimiter(requestsPerMinute);
        });
  }

  /** Store price snapshot in database */
  private void storePriceSnapshot(
      CompetitorRefreshItem competitor, PriceScrapingService.PriceScrapingResult result) {
    try {
      // Store comprehensive price snapshot data
      jdbcTemplate.update(
          """
          INSERT INTO price_snapshots (
              competitor_url_id,
              price,
              in_stock,
              checked_at,
              platform,
              scraper_source,
              response_time_ms,
              scraper_version,
              currency
          ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?)
          """,
          competitor.id,
          result.getPrice(),
          result.isInStock(),
          result.getPlatform(),
          result.getScraperSource(),
          result.getResponseTime(),
          "v2.0-unified",
          "USD");

      // Update competitor status with comprehensive tracking
      jdbcTemplate.update(
          """
          UPDATE competitor_urls
          SET status = 'active',
              error_count = 0,
              last_successful_check = NOW(),
              response_time_ms = ?,
              scraper_version = ?
          WHERE id = ?
          """,
          result.getResponseTime(),
          "v2.0-unified",
          competitor.id);

      logger.debug(
          "Stored comprehensive price snapshot for competitor {}: ${} via {} ({}ms)",
          competitor.id,
          result.getPrice(),
          result.getScraperSource(),
          result.getResponseTime());

    } catch (Exception e) {
      logger.error(
          "Failed to store price snapshot for competitor {}: {}", competitor.id, e.getMessage());
    }
  }

  /** Schedule progress updates */
  private void scheduleProgressUpdates(String sessionId) {
    progressExecutor.scheduleAtFixedRate(
        () -> {
          try {
            RefreshProgress progress = getProgress(sessionId);
            if (progress != null) {
              broadcastProgressUpdate(progress);
            }
          } catch (Exception e) {
            logger.error("Error in progress update for session {}: {}", sessionId, e.getMessage());
          }
        },
        progressUpdateIntervalSeconds,
        progressUpdateIntervalSeconds,
        TimeUnit.SECONDS);
  }

  /** Broadcast progress update */
  private void broadcastProgressUpdate(RefreshProgress progress) {
    logger.debug(
        "Progress update for session {}: {}/{} completed, {} failed, {} skipped",
        progress.sessionId,
        progress.completed.get(),
        progress.total,
        progress.failed.get(),
        progress.skipped.get());
  }

  /** Rate limiter implementation */
  private static class RateLimiter {
    private final long intervalMs;
    private long lastRequestTime = 0;

    public RateLimiter(int requestsPerMinute) {
      this.intervalMs = 60000L / requestsPerMinute;
    }

    public synchronized void acquirePermit() {
      long now = System.currentTimeMillis();
      long timeSinceLastRequest = now - lastRequestTime;

      if (timeSinceLastRequest < intervalMs) {
        try {
          Thread.sleep(intervalMs - timeSinceLastRequest);
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
      if (total == 0) return 0;
      return (completed.get() + failed.get() + skipped.get()) * 100 / total;
    }

    public boolean isCompleted() {
      return (completed.get() + failed.get() + skipped.get()) >= total;
    }

    public String getStatus() {
      if (isCompleted()) return "COMPLETED";
      return "IN_PROGRESS";
    }

    public String getEstimatedTimeRemaining() {
      if (completed.get() == 0) return "Calculating...";

      long elapsedMs =
          System.currentTimeMillis() - startTime.toInstant(java.time.ZoneOffset.UTC).toEpochMilli();
      double avgTimePerItem = (double) elapsedMs / completed.get();
      int remainingItems = total - completed.get() - failed.get() - skipped.get();
      long estimatedMs = (long) (avgTimePerItem * remainingItems);

      if (estimatedMs < 60000) {
        return estimatedMs / 1000 + " seconds";
      } else if (estimatedMs < 3600000) {
        return estimatedMs / 60000 + " minutes";
      } else {
        return estimatedMs / 3600000 + " hours";
      }
    }
  }

  /** Data classes */
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
