package com.storesight.backend.service;

import com.storesight.backend.util.CorrelationIdUtil;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Enhanced async processing service with queue-based processing, configurable concurrency limits,
 * proper error handling, and retry logic for Market Intelligence operations.
 */
@Service
public class AsyncProcessingService {

  private static final Logger log = LoggerFactory.getLogger(AsyncProcessingService.class);

  // Configuration properties
  @Value("${async.processing.discovery.max-concurrent:3}")
  private int discoveryMaxConcurrent;

  @Value("${async.processing.scraping.max-concurrent:5}")
  private int scrapingMaxConcurrent;

  @Value("${async.processing.notification.max-concurrent:10}")
  private int notificationMaxConcurrent;

  @Value("${async.processing.queue.capacity:1000}")
  private int queueCapacity;

  @Value("${async.processing.retry.max-attempts:3}")
  private int maxRetryAttempts;

  @Value("${async.processing.retry.delay-seconds:5}")
  private int retryDelaySeconds;

  @Value("${async.processing.timeout.discovery-minutes:10}")
  private int discoveryTimeoutMinutes;

  @Value("${async.processing.timeout.scraping-minutes:5}")
  private int scrapingTimeoutMinutes;

  @Value("${async.processing.timeout.notification-seconds:30}")
  private int notificationTimeoutSeconds;

  // Thread pools for different operation types
  private ThreadPoolExecutor discoveryExecutor;
  private ThreadPoolExecutor scrapingExecutor;
  private ThreadPoolExecutor notificationExecutor;
  private ScheduledExecutorService retryExecutor;

  // Processing queues
  private BlockingQueue<AsyncTask> discoveryQueue;
  private BlockingQueue<AsyncTask> scrapingQueue;
  private BlockingQueue<AsyncTask> notificationQueue;

  // Metrics and monitoring
  private final AtomicLong totalTasksSubmitted = new AtomicLong(0);
  private final AtomicLong totalTasksCompleted = new AtomicLong(0);
  private final AtomicLong totalTasksFailed = new AtomicLong(0);
  private final AtomicInteger activeDiscoveryTasks = new AtomicInteger(0);
  private final AtomicInteger activeScrapingTasks = new AtomicInteger(0);
  private final AtomicInteger activeNotificationTasks = new AtomicInteger(0);

  // Task tracking
  private final Map<String, AsyncTaskStatus> taskStatuses = new ConcurrentHashMap<>();

  private final RedisTemplate<String, Object> redisTemplate;

  public AsyncProcessingService(RedisTemplate<String, Object> redisTemplate) {
    this.redisTemplate = redisTemplate;
  }

  @PostConstruct
  public void initialize() {
    log.info("Initializing AsyncProcessingService with configuration:");
    log.info("  Discovery max concurrent: {}", discoveryMaxConcurrent);
    log.info("  Scraping max concurrent: {}", scrapingMaxConcurrent);
    log.info("  Notification max concurrent: {}", notificationMaxConcurrent);
    log.info("  Queue capacity: {}", queueCapacity);
    log.info("  Max retry attempts: {}", maxRetryAttempts);

    // Initialize queues with reduced capacity for 2x512MB instances
    int adjustedCapacity = Math.min(queueCapacity, 100); // Cap at 100 for memory conservation
    discoveryQueue = new LinkedBlockingQueue<>(adjustedCapacity);
    scrapingQueue = new LinkedBlockingQueue<>(adjustedCapacity);
    notificationQueue = new LinkedBlockingQueue<>(adjustedCapacity);

    // Initialize thread pools with conservative settings
    discoveryExecutor =
        createThreadPoolExecutor("discovery", Math.min(discoveryMaxConcurrent, 1), discoveryQueue);
    scrapingExecutor = createThreadPoolExecutor("scraping", Math.min(scrapingMaxConcurrent, 2), scrapingQueue);
    notificationExecutor =
        createThreadPoolExecutor("notification", Math.min(notificationMaxConcurrent, 2), notificationQueue);

    // Initialize retry executor with single thread to prevent CPU saturation
    retryExecutor =
        new ScheduledThreadPoolExecutor(
            1, // Reduced from 2 to 1 thread
            r -> {
              Thread t = new Thread(r, "async-retry-" + System.currentTimeMillis());
              t.setDaemon(true);
              t.setPriority(Thread.MIN_PRIORITY); // Lower priority to prevent CPU starvation
              return t;
            });

    log.info("AsyncProcessingService initialized successfully with conservative settings for 2x512MB instances");
  }

