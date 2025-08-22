package com.storesight.backend.controller;

import com.storesight.backend.config.DemoModeSecurityConfig;
import com.storesight.backend.service.DemoModeService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller for demo mode functionality Handles demo store authentication and session management
 */
@RestController
@RequestMapping("/api/demo")
public class DemoModeController {

  private static final Logger logger = LoggerFactory.getLogger(DemoModeController.class);

  @Autowired private DemoModeService demoModeService;

  @Autowired private DemoModeSecurityConfig demoSecurityConfig;

  @Value("${frontend.url:http://localhost:5173}")
  private String frontendUrl;

  @Value("${spring.profiles.active:dev}")
  private String activeProfile;

  /** Initialize demo mode session Creates a demo session and redirects to dashboard */
  @PostMapping("/start")
  public ResponseEntity<?> startDemo(HttpServletRequest request, HttpServletResponse response) {

    try {
      String ipAddress = getClientIpAddress(request);
      String userAgent = request.getHeader("User-Agent");

      logger.info("Demo mode start request from IP: {}", ipAddress);

      // Check if demo mode is enabled
      if (!demoModeService.isDemoModeEnabled()) {
        logger.warn("Demo mode start attempt when demo mode is disabled");
        return ResponseEntity.badRequest()
            .body(
                Map.of(
                    "error", "Demo mode is currently disabled",
                    "message", "Demo mode is not available at this time"));
      }

      // Security validation
      if (!demoSecurityConfig.validateDemoRequest(userAgent, ipAddress)) {
        logger.warn(
            "Demo request failed security validation for IP: {}, UA: {}", ipAddress, userAgent);
        return ResponseEntity.status(403)
            .body(
                Map.of(
                    "error", "Demo request denied",
                    "message", "Demo access is not available for this request"));
      }

      // Check security limits (rate limiting, concurrent sessions)
      if (!demoSecurityConfig.isDemoSessionCreationAllowed(ipAddress)) {
        logger.warn("Demo session creation denied due to security limits for IP: {}", ipAddress);
        return ResponseEntity.status(429)
            .body(
                Map.of(
                    "error", "Demo mode temporarily unavailable",
                    "message",
                        "Please try again later. Demo mode has usage limits to ensure availability for all users."));
      }

      // Create demo session
      String sessionId = demoModeService.createDemoSession(userAgent, ipAddress);
      if (sessionId == null) {
        logger.error("Failed to create demo session");
        return ResponseEntity.internalServerError()
            .body(
                Map.of(
                    "error", "Failed to create demo session",
                    "message", "Unable to initialize demo mode. Please try again."));
      }

      // Register session for security tracking
      demoSecurityConfig.registerDemoSession();

      // Create HTTP session and set attributes
      HttpSession httpSession = request.getSession(true);
      httpSession.setAttribute("shop", DemoModeService.DEMO_STORE_DOMAIN);
      httpSession.setAttribute("demo_mode", true);
      httpSession.setAttribute("demo_session_id", sessionId);

      // Set shop cookie for authentication
      setShopCookie(response, DemoModeService.DEMO_STORE_DOMAIN);

      logger.info("Demo session created successfully: {} for IP: {}", sessionId, ipAddress);

      return ResponseEntity.ok(
          Map.of(
              "success",
              true,
              "shop",
              DemoModeService.DEMO_STORE_DOMAIN,
              "sessionId",
              sessionId,
              "redirectUrl",
              frontendUrl + "/dashboard?demo=true",
              "message",
              "Demo mode initialized successfully"));

    } catch (Exception e) {
      logger.error("Error starting demo mode", e);
      return ResponseEntity.internalServerError()
          .body(
              Map.of(
                  "error", "Internal server error",
                  "message", "An error occurred while starting demo mode"));
    }
  }

