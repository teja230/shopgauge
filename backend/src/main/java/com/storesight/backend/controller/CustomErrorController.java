package com.storesight.backend.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
public class CustomErrorController implements ErrorController {

  private static final Logger logger = LoggerFactory.getLogger(CustomErrorController.class);

  @RequestMapping("/error")
  @ResponseBody
  public ResponseEntity<Map<String, Object>> handleError(HttpServletRequest request) {
    Object status = request.getAttribute("javax.servlet.error.status_code");
    Object message = request.getAttribute("javax.servlet.error.message");
    Object exception = request.getAttribute("javax.servlet.error.exception");
    Object path = request.getAttribute("javax.servlet.error.request_uri");

    // If no error attributes are set, this might be a health check or other request
    // that shouldn't trigger the error controller
    if (status == null && message == null && exception == null) {
      logger.debug(
          "Error controller called but no error attributes found - likely a health check or invalid request");
      return ResponseEntity.ok(Map.of("status", "UP", "message", "Application is running"));
    }

    int statusCode = status != null ? (Integer) status : 500;
    String errorMessage = message != null ? message.toString() : "An unexpected error occurred";
    String requestPath = path != null ? path.toString() : request.getRequestURI();

    // Don't log errors for health checks or expected 404s
    if (requestPath != null
        && (requestPath.contains("/health") || requestPath.contains("/favicon.ico"))) {
      logger.debug("Health check or favicon request to error controller: {}", requestPath);
      return ResponseEntity.ok(Map.of("status", "UP"));
    }

    logger.error(
        "Error occurred - Status: {}, Message: {}, Path: {}, Exception: {}",
        statusCode,
        errorMessage,
        requestPath,
        exception);

    Map<String, Object> errorResponse = new HashMap<>();
    errorResponse.put("timestamp", System.currentTimeMillis());
    errorResponse.put("status", statusCode);
    errorResponse.put("error", getErrorTitle(statusCode));
    errorResponse.put("message", errorMessage);
    errorResponse.put("path", requestPath);

    // Add helpful information for debugging
    if (statusCode == 500) {
      errorResponse.put(
          "debug_info", "This is a server error. Please check the logs for more details.");
      errorResponse.put(
          "suggestion", "Try refreshing the page or contact support if the problem persists.");
    } else if (statusCode == 404) {
      errorResponse.put("debug_info", "The requested resource was not found.");
      errorResponse.put("suggestion", "Check the URL or navigate back to the home page.");
    } else if (statusCode == 401) {
      errorResponse.put("debug_info", "Authentication required.");
      errorResponse.put("suggestion", "Please log in to access this resource.");
    } else if (statusCode == 403) {
      errorResponse.put("debug_info", "Access forbidden.");
      errorResponse.put("suggestion", "You don't have permission to access this resource.");
    }

    // Add HTML response for browser requests
    String acceptHeader = request.getHeader("Accept");
    if (acceptHeader != null && acceptHeader.contains("text/html")) {
      return ResponseEntity.status(HttpStatus.valueOf(statusCode))
          .header("Content-Type", "text/html;charset=UTF-8")
          .body(Map.of("html", generateErrorHtml(statusCode, errorMessage, requestPath)));
    }

    return ResponseEntity.status(HttpStatus.valueOf(statusCode)).body(errorResponse);
  }

  private String getErrorTitle(int statusCode) {
    switch (statusCode) {
      case 400:
        return "Bad Request";
      case 401:
        return "Unauthorized";
      case 403:
        return "Forbidden";
      case 404:
        return "Not Found";
      case 500:
        return "Internal Server Error";
      case 502:
        return "Bad Gateway";
      case 503:
        return "Service Unavailable";
      default:
        return "Error";
    }
  }

  private String generateErrorHtml(int statusCode, String message, String path) {
    String title = getErrorTitle(statusCode);
    String color = statusCode >= 500 ? "#dc2626" : statusCode >= 400 ? "#d97706" : "#2563eb";

    return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>%s - StoreSight</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    body { font-family: 'Inter', system-ui, sans-serif; }
                </style>
            </head>
            <body class="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4">
                <div class="max-w-md w-full">
                    <div class="bg-white rounded-2xl shadow-xl p-8 text-center">
                        <!-- Error Icon -->
                        <div class="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
                            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                            </svg>
                        </div>

                        <!-- Error Code -->
                        <div class="text-6xl font-bold text-gray-300 mb-4">%d</div>

                        <!-- Error Title -->
                        <h1 class="text-2xl font-bold text-gray-900 mb-2">%s</h1>

                        <!-- Error Message -->
                        <p class="text-gray-600 mb-6">%s</p>

                        <!-- Path Info -->
                        <div class="bg-gray-50 rounded-lg p-3 mb-6">
                            <p class="text-sm text-gray-500">Requested path:</p>
                            <p class="text-sm font-mono text-gray-700 break-all">%s</p>
                        </div>

                        <!-- Action Buttons -->
                        <div class="space-y-3">
                            <button onclick="window.history.back()" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                                ← Go Back
                            </button>
                            <button onclick="window.location.href='https://storesight.onrender.com'" class="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                                Go to Homepage
                            </button>
                        </div>

                        <!-- Footer -->
                        <div class="mt-8 pt-6 border-t border-gray-200">
                            <p class="text-sm text-gray-500">
                                Need help? Contact us at
                                <a href="mailto:support@storesight.com" class="text-blue-600 hover:underline">support@storesight.com</a>
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Fun Animation -->
                <div class="fixed top-4 right-4 opacity-10">
                    <div class="animate-bounce">
                        <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                </div>
            </body>
            </html>
            """
        .formatted(title, statusCode, title, message, path);
  }
}
