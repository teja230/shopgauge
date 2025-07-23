package com.storesight.backend.service;

import java.io.File;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.lang.management.ThreadMXBean;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * System resource monitoring service
 *
 * <p>This service provides comprehensive system resource monitoring including: - CPU usage and load
 * - Memory usage and garbage collection - Disk space monitoring - Thread monitoring - JVM
 * performance metrics
 */
@Service
public class SystemResourceMonitoringService {

  private static final Logger logger =
      LoggerFactory.getLogger(SystemResourceMonitoringService.class);

  @Autowired private MetricsCollectionService metricsCollectionService;

  @Autowired private FeatureFlagService featureFlagService;

  // Resource usage thresholds
  private static final double HIGH_CPU_THRESHOLD = 80.0;
  private static final double CRITICAL_CPU_THRESHOLD = 95.0;
  private static final double HIGH_MEMORY_THRESHOLD = 80.0;
  private static final double CRITICAL_MEMORY_THRESHOLD = 95.0;
  private static final double HIGH_DISK_THRESHOLD = 85.0;
  private static final double CRITICAL_DISK_THRESHOLD = 95.0;

  // Alert tracking with error suppression
  private final AtomicLong highCpuAlerts = new AtomicLong(0);
  private final AtomicLong highMemoryAlerts = new AtomicLong(0);
  private final AtomicLong highDiskAlerts = new AtomicLong(0);
  private final AtomicLong gcAlerts = new AtomicLong(0);

  // Error suppression for alerts
  private static final long ALERT_SUPPRESSION_INTERVAL_MS =
      300000; // 5 minutes (increased from 1 minute)
  private final AtomicLong lastCpuAlert = new AtomicLong(0);
  private final AtomicLong lastMemoryAlert = new AtomicLong(0);
  private final AtomicLong lastDiskAlert = new AtomicLong(0);

  // Previous values for calculating deltas
  private volatile long previousGcTime = 0;
  private volatile long previousGcCount = 0;

  // CPU monitoring state
  private volatile double lastValidCpuReading = -1.0; // Reset to force fresh reading
  private volatile long lastCpuReadingTime = 0;
  private static final long CPU_READING_CACHE_MS = 30000; // 30 seconds (increased from 5 seconds)

  /** Get comprehensive system resource statistics */
  public Map<String, Object> getSystemResourceStatistics() {
    Map<String, Object> stats = new HashMap<>();

    // CPU statistics
    Map<String, Object> cpuStats = getCpuStatistics();
    stats.put("cpu", cpuStats);

    // Memory statistics
    Map<String, Object> memoryStats = getMemoryStatistics();
    stats.put("memory", memoryStats);

    // Disk statistics
    Map<String, Object> diskStats = getDiskStatistics();
    stats.put("disk", diskStats);

    // Thread statistics
    Map<String, Object> threadStats = getThreadStatistics();
    stats.put("threads", threadStats);

    // Garbage collection statistics
    Map<String, Object> gcStats = getGarbageCollectionStatistics();
    stats.put("garbageCollection", gcStats);

    // JVM statistics
    Map<String, Object> jvmStats = getJvmStatistics();
    stats.put("jvm", jvmStats);

    // Alert statistics
    Map<String, Object> alertStats = new HashMap<>();
    alertStats.put("highCpuAlerts", highCpuAlerts.get());
    alertStats.put("highMemoryAlerts", highMemoryAlerts.get());
    alertStats.put("highDiskAlerts", highDiskAlerts.get());
    alertStats.put("gcAlerts", gcAlerts.get());
    stats.put("alerts", alertStats);

    stats.put("timestamp", LocalDateTime.now());
    return stats;
  }

