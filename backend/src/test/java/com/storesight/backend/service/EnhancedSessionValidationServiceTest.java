package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.storesight.backend.service.EnhancedSessionValidationService.EnhancedValidationResult;
import com.storesight.backend.service.RedisSessionService.SessionData;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class EnhancedSessionValidationServiceTest {
  private final SessionSecurityService sessionSecurityService = mock(SessionSecurityService.class);
  private final RedisSessionService redisSessionService = mock(RedisSessionService.class);
  private EnhancedSessionValidationService service;

  @BeforeEach
  void setUp() {
    service = new EnhancedSessionValidationService();
    ReflectionTestUtils.setField(service, "sessionSecurityService", sessionSecurityService);
    ReflectionTestUtils.setField(service, "redisSessionService", redisSessionService);
    when(sessionSecurityService.generateSessionHash(anyString(), anyString(), anyString()))
        .thenAnswer(invocation -> invocation.getArgument(0));
  }

  @Test
  void establishesFingerprintThenWarnsWhenDeviceHeadersChange() {
    SessionData session = new SessionData();
    session.setShopDomain("merchant.myshopify.com");
    session.setSessionId("session-1");

    EnhancedValidationResult initial = new EnhancedValidationResult();
    ReflectionTestUtils.invokeMethod(
        service,
        "validateDeviceFingerprint",
        session,
        Map.of("User-Agent", "Browser A", "Accept-Language", "en"),
        initial);

    assertTrue(initial.getWarnings().isEmpty());
    assertEquals("User-Agent:Browser A;Accept-Language:en;", session.getDeviceFingerprint());
    verify(redisSessionService).cacheSessionData("merchant.myshopify.com", "session-1", session);

    EnhancedValidationResult changed = new EnhancedValidationResult();
    ReflectionTestUtils.invokeMethod(
        service,
        "validateDeviceFingerprint",
        session,
        Map.of("User-Agent", "Browser B", "Accept-Language", "en"),
        changed);

    assertTrue(changed.getWarnings().containsKey("DEVICE_FINGERPRINT_MISMATCH"));
  }
}