  private ThreadPoolExecutor createThreadPoolExecutor(
      String name, int maxConcurrent, BlockingQueue<AsyncTask> queue) {
    ThreadPoolExecutor executor =
        new ThreadPoolExecutor(
            1, // core pool size
            maxConcurrent, // maximum pool size
            60L,
            TimeUnit.SECONDS, // keep alive time
            new LinkedBlockingQueue<>(), // work queue
            r -> {
              Thread t = new Thread(r, "async-" + name + "-" + System.currentTimeMillis());
              t.setDaemon(true);
              return t;
            });

    // Set rejection policy
    executor.setRejectedExecutionHandler(
        (r, e) -> {
          log.warn("Task rejected for {} executor - queue full or executor shutdown", name);
          throw new RejectedExecutionException("Task rejected for " + name + " executor");
        });

    return executor;
  }

  /** Submit a discovery task for async processing */
  public CompletableFuture<Void> submitDiscoveryTask(
      String taskId, String shopDomain, Long shopId, Runnable task) {
    return submitTask(
        TaskType.DISCOVERY,
        taskId,
        shopDomain,
        shopId,
        () -> {
          task.run();
          return null;
        });
  }

  /** Submit a scraping task for async processing */
  public CompletableFuture<Void> submitScrapingTask(
      String taskId, String shopDomain, Long shopId, Runnable task) {
    return submitTask(
        TaskType.SCRAPING,
        taskId,
        shopDomain,
        shopId,
        () -> {
          task.run();
          return null;
        });
  }

  /** Submit a notification task for async processing */
  public CompletableFuture<Void> submitNotificationTask(
      String taskId, String shopDomain, Long shopId, Runnable task) {
    return submitTask(
        TaskType.NOTIFICATION,
        taskId,
        shopDomain,
        shopId,
        () -> {
          task.run();
          return null;
        });
  }

  /** Submit a generic async task with return value */
  public <T> CompletableFuture<T> submitTask(
      TaskType type, String taskId, String shopDomain, Long shopId, Supplier<T> task) {
    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    AsyncTaskStatus status = new AsyncTaskStatus(taskId, type, shopDomain, shopId, correlationId);
    taskStatuses.put(taskId, status);

    totalTasksSubmitted.incrementAndGet();

    log.debug("Submitting {} task [{}] for shop {} ({})", type, taskId, shopDomain, correlationId);

    CompletableFuture<T> future = new CompletableFuture<>();

    AsyncTask asyncTask =
        new AsyncTask(taskId, type, shopDomain, shopId, correlationId, task, future, status);

    try {
      Executor executor = getExecutorForType(type);
      AtomicInteger activeCounter = getActiveCounterForType(type);

      executor.execute(() -> processTask(asyncTask, activeCounter));

      // Set timeout based on task type
      Duration timeout = getTimeoutForType(type);
      scheduleTimeout(future, taskId, timeout);

    } catch (RejectedExecutionException e) {
      log.error("Failed to submit {} task [{}]: {}", type, taskId, e.getMessage());
      status.markFailed("Task rejected: " + e.getMessage());
      taskStatuses.remove(taskId);
      totalTasksFailed.incrementAndGet();
      future.completeExceptionally(e);
    }

    return future;
  }

  private <T> void processTask(AsyncTask task, AtomicInteger activeCounter) {
    String originalCorrelationId = CorrelationIdUtil.getCorrelationId();

    try {
      CorrelationIdUtil.setCorrelationId(task.correlationId);
      activeCounter.incrementAndGet();

      task.status.markStarted();

      log.debug(
          "Processing {} task [{}] for shop {} [{}]",
          task.type,
          task.taskId,
          task.shopDomain,
          task.correlationId);

      // Execute the task with retry logic
      T result = executeWithRetry(task);

      task.status.markCompleted();
      ((CompletableFuture<T>) task.future).complete(result);
      totalTasksCompleted.incrementAndGet();

      log.debug(
          "Completed {} task [{}] for shop {} [{}]",
          task.type,
          task.taskId,
          task.shopDomain,
          task.correlationId);

    } catch (Exception e) {
      log.error(
          "Failed {} task [{}] for shop {} [{}]: {}",
          task.type,
          task.taskId,
          task.shopDomain,
          task.correlationId,
          e.getMessage(),
          e);

      task.status.markFailed(e.getMessage());
      task.future.completeExceptionally(e);
      totalTasksFailed.incrementAndGet();

    } finally {
      activeCounter.decrementAndGet();
      CorrelationIdUtil.setCorrelationId(originalCorrelationId);

      // Clean up task status after some time
      retryExecutor.schedule(() -> taskStatuses.remove(task.taskId), 5, TimeUnit.MINUTES);
    }
  }