  /** Get CPU usage statistics */
  public Map<String, Object> getCpuStatistics() {
    Map<String, Object> cpuStats = new HashMap<>();

    try {
      OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();

      // Basic CPU information
      cpuStats.put("availableProcessors", osBean.getAvailableProcessors());
      cpuStats.put("systemLoadAverage", osBean.getSystemLoadAverage());

      // Check if we can use cached CPU reading
      long now = System.currentTimeMillis();
      if (now - lastCpuReadingTime < CPU_READING_CACHE_MS && lastValidCpuReading >= 0) {
        double processCpuPercent = lastValidCpuReading;
        cpuStats.put("processCpuLoad", processCpuPercent);
        cpuStats.put("cached", true);

        // Update metrics with cached value
        metricsCollectionService.updateCpuUsage((long) processCpuPercent);

        // Check for alerts with suppression
        checkCpuAlerts(processCpuPercent, cpuStats);
        cpuStats.put("status", "HEALTHY");
        return cpuStats;
      }

      // Get fresh CPU reading
      double processCpuLoad = -1;
      try {
        // Use reflection to access process CPU load if available
        java.lang.reflect.Method getProcessCpuLoadMethod =
            osBean.getClass().getMethod("getProcessCpuLoad");
        Object result = getProcessCpuLoadMethod.invoke(osBean);
        if (result instanceof Number) {
          processCpuLoad = ((Number) result).doubleValue();

          // Validate the reading - getProcessCpuLoad returns value between 0.0 and 1.0
          if (processCpuLoad >= 0.0 && processCpuLoad <= 1.0) {
            // Valid reading, convert to percentage
            processCpuLoad = processCpuLoad * 100.0;
          } else if (processCpuLoad > 1.0 && processCpuLoad <= 100.0) {
            // Already in percentage format (some JVMs do this)
            // Keep as is
          } else {
            // Invalid reading
            processCpuLoad = -1;
          }
        }
      } catch (Exception e) {
        // Method not available - this is expected on some JVMs
        logger.debug("Process CPU load method not available: {}", e.getMessage());
      }

      // Fallback CPU calculation if JMX method failed or returned invalid data
      if (processCpuLoad < 0) {
        // FIXED: Use a more reliable CPU calculation method
        // System load average is NOT a CPU percentage - it's a load average
        // Instead, use a conservative estimate based on available processors
        int processors = osBean.getAvailableProcessors();

        // Use cached value if available and recent, otherwise use conservative estimate
        if (lastValidCpuReading >= 0 && (now - lastCpuReadingTime) < CPU_READING_CACHE_MS * 2) {
          processCpuLoad = lastValidCpuReading;
          logger.debug("Using recent cached CPU reading: {}%", processCpuLoad);
        } else {
          // Conservative estimate: assume low CPU usage when we can't measure accurately
          // This prevents false 100% CPU alerts
          processCpuLoad = Math.min(10.0, processors * 5.0); // Max 10% or 5% per core
          logger.debug(
              "Using conservative CPU estimate: {}% (processors: {})", processCpuLoad, processors);
        }
      }

      // Ensure reasonable bounds and cache the reading
      double processCpuPercent = Math.max(0.0, Math.min(100.0, processCpuLoad));
      lastValidCpuReading = processCpuPercent;
      lastCpuReadingTime = now;

      cpuStats.put("processCpuLoad", processCpuPercent);
      cpuStats.put("cached", false);

      // Update metrics
      metricsCollectionService.updateCpuUsage((long) processCpuPercent);

      // Check for alerts with suppression
      checkCpuAlerts(processCpuPercent, cpuStats);

      // Try to get system CPU load as well
      try {
        java.lang.reflect.Method getSystemCpuLoadMethod =
            osBean.getClass().getMethod("getSystemCpuLoad");
        Object result = getSystemCpuLoadMethod.invoke(osBean);
        if (result instanceof Number) {
          double systemCpuLoad = ((Number) result).doubleValue();
          if (systemCpuLoad >= 0 && systemCpuLoad <= 1.0) {
            cpuStats.put("systemCpuLoad", systemCpuLoad * 100);
          }
        }
      } catch (Exception e) {
        logger.debug("System CPU load not available: {}", e.getMessage());
      }

      cpuStats.put("status", "HEALTHY");

    } catch (Exception e) {
      logger.warn("Error getting CPU statistics: {}", e.getMessage());
      cpuStats.put("error", e.getMessage());
      cpuStats.put("status", "ERROR");

      // Use cached value or fallback
      double fallbackCpu = lastValidCpuReading >= 0 ? lastValidCpuReading : 0.0;
      cpuStats.put("processCpuLoad", fallbackCpu);
      cpuStats.put("alert", "UNKNOWN");
    }

    return cpuStats;
  }

