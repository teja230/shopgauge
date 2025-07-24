package com.storesight.backend.config;

import com.storesight.backend.model.ErrorResponse;
import com.storesight.backend.util.CorrelationIdUtil;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

/**
 * Global exception handler for standardized error responses
 *
 * <p>This handler catches all exceptions thrown by controllers and converts them into standardized
 * error responses with proper HTTP status codes, correlation IDs, and structured logging.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  /** Handle validation errors */
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> handleValidationException(
      MethodArgumentNotValidException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    Map<String, String> fieldErrors = new HashMap<>();
    for (FieldError error : ex.getBindingResult().getFieldErrors()) {
      fieldErrors.put(error.getField(), error.getDefaultMessage());
    }

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails("VALIDATION_ERROR", "Request validation failed");
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.BAD_REQUEST.value());
    errorDetails.setMetadata(Map.of("fieldErrors", fieldErrors));

    logger.warn(
        "Validation error [{}]: {} field errors on {}",
        correlationId,
        fieldErrors.size(),
        request.getRequestURI());

    return ResponseEntity.badRequest().body(new ErrorResponse(errorDetails));
  }

  /** Handle bind exceptions */
  @ExceptionHandler(BindException.class)
  public ResponseEntity<ErrorResponse> handleBindException(
      BindException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    Map<String, String> fieldErrors = new HashMap<>();
    for (FieldError error : ex.getBindingResult().getFieldErrors()) {
      fieldErrors.put(error.getField(), error.getDefaultMessage());
    }

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails("BIND_ERROR", "Request binding failed");
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.BAD_REQUEST.value());
    errorDetails.setMetadata(Map.of("fieldErrors", fieldErrors));

    logger.warn(
        "Bind error [{}]: {} field errors on {}",
        correlationId,
        fieldErrors.size(),
        request.getRequestURI());

    return ResponseEntity.badRequest().body(new ErrorResponse(errorDetails));
  }

  /** Handle missing request parameters */
  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<ErrorResponse> handleMissingParameterException(
      MissingServletRequestParameterException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "MISSING_PARAMETER",
            "Required request parameter is missing",
            String.format(
                "Parameter '%s' of type '%s' is required",
                ex.getParameterName(), ex.getParameterType()));
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.BAD_REQUEST.value());

    logger.warn(
        "Missing parameter error [{}]: {} on {}",
        correlationId,
        ex.getParameterName(),
        request.getRequestURI());

    return ResponseEntity.badRequest().body(new ErrorResponse(errorDetails));
  }

  /** Handle method argument type mismatch */
  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ErrorResponse> handleTypeMismatchException(
      MethodArgumentTypeMismatchException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "TYPE_MISMATCH",
            "Invalid parameter type",
            String.format(
                "Parameter '%s' should be of type '%s'",
                ex.getName(), ex.getRequiredType().getSimpleName()));
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.BAD_REQUEST.value());

    logger.warn(
        "Type mismatch error [{}]: {} on {}", correlationId, ex.getName(), request.getRequestURI());

    return ResponseEntity.badRequest().body(new ErrorResponse(errorDetails));
  }

  /** Handle malformed JSON requests */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ErrorResponse> handleMessageNotReadableException(
      HttpMessageNotReadableException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "MALFORMED_REQUEST",
            "Request body is malformed or unreadable",
            "Please check the JSON format and try again");
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.BAD_REQUEST.value());

    logger.warn(
        "Malformed request error [{}]: {} on {}",
        correlationId,
        ex.getMessage(),
        request.getRequestURI());

    return ResponseEntity.badRequest().body(new ErrorResponse(errorDetails));
  }

  /** Handle unsupported HTTP methods */
  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ErrorResponse> handleMethodNotSupportedException(
      HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "METHOD_NOT_SUPPORTED",
            "HTTP method not supported",
            String.format(
                "Method '%s' is not supported for this endpoint. Supported methods: %s",
                ex.getMethod(), String.join(", ", ex.getSupportedMethods())));
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.METHOD_NOT_ALLOWED.value());

    logger.warn(
        "Method not supported error [{}]: {} on {}",
        correlationId,
        ex.getMethod(),
        request.getRequestURI());

    return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
        .body(new ErrorResponse(errorDetails));
  }

  /** Handle 404 - No handler found */
  @ExceptionHandler(NoHandlerFoundException.class)
  public ResponseEntity<ErrorResponse> handleNoHandlerFoundException(
      NoHandlerFoundException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "ENDPOINT_NOT_FOUND",
            "Endpoint not found",
            String.format("No handler found for %s %s", ex.getHttpMethod(), ex.getRequestURL()));
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.NOT_FOUND.value());

    logger.warn(
        "Endpoint not found [{}]: {} {} on {}",
        correlationId,
        ex.getHttpMethod(),
        ex.getRequestURL(),
        request.getRequestURI());

    return ResponseEntity.notFound().build();
  }

  /** Handle authentication exceptions */
  @ExceptionHandler({
    AuthenticationException.class,
    AuthenticationCredentialsNotFoundException.class
  })
  public ResponseEntity<ErrorResponse> handleAuthenticationException(
      Exception ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "AUTHENTICATION_FAILED",
            "Authentication failed",
            "Please check your credentials and try again");
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.UNAUTHORIZED.value());

    logger.warn(
        "Authentication error [{}]: {} on {}",
        correlationId,
        ex.getMessage(),
        request.getRequestURI());

    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse(errorDetails));
  }

  /** Handle authorization exceptions */
  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ErrorResponse> handleAccessDeniedException(
      AccessDeniedException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "ACCESS_DENIED", "Access denied", "You don't have permission to access this resource");
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.FORBIDDEN.value());

    logger.warn(
        "Access denied [{}]: {} on {}", correlationId, ex.getMessage(), request.getRequestURI());

    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse(errorDetails));
  }

  /** Handle database exceptions */
  @ExceptionHandler(DataAccessException.class)
  public ResponseEntity<ErrorResponse> handleDataAccessException(
      DataAccessException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "DATABASE_ERROR",
            "Database operation failed",
            "A database error occurred. Please try again later");
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
    errorDetails.setRetryable(true);
    errorDetails.setRetryAfter(30);

    logger.error(
        "Database error [{}]: {} on {}",
        correlationId,
        ex.getMessage(),
        request.getRequestURI(),
        ex);

    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ErrorResponse(errorDetails));
  }

  /** Handle Redis connection exceptions */
  @ExceptionHandler(RedisConnectionFailureException.class)
  public ResponseEntity<ErrorResponse> handleRedisConnectionException(
      RedisConnectionFailureException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "REDIS_CONNECTION_ERROR",
            "Cache service temporarily unavailable",
            "The caching service is temporarily unavailable. The request will continue without cache");
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.SERVICE_UNAVAILABLE.value());
    errorDetails.setRetryable(true);
    errorDetails.setRetryAfter(60);

    logger.warn(
        "Redis connection error [{}]: {} on {}",
        correlationId,
        ex.getMessage(),
        request.getRequestURI());

    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(new ErrorResponse(errorDetails));
  }

  /** Handle illegal argument exceptions */
  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ErrorResponse> handleIllegalArgumentException(
      IllegalArgumentException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "INVALID_ARGUMENT", "Invalid argument provided", ex.getMessage());
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.BAD_REQUEST.value());

    logger.warn(
        "Invalid argument error [{}]: {} on {}",
        correlationId,
        ex.getMessage(),
        request.getRequestURI());

    return ResponseEntity.badRequest().body(new ErrorResponse(errorDetails));
  }

  /** Handle illegal state exceptions */
  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<ErrorResponse> handleIllegalStateException(
      IllegalStateException ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    // Special handling for session invalidation errors
    if (ex.getMessage() != null && ex.getMessage().contains("Session was invalidated")) {
      logger.warn(
          "Session invalidation error [{}]: {} on {}",
          correlationId,
          ex.getMessage(),
          request.getRequestURI());

      ErrorResponse.ErrorDetails errorDetails =
          new ErrorResponse.ErrorDetails(
              "SESSION_INVALIDATED",
              "Session expired",
              "Your session has expired. Please refresh the page and try again.");
      errorDetails.setCorrelationId(correlationId);
      errorDetails.setPath(request.getRequestURI());
      errorDetails.setStatus(HttpStatus.UNAUTHORIZED.value());
      errorDetails.setRetryable(false);
      errorDetails.setMetadata(Map.of("requiresReauth", true));

      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse(errorDetails));
    }

    // Special handling for response stream conflicts
    if (ex.getMessage() != null
        && ex.getMessage().contains("getOutputStream() has already been called")) {
      logger.warn(
          "Response stream conflict [{}]: {} on {}",
          correlationId,
          ex.getMessage(),
          request.getRequestURI());

      ErrorResponse.ErrorDetails errorDetails =
          new ErrorResponse.ErrorDetails(
              "RESPONSE_CONFLICT",
              "Response stream error",
              "A response conflict occurred. Please try again.");
      errorDetails.setCorrelationId(correlationId);
      errorDetails.setPath(request.getRequestURI());
      errorDetails.setStatus(HttpStatus.CONFLICT.value());
      errorDetails.setRetryable(true);
      errorDetails.setRetryAfter(5);

      return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(errorDetails));
    }

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails("INVALID_STATE", "Invalid operation state", ex.getMessage());
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.CONFLICT.value());
    errorDetails.setRetryable(true);
    errorDetails.setRetryAfter(10);

    logger.warn(
        "Invalid state error [{}]: {} on {}",
        correlationId,
        ex.getMessage(),
        request.getRequestURI());

    return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(errorDetails));
  }

  /** Handle all other exceptions */
  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleGenericException(
      Exception ex, HttpServletRequest request) {

    String correlationId = CorrelationIdUtil.getOrGenerateCorrelationId();

    ErrorResponse.ErrorDetails errorDetails =
        new ErrorResponse.ErrorDetails(
            "INTERNAL_ERROR",
            "An unexpected error occurred",
            "Please try again later or contact support if the problem persists");
    errorDetails.setCorrelationId(correlationId);
    errorDetails.setPath(request.getRequestURI());
    errorDetails.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
    errorDetails.setRetryable(true);
    errorDetails.setRetryAfter(60);

    logger.error(
        "Unexpected error [{}]: {} on {}",
        correlationId,
        ex.getMessage(),
        request.getRequestURI(),
        ex);

    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ErrorResponse(errorDetails));
  }
}
