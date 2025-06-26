package com.storesight.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureWebMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@AutoConfigureWebMvc
@ActiveProfiles("test")
class HealthControllerTest {

  @Autowired private WebApplicationContext webApplicationContext;

  private MockMvc mockMvc;

  @Test
  void testHealthEndpoint() throws Exception {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();

    mockMvc
        .perform(get("/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"))
        .andExpect(jsonPath("$.application").exists())
        .andExpect(jsonPath("$.timestamp").exists());
  }

  @Test
  void testApiHealthEndpoint() throws Exception {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();

    mockMvc
        .perform(get("/api/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"))
        .andExpect(jsonPath("$.application").exists())
        .andExpect(jsonPath("$.timestamp").exists());
  }

  @Test
  void testApiHealthSummaryEndpoint() throws Exception {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();

    mockMvc
        .perform(get("/api/health/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.backendStatus").value("UP"))
        .andExpect(jsonPath("$.systemStatus").exists())
        .andExpect(jsonPath("$.lastUpdated").exists());
  }

  @Test
  void testRootHealthEndpoint() throws Exception {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();

    mockMvc
        .perform(get("/"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"))
        .andExpect(jsonPath("$.application").exists())
        .andExpect(jsonPath("$.message").value("ShopGauge Backend is running"));
  }
}