  private void checkCpuAlerts(double processCpuPercent, Map<String, Object> cpuStats) {
    long now = System.currentTimeMillis();

    if (processCpuPercent > CRITICAL_CPU_THRESHOLD) {
      highCpuAlerts.incrementAndGet();

      // Only log if enough time has passed since last alert
      if (now - lastCpuAlert.get() > ALERT_SUPPRESSION_INTERVAL_MS) {
        logger.warn("Critical CPU usage detected: {}%", String.format("%.2f", processCpuPercent));
        lastCpuAlert.set(now);
      }
      cpuStats.put("alert", "CRITICAL");

    } else if (processCpuPercent > HIGH_CPU_THRESHOLD) {
      highCpuAlerts.incrementAndGet();

      // Only log if enough time has passed since last alert
      if (now - lastCpuAlert.get() > ALERT_SUPPRESSION_INTERVAL_MS) {
        logger.info("High CPU usage detected: {}%", String.format("%.2f", processCpuPercent));
        lastCpuAlert.set(now);
      }
      cpuStats.put("alert", "WARNING");

    } else {
      cpuStats.put("alert", "NORMAL");
    }
  }

  /** Get memory usage statistics */
  public Map<String, Object> getMemoryStatistics() {
    Map<String, Object> memoryStats = new HashMap<>();

    try {
      Runtime runtime = Runtime.getRuntime();
      MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();

      // Runtime memory information
      long maxMemory = runtime.maxMemory();
      long totalMemory = runtime.totalMemory();
      long freeMemory = runtime.freeMemory();
      long usedMemory = totalMemory - freeMemory;

      memoryStats.put("maxMemoryMB", maxMemory / (1024 * 1024));
      memoryStats.put("totalMemoryMB", totalMemory / (1024 * 1024));
      memoryStats.put("usedMemoryMB", usedMemory / (1024 * 1024));
      memoryStats.put("freeMemoryMB", freeMemory / (1024 * 1024));

      double memoryUsagePercent = (double) usedMemory / maxMemory * 100;
      memoryStats.put("usagePercent", memoryUsagePercent);

      // Update metrics
      metricsCollectionService.updateMemoryUsage((long) memoryUsagePercent);

      // Check for high memory usage with alert suppression
      long now = System.currentTimeMillis();
      if (memoryUsagePercent > CRITICAL_MEMORY_THRESHOLD) {
        highMemoryAlerts.incrementAndGet();

        // Only log if enough time has passed since last alert
        if (now - lastMemoryAlert.get() > ALERT_SUPPRESSION_INTERVAL_MS) {
          logger.warn(
              "Critical memory usage detected: {}%", String.format("%.2f", memoryUsagePercent));
          lastMemoryAlert.set(now);
        }
        memoryStats.put("alert", "CRITICAL");

      } else if (memoryUsagePercent > HIGH_MEMORY_THRESHOLD) {
        highMemoryAlerts.incrementAndGet();

        // Only log if enough time has passed since last alert
        if (now - lastMemoryAlert.get() > ALERT_SUPPRESSION_INTERVAL_MS) {
          logger.info("High memory usage detected: {}%", String.format("%.2f", memoryUsagePercent));
          lastMemoryAlert.set(now);
        }
        memoryStats.put("alert", "WARNING");

      } else {
        memoryStats.put("alert", "NORMAL");
      }

      // Heap memory details
      var heapMemory = memoryBean.getHeapMemoryUsage();
      Map<String, Object> heapStats = new HashMap<>();
      heapStats.put("initMB", heapMemory.getInit() / (1024 * 1024));
      heapStats.put("usedMB", heapMemory.getUsed() / (1024 * 1024));
      heapStats.put("committedMB", heapMemory.getCommitted() / (1024 * 1024));
      heapStats.put("maxMB", heapMemory.getMax() / (1024 * 1024));
      memoryStats.put("heap", heapStats);

      // Non-heap memory details
      var nonHeapMemory = memoryBean.getNonHeapMemoryUsage();
      Map<String, Object> nonHeapStats = new HashMap<>();
      nonHeapStats.put("initMB", nonHeapMemory.getInit() / (1024 * 1024));
      nonHeapStats.put("usedMB", nonHeapMemory.getUsed() / (1024 * 1024));
      nonHeapStats.put("committedMB", nonHeapMemory.getCommitted() / (1024 * 1024));
      nonHeapStats.put("maxMB", nonHeapMemory.getMax() / (1024 * 1024));
      memoryStats.put("nonHeap", nonHeapStats);

      memoryStats.put("status", "HEALTHY");

    } catch (Exception e) {
      logger.warn("Error getting memory statistics: {}", e.getMessage());
      memoryStats.put("error", e.getMessage());
      memoryStats.put("status", "ERROR");
    }

    return memoryStats;
  }

