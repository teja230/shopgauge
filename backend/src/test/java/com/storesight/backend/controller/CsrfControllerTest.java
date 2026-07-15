package com.storesight.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.security.web.csrf.CsrfToken;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CsrfControllerTest {

    @Test
    void returnsTokenAndSpringHeaderMetadata() {
        CsrfToken csrfToken = mock(CsrfToken.class);
        when(csrfToken.getToken()).thenReturn("test-token");
        when(csrfToken.getHeaderName()).thenReturn("X-XSRF-TOKEN");
        when(csrfToken.getParameterName()).thenReturn("_csrf");

        Map<String, String> response = new CsrfController().getCsrfToken(csrfToken);

        assertThat(response)
                .containsEntry("token", "test-token")
                .containsEntry("headerName", "X-XSRF-TOKEN")
                .containsEntry("parameterName", "_csrf");
    }
}
