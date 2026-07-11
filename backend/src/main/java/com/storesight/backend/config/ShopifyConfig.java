package com.storesight.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ShopifyConfig {

  @Value("${shopify.api.version:2026-07}")
  private String apiVersion;

  @Value("${shopify.admin.base-url:https://{shop}.myshopify.com/admin}")
  private String adminBaseUrl;

  public String getApiVersion() {
    return apiVersion;
  }

  public String getAdminBaseUrl() {
    return adminBaseUrl;
  }

  public String buildApiUrl(String shop, String endpoint) {
    return String.format("https://%s/admin/api/%s/%s", shop, apiVersion, endpoint);
  }

  public String buildGraphqlUrl(String shop) {
    return String.format("https://%s/admin/api/%s/graphql.json", shop, apiVersion);
  }

  public String buildAdminUrl(String shop, String path) {
    return String.format("https://%s/admin/%s", shop, path);
  }
}