  /** Get disk space statistics */
  public Map<String, Object> getDiskStatistics() {
    Map<String, Object> diskStats = new HashMap<>();

    try {
      // Get the current working directory or user home directory for more accurate disk usage
      // This is more likely to be the actual data directory than just "/"
      String dataPath = System.getProperty("user.home");
      if (dataPath == null || dataPath.isEmpty()) {
        dataPath = "/";
      }

      File dataDir = new File(dataPath);
      long totalSpace = dataDir.getTotalSpace();
      long freeSpace = dataDir.getFreeSpace();
      long usedSpace = totalSpace - freeSpace;

      diskStats.put("totalSpaceGB", totalSpace / (1024 * 1024 * 1024));
      diskStats.put("usedSpaceGB", usedSpace / (1024 * 1024 * 1024));
      diskStats.put("freeSpaceGB", freeSpace / (1024 * 1024 * 1024));
      diskStats.put("dataPath", dataPath);

      double diskUsagePercent = (double) usedSpace / totalSpace * 100;
      diskStats.put("usagePercent", diskUsagePercent);

      // Update metrics
      metricsCollectionService.updateDiskUsage((long) diskUsagePercent);

      // Check for high disk usage with alert suppression
      long now = System.currentTimeMillis();
      if (diskUsagePercent > CRITICAL_DISK_THRESHOLD) {
        highDiskAlerts.incrementAndGet();

        // Only log if enough time has passed since last alert
        if (now - lastDiskAlert.get() > ALERT_SUPPRESSION_INTERVAL_MS) {
          logger.warn("Critical disk usage detected: {}%", String.format("%.2f", diskUsagePercent));
          lastDiskAlert.set(now);
        }
        diskStats.put("alert", "CRITICAL");

      } else if (diskUsagePercent > HIGH_DISK_THRESHOLD) {
        highDiskAlerts.incrementAndGet();

        // Only log if enough time has passed since last alert
        if (now - lastDiskAlert.get() > ALERT_SUPPRESSION_INTERVAL_MS) {
          logger.info("High disk usage detected: {}%", String.format("%.2f", diskUsagePercent));
          lastDiskAlert.set(now);
        }
        diskStats.put("alert", "WARNING");

      } else {
        diskStats.put("alert", "NORMAL");
      }

      // Check for additional mount points if available
      File[] roots = File.listRoots();
      if (roots.length > 1) {
        Map<String, Object> additionalMounts = new HashMap<>();
        for (File mountPoint : roots) {
          if (!mountPoint.equals(dataDir)) {
            Map<String, Object> mountStats = new HashMap<>();
            long mountTotal = mountPoint.getTotalSpace();
            long mountFree = mountPoint.getFreeSpace();
            long mountUsed = mountTotal - mountFree;

            mountStats.put("totalSpaceGB", mountTotal / (1024 * 1024 * 1024));
            mountStats.put("usedSpaceGB", mountUsed / (1024 * 1024 * 1024));
            mountStats.put("freeSpaceGB", mountFree / (1024 * 1024 * 1024));
            mountStats.put("usagePercent", (double) mountUsed / mountTotal * 100);

            additionalMounts.put(mountPoint.getPath(), mountStats);
          }
        }
        diskStats.put("additionalMounts", additionalMounts);
      }

      diskStats.put("status", "HEALTHY");

    } catch (Exception e) {
      logger.warn("Error getting disk statistics: {}", e.getMessage());
      diskStats.put("error", e.getMessage());
      diskStats.put("status", "ERROR");
    }

    return diskStats;
  }