  @SuppressWarnings("unchecked")
  private <T> T executeWithRetry(AsyncTask task) throws Exception {
    Exception lastException = null;

    for (int attempt = 1; attempt <= maxRetryAttempts; attempt++) {
      try {
        task.status.recordAttempt(attempt);
        return (T) task.taskSupplier.get();

      } catch (Exception e) {
        lastException = e;

        log.warn(
            "Attempt {}/{} failed for {} task [{}]: {}",
            attempt,
            maxRetryAttempts,
            task.type,
            task.taskId,
            e.getMessage());

        if (attempt < maxRetryAttempts) {
          // Wait before retry with exponential backoff
          long delayMs = retryDelaySeconds * 1000L * (long) Math.pow(2, attempt - 1);
          try {
            Thread.sleep(delayMs);
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Task interrupted during retry delay", ie);
          }
        }
      }
    }

    throw new RuntimeException(
        "Task failed after " + maxRetryAttempts + " attempts", lastException);
  }

  private Executor getExecutorForType(TaskType type) {
    return switch (type) {
      case DISCOVERY -> discoveryExecutor;
      case SCRAPING -> scrapingExecutor;
      case NOTIFICATION -> notificationExecutor;
    };
  }

  private AtomicInteger getActiveCounterForType(TaskType type) {
    return switch (type) {
      case DISCOVERY -> activeDiscoveryTasks;
      case SCRAPING -> activeScrapingTasks;
      case NOTIFICATION -> activeNotificationTasks;
    };
  }

  private Duration getTimeoutForType(TaskType type) {
    return switch (type) {
      case DISCOVERY -> Duration.ofMinutes(discoveryTimeoutMinutes);
      case SCRAPING -> Duration.ofMinutes(scrapingTimeoutMinutes);
      case NOTIFICATION -> Duration.ofSeconds(notificationTimeoutSeconds);
    };
  }

  private <T> void scheduleTimeout(CompletableFuture<T> future, String taskId, Duration timeout) {
    retryExecutor.schedule(
        () -> {
          if (!future.isDone()) {
            log.warn("Task [{}] timed out after {}", taskId, timeout);
            future.completeExceptionally(
                new java.util.concurrent.TimeoutException("Task timed out"));
          }
        },
        timeout.toMillis(),
        TimeUnit.MILLISECONDS);
  }

  /** Get processing statistics */
  public ProcessingStats getProcessingStats() {
    return new ProcessingStats(
        totalTasksSubmitted.get(),
        totalTasksCompleted.get(),
        totalTasksFailed.get(),
        activeDiscoveryTasks.get(),
        activeScrapingTasks.get(),
        activeNotificationTasks.get(),
        discoveryQueue.size(),
        scrapingQueue.size(),
        notificationQueue.size());
  }

  /** Get task status */
  public AsyncTaskStatus getTaskStatus(String taskId) {
    return taskStatuses.get(taskId);
  }

  /** Get all active task statuses */
  public Map<String, AsyncTaskStatus> getAllTaskStatuses() {
    return Map.copyOf(taskStatuses);
  }

