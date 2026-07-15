package com.storesight.backend.controller;

import com.storesight.backend.service.AdminAuthService;
import com.storesight.backend.service.ShopService;
import com.storesight.backend.service.SseService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SessionManagementControllerTest {

    private ShopService shopService;
    private SessionManagementController controller;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        shopService = mock(ShopService.class);
        controller =
                new SessionManagementController(
                        shopService,
                        mock(RedisTemplate.class),
                        mock(SseService.class),
                        mock(AdminAuthService.class));
        request = mock(HttpServletRequest.class);
        HttpSession currentSession = mock(HttpSession.class);
        when(currentSession.getId()).thenReturn("current-session");
        when(request.getSession()).thenReturn(currentSession);
    }

    @Test
    void terminatesAnActiveSessionOwnedByTheCurrentShop() {
        when(shopService.hasActiveSession("merchant.myshopify.com", "other-session")).thenReturn(true);

        ResponseEntity<Map<String, Object>> response =
                controller.terminateSession(
                        "merchant.myshopify.com", Map.of("sessionId", "other-session"), request);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).containsEntry("success", true);
        verify(shopService).removeSession("merchant.myshopify.com", "other-session");
    }

    @Test
    void treatsAStaleSessionAsAlreadyRemovedWithoutTouchingAnotherShop() {
        when(shopService.hasActiveSession("merchant.myshopify.com", "stale-session")).thenReturn(false);

        ResponseEntity<Map<String, Object>> response =
                controller.terminateSession(
                        "merchant.myshopify.com", Map.of("sessionId", "stale-session"), request);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody())
                .containsEntry("success", true)
                .containsEntry("message", "Session was already removed");
        verify(shopService, never()).removeSession("merchant.myshopify.com", "stale-session");
    }
}
