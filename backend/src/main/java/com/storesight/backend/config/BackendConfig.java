package com.storesight.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class BackendConfig {

  @Value("${backend.url:http://localhost:8080}")
  private String backendUrl;

  @Value("${server.port:8080}")
  private String serverPort;

  @Value("${server.servlet.context-path:}")
  private String contextPath;

  public String getBackendUrl() {
    return backendUrl;
  }

  public String getServerPort() {
    return serverPort;
  }

  public String getContextPath() {
    return contextPath;
  }

  public String buildBackendUrl(String path) {
    if (path.startsWith("/")) {
      return backendUrl + path;
    }
    return backendUrl + "/" + path;
  }

  public String buildAuthUrl(String shop) {
    return buildBackendUrl("/api/auth/shopify/login?shop=" + shop);
  }
}
