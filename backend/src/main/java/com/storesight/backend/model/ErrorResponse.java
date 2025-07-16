package com.storesight.backend.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Standardized error response format for all API endpoints
 *
 * <p>This class provides a consistent error response structure across the application with support
 * for correlation IDs, retry information, and detailed error context.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

  private ErrorDetails error;

  public ErrorResponse() {}

  public ErrorResponse(ErrorDetails error) {
    this.error = error;
  }

  public ErrorDetails getError() {
    return error;
  }

  public void setError(ErrorDetails error) {
    this.error = error;
  }

  /** Create a simple error response */
  public static ErrorResponse of(String code, String message) {
    return new ErrorResponse(new ErrorDetails(code, message));
  }

  /** Create an error response with details */
  public static ErrorResponse of(String code, String message, String details) {
    return new ErrorResponse(new ErrorDetails(code, message, details));
  }

  /** Create an error response with correlation ID */
  public static ErrorResponse of(
      String code, String message, String details, String correlationId) {
    ErrorDetails errorDetails = new ErrorDetails(code, message, details);
    errorDetails.setCorrelationId(correlationId);
    return new ErrorResponse(errorDetails);
  }

  /** Create a retryable error response */
  public static ErrorResponse retryable(
      String code, String message, String details, String correlationId, int retryAfterSeconds) {
    ErrorDetails errorDetails = new ErrorDetails(code, message, details);
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setRetryable(true);
    errorDetails.setRetryAfter(retryAfterSeconds);
    return new ErrorResponse(errorDetails);
  }

  /** Error details nested class */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public static class ErrorDetails {
    private String code;
    private String message;
    private String details;
    private LocalDateTime timestamp;
    private String correlationId;
    private Boolean retryable;
    private Integer retryAfter;
    private String path;
    private Integer status;
    private Map<String, Object> metadata;

    public ErrorDetails() {
      this.timestamp = LocalDateTime.now();
    }

    public ErrorDetails(String code, String message) {
      this();
      this.code = code;
      this.message = message;
    }

    public ErrorDetails(String code, String message, String details) {
      this(code, message);
      this.details = details;
    }

    // Getters and setters
    public String getCode() {
      return code;
    }

    public void setCode(String code) {
      this.code = code;
    }

    public String getMessage() {
      return message;
    }

    public void setMessage(String message) {
      this.message = message;
    }

    public String getDetails() {
      return details;
    }

    public void setDetails(String details) {
      this.details = details;
    }

    public LocalDateTime getTimestamp() {
      return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
      this.timestamp = timestamp;
    }

    public String getCorrelationId() {
      return correlationId;
    }

    public void setCorrelationId(String correlationId) {
      this.correlationId = correlationId;
    }

    public Boolean getRetryable() {
      return retryable;
    }

    public void setRetryable(Boolean retryable) {
      this.retryable = retryable;
    }

    public Integer getRetryAfter() {
      return retryAfter;
    }

    public void setRetryAfter(Integer retryAfter) {
      this.retryAfter = retryAfter;
    }

    public String getPath() {
      return path;
    }

    public void setPath(String path) {
      this.path = path;
    }

    public Integer getStatus() {
      return status;
    }

    public void setStatus(Integer status) {
      this.status = status;
    }

    public Map<String, Object> getMetadata() {
      return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
      this.metadata = metadata;
    }

    @Override
    public String toString() {
      return String.format(
          "ErrorDetails{code='%s', message='%s', details='%s', timestamp=%s, correlationId='%s', "
              + "retryable=%s, retryAfter=%d, path='%s', status=%d}",
          code, message, details, timestamp, correlationId, retryable, retryAfter, path, status);
    }
  }

  @Override
  public String toString() {
    return String.format("ErrorResponse{error=%s}", error);
  }
}
