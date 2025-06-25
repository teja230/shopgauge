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
    String requestPath = path != null ? path.toString() : request.getRequestURI();

    // Only handle actual errors (status code >= 400)
    if (status == null) {
      logger.debug("No error status found, letting request pass through: {}", requestPath);
      // Return null to let Spring handle the request normally
      return null;
    }

    int statusCode = (Integer) status;

    // Don't handle successful requests or redirects
    if (statusCode < 400) {
      logger.debug(
          "Not an error status ({}), letting request pass through: {}", statusCode, requestPath);
      return null;
    }

    String errorMessage = message != null ? message.toString() : "An unexpected error occurred";

    // Log the error
    logger.error(
        "Error occurred - Status: {}, Message: {}, Path: {}, Exception: {}",
        statusCode,
        errorMessage,
        requestPath,
        exception);

    // Check if the request expects HTML (browser request)
    String acceptHeader = request.getHeader("Accept");
    boolean isHtmlRequest = acceptHeader != null && acceptHeader.contains("text/html");

    if (isHtmlRequest) {
      // Return HTML error page for browser requests
      return ResponseEntity.status(HttpStatus.valueOf(statusCode))
          .header("Content-Type", "text/html;charset=UTF-8")
          .body(Map.of("html", generateErrorHtml(statusCode, errorMessage, requestPath)));
    } else {
      // Return JSON error response for API requests
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("timestamp", System.currentTimeMillis());
      errorResponse.put("status", statusCode);
      errorResponse.put("error", getErrorTitle(statusCode));
      errorResponse.put("message", errorMessage);
      errorResponse.put("path", requestPath);

      return ResponseEntity.status(HttpStatus.valueOf(statusCode)).body(errorResponse);
    }
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
    String icon =
        statusCode >= 500
            ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            : statusCode >= 400
                ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";

    return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>%s - ShopGauge</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    body { font-family: 'Inter', system-ui, sans-serif; }
                    .gradient-bg { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); }
                </style>
            </head>
            <body class="min-h-screen gradient-bg flex items-center justify-center px-4">
                <div class="max-w-md w-full">
                    <div class="bg-white rounded-2xl shadow-2xl p-8 text-center transform hover:scale-105 transition-transform duration-300">
                        <!-- Error Icon -->
                        <div class="mx-auto w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
                            <svg class="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="%s"></path>
                            </svg>
                        </div>

                        <!-- Error Code -->
                        <div class="text-7xl font-bold text-gray-300 mb-4">%d</div>

                        <!-- Error Title -->
                        <h1 class="text-3xl font-bold text-gray-900 mb-3">%s</h1>

                        <!-- Error Message -->
                        <p class="text-gray-600 mb-6 text-lg">%s</p>

                        <!-- Path Info (only for 404) -->
                        %s

                        <!-- Action Buttons -->
                        <div class="space-y-4">
                            <button onclick="window.history.back()" class="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl">
                                ← Go Back
                            </button>
                            <button onclick="window.location.href='https://www.shopgaugeai.com'" class="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 font-semibold">
                                🏠 Go to Homepage
                            </button>
                        </div>

                        <!-- Footer -->
                        <div class="mt-8 pt-6 border-t border-gray-200">
                            <p class="text-sm text-gray-500">
                                Need help? Contact us at
                                <a href="mailto:support@shopgaugeai.com" class="text-blue-600 hover:underline font-medium">support@shopgaugeai.com</a>
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Floating Elements -->
                <div class="fixed top-10 left-10 opacity-20 animate-bounce">
                    <div class="w-8 h-8 bg-white rounded-full"></div>
                </div>
                <div class="fixed bottom-10 right-10 opacity-20 animate-pulse">
                    <div class="w-6 h-6 bg-white rounded-full"></div>
                </div>
                <div class="fixed top-1/2 left-1/4 opacity-10 animate-spin">
                    <div class="w-4 h-4 bg-white rounded-full"></div>
                </div>
            </body>
            </html>
            """
        .formatted(
            title,
            icon,
            statusCode,
            title,
            message,
            statusCode == 404
                ? """
                <div class="bg-gray-50 rounded-xl p-4 mb-6">
                    <p class="text-sm text-gray-500 mb-2">Requested path:</p>
                    <p class="text-sm font-mono text-gray-700 break-all bg-white p-2 rounded border">%s</p>
                </div>
                """
                    .formatted(path)
                : "");
  }
}
