package com.storesight.backend.config;

import com.storesight.backend.util.CorrelationIdUtil;
import java.lang.reflect.Method;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Configuration for async exception handling
 *
 * <p>This configuration provides proper exception handling for async operations and ensures
 * correlation IDs are propagated to async threads.
 */
@Configuration
@EnableAsync
public class AsyncExceptionHandler implements AsyncConfigurer {

  private static final Logger logger = LoggerFactory.getLogger(AsyncExceptionHandler.class);

  @Override
  public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
    return new CustomAsyncUncaughtExceptionHandler();
  }

  @Override
  public ThreadPoolTaskExecutor getAsyncExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(5);
    executor.setMaxPoolSize(20);
    executor.setQueueCapacity(100);
    executor.setThreadNamePrefix("async-");
    executor.setTaskDecorator(new CorrelationIdTaskDecorator());
    executor.initialize();
    return executor;
  }

  /** Custom async exception handler */
  private static class CustomAsyncUncaughtExceptionHandler
      implements AsyncUncaughtExceptionHandler {

    @Override
    public void handleUncaughtException(Throwable ex, Method method, Object... params) {
      String correlationId = CorrelationIdUtil.getCorrelationId();

      logger.error(
          "Async method execution failed [{}]: {}.{}() with parameters: {}",
          correlationId != null ? correlationId : "no-correlation-id",
          method.getDeclaringClass().getSimpleName(),
          method.getName(),
          java.util.Arrays.toString(params),
          ex);

      // Additional error handling logic can be added here
      // For example, sending alerts, updating metrics, etc.
      handleAsyncException(ex, method, params, correlationId);
    }

    private void handleAsyncException(
        Throwable ex, Method method, Object[] params, String correlationId) {
      try {
        // Log structured error information
        logger.error(
            "Async exception details [{}]: "
                + "class={}, method={}, exception={}, message={}, params={}",
            correlationId,
            method.getDeclaringClass().getName(),
            method.getName(),
            ex.getClass().getSimpleName(),
            ex.getMessage(),
            java.util.Arrays.toString(params));

        // Handle specific exception types
        if (ex instanceof org.springframework.dao.DataAccessException) {
          logger.error(
              "Database error in async operation [{}]: {}", correlationId, ex.getMessage());
          // Could trigger database health check or circuit breaker
        } else if (ex instanceof org.springframework.data.redis.RedisConnectionFailureException) {
          logger.error("Redis error in async operation [{}]: {}", correlationId, ex.getMessage());
          // Could trigger Redis health check or circuit breaker
        } else if (ex instanceof java.util.concurrent.TimeoutException) {
          logger.error("Timeout in async operation [{}]: {}", correlationId, ex.getMessage());
          // Could trigger timeout monitoring or alerting
        } else if (ex instanceof SecurityException) {
          logger.error(
              "Security error in async operation [{}]: {}", correlationId, ex.getMessage());
          // Could trigger security audit logging
        }

      } catch (Exception handlingException) {
        logger.error(
            "Error while handling async exception [{}]: {}",
            correlationId,
            handlingException.getMessage(),
            handlingException);
      }
    }
  }

  /** Task decorator to propagate correlation ID to async threads */
  private static class CorrelationIdTaskDecorator
      implements org.springframework.core.task.TaskDecorator {

    @Override
    public Runnable decorate(Runnable runnable) {
      String correlationId = CorrelationIdUtil.getCorrelationId();

      return () -> {
        try {
          if (correlationId != null) {
            CorrelationIdUtil.setCorrelationId(correlationId);
          }
          runnable.run();
        } finally {
          CorrelationIdUtil.clearCorrelationId();
        }
      };
    }
  }

  /**
   * Utility method to execute async operations with proper exception handling
   *
   * @param operation The async operation to execute
   * @param operationName Name of the operation for logging
   * @return CompletableFuture with proper exception handling
   */
  public static <T> CompletableFuture<T> executeAsync(
      java.util.function.Supplier<T> operation, String operationName) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    return CompletableFuture.supplyAsync(
            () -> {
              try {
                CorrelationIdUtil.setCorrelationId(correlationId);
                logger.debug("Starting async operation [{}]: {}", correlationId, operationName);

                T result = operation.get();

                logger.debug("Completed async operation [{}]: {}", correlationId, operationName);
                return result;

              } catch (Exception e) {
                logger.error(
                    "Async operation failed [{}]: {} - {}",
                    correlationId,
                    operationName,
                    e.getMessage(),
                    e);
                throw new RuntimeException("Async operation failed: " + operationName, e);
              } finally {
                CorrelationIdUtil.clearCorrelationId();
              }
            })
        .exceptionally(
            throwable -> {
              logger.error(
                  "Async operation exception [{}]: {} - {}",
                  correlationId,
                  operationName,
                  throwable.getMessage(),
                  throwable);
              return null;
            });
  }

  /**
   * Utility method to execute async void operations with proper exception handling
   *
   * @param operation The async operation to execute
   * @param operationName Name of the operation for logging
   * @return CompletableFuture<Void> with proper exception handling
   */
  public static CompletableFuture<Void> executeAsyncVoid(Runnable operation, String operationName) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    return CompletableFuture.runAsync(
            () -> {
              try {
                CorrelationIdUtil.setCorrelationId(correlationId);
                logger.debug(
                    "Starting async void operation [{}]: {}", correlationId, operationName);

                operation.run();

                logger.debug(
                    "Completed async void operation [{}]: {}", correlationId, operationName);

              } catch (Exception e) {
                logger.error(
                    "Async void operation failed [{}]: {} - {}",
                    correlationId,
                    operationName,
                    e.getMessage(),
                    e);
                throw new RuntimeException("Async void operation failed: " + operationName, e);
              } finally {
                CorrelationIdUtil.clearCorrelationId();
              }
            })
        .exceptionally(
            throwable -> {
              logger.error(
                  "Async void operation exception [{}]: {} - {}",
                  correlationId,
                  operationName,
                  throwable.getMessage(),
                  throwable);
              return null;
            });
  }
}
