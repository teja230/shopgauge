package com.storesight.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Backend configuration for StoreSignt application
 *
 * <p>This configuration class provides beans and settings for the backend services including
 * database configuration, caching, and async task execution.
 */
@Configuration
@EnableScheduling
@EnableAsync
public class BackendConfig {

  private static final Logger logger = LoggerFactory.getLogger(BackendConfig.class);

  @Value("${backend.url:http://localhost:8080}")
  private String backendUrl;

  @Value("${server.port:8080}")
  private String serverPort;

  @Value("${server.servlet.context-path:}")
  private String contextPath;

  /**
   * Configure async executor for session management tasks This prevents transaction commit issues
   * with async operations
   */
  @Bean(name = "sessionTaskExecutor")
  public TaskExecutor sessionTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);
    executor.setMaxPoolSize(5);
    executor.setQueueCapacity(25);
    executor.setThreadNamePrefix("session-async-");
    executor.initialize();
    logger.info("Configured async session task executor with 2-5 threads");
    return executor;
  }

  /** Task executor for general background tasks */
  @Bean(name = "backgroundTaskExecutor")
  public TaskExecutor backgroundTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(1);
    executor.setMaxPoolSize(2);
    executor.setQueueCapacity(50);
    executor.setThreadNamePrefix("background-");
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.setAwaitTerminationSeconds(30);
    executor.initialize();
    return executor;
  }

  public String getBackendUrl() {
    return backendUrl;
  }

  public String getServerPort() {
    return serverPort;
  }

  public String getContextPath() {
    return contextPath;
  }

  public String buildBackendUrl(String path) {
    if (path.startsWith("/")) {
      return backendUrl + path;
    }
    return backendUrl + "/" + path;
  }

  public String buildAuthUrl(String shop) {
    return buildBackendUrl("/api/auth/shopify/login?shop=" + shop);
  }
}