  @PreDestroy
  public void shutdown() {
    log.info("Shutting down AsyncProcessingService");

    if (discoveryExecutor != null) {
      discoveryExecutor.shutdown();
    }
    if (scrapingExecutor != null) {
      scrapingExecutor.shutdown();
    }
    if (notificationExecutor != null) {
      notificationExecutor.shutdown();
    }
    if (retryExecutor != null) {
      retryExecutor.shutdown();
    }

    try {
      if (!discoveryExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
        discoveryExecutor.shutdownNow();
      }
      if (!scrapingExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
        scrapingExecutor.shutdownNow();
      }
      if (!notificationExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
        notificationExecutor.shutdownNow();
      }
      if (!retryExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
        retryExecutor.shutdownNow();
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      log.warn("Interrupted while waiting for executor shutdown");
    }

    log.info("AsyncProcessingService shutdown completed");
  }

  // Inner classes for task management
  public enum TaskType {
    DISCOVERY,
    SCRAPING,
    NOTIFICATION
  }

  private static class AsyncTask {
    final String taskId;
    final TaskType type;
    final String shopDomain;
    final Long shopId;
    final String correlationId;
    final Supplier<?> taskSupplier;
    final CompletableFuture<?> future;
    final AsyncTaskStatus status;

    AsyncTask(
        String taskId,
        TaskType type,
        String shopDomain,
        Long shopId,
        String correlationId,
        Supplier<?> taskSupplier,
        CompletableFuture<?> future,
        AsyncTaskStatus status) {
      this.taskId = taskId;
      this.type = type;
      this.shopDomain = shopDomain;
      this.shopId = shopId;
      this.correlationId = correlationId;
      this.taskSupplier = taskSupplier;
      this.future = future;
      this.status = status;
    }
  }

  public static class AsyncTaskStatus {
    private final String taskId;
    private final TaskType type;
    private final String shopDomain;
    private final Long shopId;
    private final String correlationId;
    private final LocalDateTime createdAt;

    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private String status = "PENDING";
    private String errorMessage;
    private int attempts = 0;

    public AsyncTaskStatus(
        String taskId, TaskType type, String shopDomain, Long shopId, String correlationId) {
      this.taskId = taskId;
      this.type = type;
      this.shopDomain = shopDomain;
      this.shopId = shopId;
      this.correlationId = correlationId;
      this.createdAt = LocalDateTime.now();
    }

    public void markStarted() {
      this.startedAt = LocalDateTime.now();
      this.status = "RUNNING";
    }

    public void markCompleted() {
      this.completedAt = LocalDateTime.now();
      this.status = "COMPLETED";
    }

    public void markFailed(String errorMessage) {
      this.completedAt = LocalDateTime.now();
      this.status = "FAILED";
      this.errorMessage = errorMessage;
    }

    public void recordAttempt(int attemptNumber) {
      this.attempts = attemptNumber;
    }

    // Getters
    public String getTaskId() {
      return taskId;
    }

    public TaskType getType() {
      return type;
    }

    public String getShopDomain() {
      return shopDomain;
    }

    public Long getShopId() {
      return shopId;
    }

    public String getCorrelationId() {
      return correlationId;
    }

    public LocalDateTime getCreatedAt() {
      return createdAt;
    }

    public LocalDateTime getStartedAt() {
      return startedAt;
    }

    public LocalDateTime getCompletedAt() {
      return completedAt;
    }

    public String getStatus() {
      return status;
    }

    public String getErrorMessage() {
      return errorMessage;
    }

    public int getAttempts() {
      return attempts;
    }
  }

  public static class ProcessingStats {
    private final long totalSubmitted;
    private final long totalCompleted;
    private final long totalFailed;
    private final int activeDiscovery;
    private final int activeScraping;
    private final int activeNotification;
    private final int queuedDiscovery;
    private final int queuedScraping;
    private final int queuedNotification;

    public ProcessingStats(
        long totalSubmitted,
        long totalCompleted,
        long totalFailed,
        int activeDiscovery,
        int activeScraping,
        int activeNotification,
        int queuedDiscovery,
        int queuedScraping,
        int queuedNotification) {
      this.totalSubmitted = totalSubmitted;
      this.totalCompleted = totalCompleted;
      this.totalFailed = totalFailed;
      this.activeDiscovery = activeDiscovery;
      this.activeScraping = activeScraping;
      this.activeNotification = activeNotification;
      this.queuedDiscovery = queuedDiscovery;
      this.queuedScraping = queuedScraping;
      this.queuedNotification = queuedNotification;
    }

    // Getters
    public long getTotalSubmitted() {
      return totalSubmitted;
    }

    public long getTotalCompleted() {
      return totalCompleted;
    }

    public long getTotalFailed() {
      return totalFailed;
    }

    public int getActiveDiscovery() {
      return activeDiscovery;
    }

    public int getActiveScraping() {
      return activeScraping;
    }

    public int getActiveNotification() {
      return activeNotification;
    }

    public int getQueuedDiscovery() {
      return queuedDiscovery;
    }

    public int getQueuedScraping() {
      return queuedScraping;
    }

    public int getQueuedNotification() {
      return queuedNotification;
    }

    public double getSuccessRate() {
      if (totalSubmitted == 0) return 0.0;
      return (double) totalCompleted / totalSubmitted * 100.0;
    }

    public double getFailureRate() {
      if (totalSubmitted == 0) return 0.0;
      return (double) totalFailed / totalSubmitted * 100.0;
    }
  }
}
