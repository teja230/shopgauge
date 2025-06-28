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
  void testHealthSummaryEndpoint() throws Exception {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();

    mockMvc
        .perform(get("/api/health/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").exists())
        .andExpect(jsonPath("$.application").exists())
        .andExpect(jsonPath("$.timestamp").exists())
        .andExpect(jsonPath("$.database").exists())
        .andExpect(jsonPath("$.redis").exists());
  }

  @Test
  void testDatabaseHealthEndpoint() throws Exception {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();

    mockMvc
        .perform(get("/api/health/database"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").exists())
        .andExpect(jsonPath("$.connection").exists());
  }

  @Test
  void testRedisHealthEndpoint() throws Exception {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();

    mockMvc
        .perform(get("/api/health/redis"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").exists());
  }

  @Test
  void testDetailedHealthEndpoint() throws Exception {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();

    mockMvc
        .perform(get("/api/health/detailed"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").exists())
        .andExpect(jsonPath("$.application").exists())
        .andExpect(jsonPath("$.timestamp").exists())
        .andExpect(jsonPath("$.database").exists())
        .andExpect(jsonPath("$.redis").exists());
  }
}
