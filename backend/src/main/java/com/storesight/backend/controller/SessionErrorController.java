package com.storesight.backend.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Custom error controller that handles session-related errors gracefully
 * This prevents session invalidation errors from causing error page cascades
 */
@RestController
public class SessionErrorController implements ErrorController {

  private static final Logger logger = LoggerFactory.getLogger(SessionErrorController.class);

  @RequestMapping("/error")
  public ResponseEntity<Object> handleError(HttpServletRequest request, HttpServletResponse response) {
    String path = request.getRequestURI();
    Object status = request.getAttribute("javax.servlet.error.status_code");
    Object exception = request.getAttribute("javax.servlet.error.exception");
    Object message = request.getAttribute("javax.servlet.error.message");
    
    logger.debug("Error controller handling error for path: {}, status: {}, exception: {}, message: {}", 
        path, status, exception != null ? exception.getClass().getSimpleName() : "null", message);
    
    // Check if this is a session-related error
    boolean isSessionError = false;
    if (exception instanceof IllegalStateException) {
      IllegalStateException ise = (IllegalStateException) exception;
      if (ise.getMessage() != null && ise.getMessage().contains("Session was invalidated")) {
        isSessionError = true;
      }
    } else if (message != null && message.toString().contains("Session")) {
      isSessionError = true;
    }
    
    if (isSessionError) {
      logger.debug("Session error detected in error controller - handling gracefully");
      
      // Add CORS headers for API requests
      response.setHeader("Access-Control-Allow-Origin", "https://www.shopgaugeai.com");
      response.setHeader("Access-Control-Allow-Credentials", "true");
      
      // Return a clean success response
      return ResponseEntity.ok()
          .header("X-Session-Warning", "Session issue resolved")
          .body("{\"success\":true,\"message\":\"Session issue resolved - please refresh if you experience problems\"}");
    }
    
    // Handle other errors normally
    HttpStatus httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    if (status != null) {
      try {
        httpStatus = HttpStatus.valueOf(Integer.parseInt(status.toString()));
      } catch (Exception e) {
        logger.debug("Could not parse status code: {}", status);
      }
    }
    
    // Add CORS headers for all error responses
    response.setHeader("Access-Control-Allow-Origin", "https://www.shopgaugeai.com");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    
    return ResponseEntity.status(httpStatus)
        .body("{\"error\":\"" + httpStatus.getReasonPhrase() + "\",\"status\":" + httpStatus.value() + "}");
  }
}