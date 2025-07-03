package com.storesight.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class HealthControllerTest {

  @Autowired private TestRestTemplate restTemplate;

  @Test
  void testHealthSummaryEndpoint() throws Exception {
    var response = restTemplate.getForEntity("/api/health/summary", String.class);
    assert response.getStatusCode().is2xxSuccessful();
  }

  @Test
  void testDatabaseHealthEndpoint() throws Exception {
    var response = restTemplate.getForEntity("/api/health/database", String.class);
    assert response.getStatusCode().is2xxSuccessful();
  }

  @Test
  void testRedisHealthEndpoint() throws Exception {
    var response = restTemplate.getForEntity("/api/health/redis", String.class);
    assert response.getStatusCode().is2xxSuccessful();
  }

  @Test
  void testDetailedHealthEndpoint() throws Exception {
    var response = restTemplate.getForEntity("/api/health/detailed", String.class);
    assert response.getStatusCode().is2xxSuccessful();
  }
}
