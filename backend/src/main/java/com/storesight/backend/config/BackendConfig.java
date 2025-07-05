package com.storesight.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Backend configuration for StoreSignt application
 *
 * <p>Features: - Async processing configuration for session management - Thread pool configuration
 * for background tasks
 */
@Configuration
@EnableAsync
public class BackendConfig {

  @Value("${backend.url:http://localhost:8080}")
  private String backendUrl;

  @Value("${server.port:8080}")
  private String serverPort;

  @Value("${server.servlet.context-path:}")
  private String contextPath;

  /**
   * Task executor for asynchronous session management operations This allows session updates to run
   * in background threads without blocking main requests
   */
  @Bean(name = "sessionTaskExecutor")
  public TaskExecutor sessionTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);
    executor.setMaxPoolSize(4);
    executor.setQueueCapacity(100);
    executor.setThreadNamePrefix("session-async-");
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.setAwaitTerminationSeconds(30);
    executor.initialize();
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