  /** Get demo mode status and information */
  @GetMapping("/status")
  public ResponseEntity<?> getDemoStatus() {
    try {
      Map<String, Object> stats = demoModeService.getDemoModeStats();

      // Add security statistics
      DemoModeSecurityConfig.DemoSecurityStats securityStats =
          demoSecurityConfig.getDemoSecurityStats();
      stats.put(
          "security",
          Map.of(
              "activeSessions", securityStats.activeSessions,
              "maxSessions", securityStats.maxSessions,
              "rateLimit", securityStats.rateLimit,
              "enabled", securityStats.enabled));

      return ResponseEntity.ok(stats);
    } catch (Exception e) {
      logger.error("Error getting demo status", e);
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to get demo status", "message", e.getMessage()));
    }
  }



  /** End demo session */
  @PostMapping("/end")
  public ResponseEntity<?> endDemo(HttpServletRequest request, HttpServletResponse response) {
    try {
      logger.info("Demo mode end request from IP: {}", getClientIpAddress(request));

      // Clear HTTP session
      HttpSession httpSession = request.getSession(false);
      if (httpSession != null) {
        try {
          httpSession.invalidate();
        } catch (Exception e) {
          logger.warn("Error invalidating demo session: {}", e.getMessage());
        }
      }

      // Unregister session for security tracking
      demoSecurityConfig.unregisterDemoSession();

      // Clear shop cookie
      clearShopCookie(response);

      return ResponseEntity.ok(
          Map.of(
              "success",
              true,
              "message",
              "Demo session ended successfully",
              "redirectUrl",
              frontendUrl));

    } catch (Exception e) {
      logger.error("Error ending demo mode", e);
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to end demo session", "message", e.getMessage()));
    }
  }

  /** Admin endpoint to toggle demo mode */
  @PostMapping("/admin/toggle")
  public ResponseEntity<?> toggleDemoMode(@RequestParam boolean enabled) {
    try {
      if (enabled) {
        demoModeService.enableDemoMode();
      } else {
        demoModeService.disableDemoMode();
      }

      return ResponseEntity.ok(
          Map.of(
              "success",
              true,
              "enabled",
              enabled,
              "message",
              "Demo mode " + (enabled ? "enabled" : "disabled") + " successfully"));

    } catch (Exception e) {
      logger.error("Error toggling demo mode", e);
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to toggle demo mode", "message", e.getMessage()));
    }
  }

  // Helper methods

  private String getClientIpAddress(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
      return xForwardedFor.split(",")[0].trim();
    }

    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isEmpty()) {
      return xRealIp;
    }

    return request.getRemoteAddr();
  }

  private String getShopFromCookie(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (Cookie cookie : cookies) {
        if ("shop".equals(cookie.getName())) {
          return cookie.getValue();
        }
      }
    }
    return null;
  }

  private void setShopCookie(HttpServletResponse response, String shopDomain) {
    try {
      Cookie shopCookie = new Cookie("shop", shopDomain);
      shopCookie.setPath("/");
      shopCookie.setHttpOnly(false);
      shopCookie.setMaxAge(60 * 60 * 24); // 24 hours for demo
      shopCookie.setSecure("prod".equals(activeProfile));
      response.addCookie(shopCookie);

      // Set SameSite attribute via header for better browser compatibility
      String sameSiteValue = "prod".equals(activeProfile) ? "None; Secure" : "Lax";
      response.addHeader(
          "Set-Cookie",
          String.format(
              "shop=%s; Path=/; Max-Age=%d; SameSite=%s", shopDomain, 60 * 60 * 24, sameSiteValue));

      logger.debug("Set demo shop cookie for: {}", shopDomain);
    } catch (Exception e) {
      logger.warn("Failed to set demo shop cookie: {}", e.getMessage());
    }
  }

  private void clearShopCookie(HttpServletResponse response) {
    try {
      Cookie shopCookie = new Cookie("shop", "");
      shopCookie.setPath("/");
      shopCookie.setMaxAge(0);
      response.addCookie(shopCookie);

      response.addHeader("Set-Cookie", "shop=; Path=/; Max-Age=0; SameSite=Lax");

      logger.debug("Cleared demo shop cookie");
    } catch (Exception e) {
      logger.warn("Failed to clear demo shop cookie: {}", e.getMessage());
    }
  }
}