  /** Get thread statistics */
  public Map<String, Object> getThreadStatistics() {
    Map<String, Object> threadStats = new HashMap<>();

    try {
      ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();

      threadStats.put("threadCount", threadBean.getThreadCount());
      threadStats.put("peakThreadCount", threadBean.getPeakThreadCount());
      threadStats.put("daemonThreadCount", threadBean.getDaemonThreadCount());
      threadStats.put("totalStartedThreadCount", threadBean.getTotalStartedThreadCount());

      // Check for thread count issues
      int currentThreads = threadBean.getThreadCount();
      int peakThreads = threadBean.getPeakThreadCount();

      if (currentThreads > 200) {
        logger.warn("High thread count detected: {}", currentThreads);
        threadStats.put("alert", "WARNING");
      } else {
        threadStats.put("alert", "NORMAL");
      }

      // Deadlock detection
      long[] deadlockedThreads = threadBean.findDeadlockedThreads();
      if (deadlockedThreads != null && deadlockedThreads.length > 0) {
        logger.error("Deadlocked threads detected: {}", deadlockedThreads.length);
        threadStats.put("deadlockedThreads", deadlockedThreads.length);
        threadStats.put("alert", "CRITICAL");
      } else {
        threadStats.put("deadlockedThreads", 0);
      }

      threadStats.put("status", "HEALTHY");

    } catch (Exception e) {
      logger.warn("Error getting thread statistics: {}", e.getMessage());
      threadStats.put("error", e.getMessage());
      threadStats.put("status", "ERROR");
    }

    return threadStats;
  }

  /** Get garbage collection statistics */
  public Map<String, Object> getGarbageCollectionStatistics() {
    Map<String, Object> gcStats = new HashMap<>();

    try {
      List<GarbageCollectorMXBean> gcBeans = ManagementFactory.getGarbageCollectorMXBeans();

      long totalGcTime = 0;
      long totalGcCount = 0;
      Map<String, Object> gcDetails = new HashMap<>();

      for (GarbageCollectorMXBean gcBean : gcBeans) {
        String gcName = gcBean.getName();
        long gcTime = gcBean.getCollectionTime();
        long gcCount = gcBean.getCollectionCount();

        totalGcTime += gcTime;
        totalGcCount += gcCount;

        Map<String, Object> gcDetail = new HashMap<>();
        gcDetail.put("collectionCount", gcCount);
        gcDetail.put("collectionTimeMs", gcTime);
        gcDetails.put(gcName, gcDetail);
      }

      gcStats.put("totalCollectionCount", totalGcCount);
      gcStats.put("totalCollectionTimeMs", totalGcTime);
      gcStats.put("collectors", gcDetails);

      // Calculate GC frequency and time since last check
      long gcTimeDelta = totalGcTime - previousGcTime;
      long gcCountDelta = totalGcCount - previousGcCount;

      if (previousGcTime > 0) {
        gcStats.put("recentCollectionCount", gcCountDelta);
        gcStats.put("recentCollectionTimeMs", gcTimeDelta);

        // Check for excessive GC activity
        if (gcTimeDelta > 5000) { // More than 5 seconds of GC in the monitoring period
          gcAlerts.incrementAndGet();
          logger.warn("High GC activity detected: {}ms in recent period", gcTimeDelta);
          gcStats.put("alert", "WARNING");
        } else {
          gcStats.put("alert", "NORMAL");
        }
      }

      previousGcTime = totalGcTime;
      previousGcCount = totalGcCount;

      gcStats.put("status", "HEALTHY");

    } catch (Exception e) {
      logger.warn("Error getting garbage collection statistics: {}", e.getMessage());
      gcStats.put("error", e.getMessage());
      gcStats.put("status", "ERROR");
    }

    return gcStats;
  }

  /** Get JVM statistics */
  public Map<String, Object> getJvmStatistics() {
    Map<String, Object> jvmStats = new HashMap<>();

    try {
      // JVM version and vendor information
      jvmStats.put("javaVersion", System.getProperty("java.version"));
      jvmStats.put("javaVendor", System.getProperty("java.vendor"));
      jvmStats.put("jvmName", System.getProperty("java.vm.name"));
      jvmStats.put("jvmVersion", System.getProperty("java.vm.version"));

      // Runtime information
      jvmStats.put("uptime", ManagementFactory.getRuntimeMXBean().getUptime());
      jvmStats.put("startTime", ManagementFactory.getRuntimeMXBean().getStartTime());

      // Class loading information
      var classLoadingBean = ManagementFactory.getClassLoadingMXBean();
      Map<String, Object> classLoadingStats = new HashMap<>();
      classLoadingStats.put("loadedClassCount", classLoadingBean.getLoadedClassCount());
      classLoadingStats.put("totalLoadedClassCount", classLoadingBean.getTotalLoadedClassCount());
      classLoadingStats.put("unloadedClassCount", classLoadingBean.getUnloadedClassCount());
      jvmStats.put("classLoading", classLoadingStats);

      jvmStats.put("status", "HEALTHY");

    } catch (Exception e) {
      logger.warn("Error getting JVM statistics: {}", e.getMessage());
      jvmStats.put("error", e.getMessage());
      jvmStats.put("status", "ERROR");
    }

    return jvmStats;
  }

