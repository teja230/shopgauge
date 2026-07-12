package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.config.ShopifyConfig;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

class ShopifyGraphqlClientTest {
  private final AtomicReference<ClientRequest> request = new AtomicReference<>();
  private ShopifyConfig config;

  @BeforeEach
  void setUp() {
    config = new ShopifyConfig();
    ReflectionTestUtils.setField(config, "apiVersion", "2026-07");
  }

  @Test
  void mapsProductConnectionAndUsesVersionedAuthenticatedEndpoint() {
    String response =
        """
        {"data":{"products":{"nodes":[{"id":"gid://shopify/Product/42","title":"Widget","handle":"widget","status":"ACTIVE","createdAt":"2026-01-01","updatedAt":"2026-01-02","productType":"Tools","vendor":"Acme","descriptionHtml":"<p>Widget</p>","tags":["sale","blue"],"variants":{"nodes":[{"id":"gid://shopify/ProductVariant/7","title":"Default","price":"19.99","inventoryQuantity":4}]}}],"pageInfo":{"hasNextPage":true,"endCursor":"cursor-1"}}}}
        """;
    ShopifyGraphqlClient client = clientReturning(response);

    Map<String, Object> result =
        client.fetchProducts("merchant.myshopify.com", "token-1", 500, null).block();

    assertEquals("graphql", result.get("api_transport"));
    assertEquals("cursor-1", result.get("next_page_info"));
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> products = (List<Map<String, Object>>) result.get("products");
    assertEquals("42", products.get(0).get("id"));
    assertEquals("sale, blue", products.get(0).get("tags"));
    assertEquals(
        "https://merchant.myshopify.com/admin/api/2026-07/graphql.json",
        request.get().url().toString());
    assertEquals("token-1", request.get().headers().getFirst("X-Shopify-Access-Token"));
    assertEquals(Integer.valueOf(250), ReflectionTestUtils.invokeMethod(client, "clampFirst", 500));
  }

  @Test
  void surfacesGraphqlErrorsInsteadOfReturningPartialData() {
    ShopifyGraphqlClient client = clientReturning("{\"errors\":[{\"message\":\"Access denied\"}]}");

    RuntimeException error =
        assertThrows(
            RuntimeException.class,
            () -> client.fetchShop("merchant.myshopify.com", "bad-token").block());

    assertTrue(error.getMessage().contains("Access denied"));
  }

  private ShopifyGraphqlClient clientReturning(String body) {
    WebClient.Builder builder =
        WebClient.builder()
            .exchangeFunction(
                clientRequest -> {
                  request.set(clientRequest);
                  return Mono.just(
                      ClientResponse.create(HttpStatus.OK)
                          .header("Content-Type", "application/json")
                          .body(body)
                          .build());
                });
    return new ShopifyGraphqlClient(builder, config, new ObjectMapper());
  }
}