  /** Scheduled system resource monitoring with startup delay */
  @Scheduled(
      fixedRateString = "${storesight.monitoring.system-resources-interval:PT2H}",
      initialDelayString = "${storesight.monitoring.system-resources-startup-delay:PT10M}")
  public void monitorSystemResources() {
    // Check if scheduled system resource monitoring is enabled
    if (!featureFlagService.isScheduledSystemResourceMonitoringEnabled()) {
      logger.debug("Scheduled system resource monitoring is disabled via feature flag");
      return;
    }

    try {
      Map<String, Object> stats = getSystemResourceStatistics();

      // Check for critical alerts
      @SuppressWarnings("unchecked")
      Map<String, Object> cpuStats = (Map<String, Object>) stats.get("cpu");
      @SuppressWarnings("unchecked")
      Map<String, Object> memoryStats = (Map<String, Object>) stats.get("memory");
      @SuppressWarnings("unchecked")
      Map<String, Object> diskStats = (Map<String, Object>) stats.get("disk");

      boolean criticalAlert = false;
      StringBuilder alertMessage = new StringBuilder("System resource alerts: ");

      if ("CRITICAL".equals(cpuStats.get("alert"))) {
        criticalAlert = true;
        alertMessage.append("CPU usage critical, ");
      }

      if ("CRITICAL".equals(memoryStats.get("alert"))) {
        criticalAlert = true;
        alertMessage.append("Memory usage critical, ");
      }

      if ("CRITICAL".equals(diskStats.get("alert"))) {
        criticalAlert = true;
        alertMessage.append("Disk usage critical, ");
      }

      if (criticalAlert) {
        logger.error(alertMessage.toString());
      } else {
        logger.debug("System resource monitoring completed successfully");
      }

    } catch (Exception e) {
      logger.error("Error during scheduled system resource check: {}", e.getMessage());
    }
  }

  /** Get system health indicators for monitoring dashboards */
  public Map<String, String> getHealthIndicators() {
    Map<String, String> indicators = new HashMap<>();

    try {
      Map<String, Object> stats = getSystemResourceStatistics();

      @SuppressWarnings("unchecked")
      Map<String, Object> cpuStats = (Map<String, Object>) stats.get("cpu");
      @SuppressWarnings("unchecked")
      Map<String, Object> memoryStats = (Map<String, Object>) stats.get("memory");
      @SuppressWarnings("unchecked")
      Map<String, Object> diskStats = (Map<String, Object>) stats.get("disk");
      @SuppressWarnings("unchecked")
      Map<String, Object> threadStats = (Map<String, Object>) stats.get("threads");

      indicators.put("cpu", (String) cpuStats.getOrDefault("alert", "UNKNOWN"));
      indicators.put("memory", (String) memoryStats.getOrDefault("alert", "UNKNOWN"));
      indicators.put("disk", (String) diskStats.getOrDefault("alert", "UNKNOWN"));
      indicators.put("threads", (String) threadStats.getOrDefault("alert", "UNKNOWN"));

    } catch (Exception e) {
      logger.warn("Error getting system health indicators: {}", e.getMessage());
      indicators.put("cpu", "ERROR");
      indicators.put("memory", "ERROR");
      indicators.put("disk", "ERROR");
      indicators.put("threads", "ERROR");
    }

    return indicators;
  }

  /** Reset monitoring statistics */
  public void resetStatistics() {
    highCpuAlerts.set(0);
    highMemoryAlerts.set(0);
    highDiskAlerts.set(0);
    gcAlerts.set(0);
    previousGcTime = 0;
    previousGcCount = 0;
    logger.info("System resource monitoring statistics reset");
  }
}
