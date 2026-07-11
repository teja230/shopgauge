package com.storesight.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.config.ShopifyConfig;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

/** Current-version Shopify GraphQL gateway with a narrow compatibility mapper for analytics. */
@Service
public class ShopifyGraphqlClient {
  private final WebClient webClient;
  private final ShopifyConfig shopifyConfig;
  private final ObjectMapper objectMapper;

  public ShopifyGraphqlClient(
      WebClient.Builder webClientBuilder, ShopifyConfig shopifyConfig, ObjectMapper objectMapper) {
    this.webClient = webClientBuilder.build();
    this.shopifyConfig = shopifyConfig;
    this.objectMapper = objectMapper;
  }

  public Mono<Map<String, Object>> fetchProducts(
      String shop, String token, int requestedFirst, String queryFilter) {
    int first = clampFirst(requestedFirst);
    String query =
        "query Products($first: Int!, $query: String) { products(first: $first, query: $query) { "
            + "nodes { id title handle status createdAt updatedAt productType vendor descriptionHtml tags variants(first: 100) { nodes { id title price inventoryQuantity } } } "
            + "pageInfo { hasNextPage endCursor } } }";
    return execute(
            shop,
            token,
            query,
            Map.of("first", first, "query", queryFilter == null ? "" : queryFilter))
        .map(root -> mapProducts(root.path("data").path("products")));
  }

  public Mono<Map<String, Object>> fetchOrders(
      String shop, String token, int requestedFirst, String after, String queryFilter) {
    int first = clampFirst(requestedFirst);
    String query =
        "query Orders($first: Int!, $after: String, $query: String) { orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) { "
            + "nodes { id name createdAt displayFinancialStatus displayFulfillmentStatus customer { id } "
            + "totalPriceSet { shopMoney { amount currencyCode } } } pageInfo { hasNextPage endCursor } } }";
    Map<String, Object> variables = new HashMap<>();
    variables.put("first", first);
    variables.put("after", after);
    variables.put("query", queryFilter == null ? "" : queryFilter);
    return execute(shop, token, query, variables)
        .map(root -> mapOrders(root.path("data").path("orders")));
  }

  public Mono<Map<String, Object>> fetchShop(String shop, String token) {
    String query = "query ShopContext { shop { id name myshopifyDomain } }";
    return execute(shop, token, query, Map.of())
        .map(
            root -> {
              JsonNode node = root.path("data").path("shop");
              return Map.of(
                  "shop",
                  Map.of(
                      "id", legacyId(node.path("id").asText()),
                      "name", node.path("name").asText(),
                      "myshopify_domain", node.path("myshopifyDomain").asText()));
            });
  }

  public Mono<Void> verifyCustomerAccess(String shop, String token) {
    String query = "query CustomerPermission { customers(first: 1) { nodes { id } } }";
    return execute(shop, token, query, Map.of()).then();
  }

  public Mono<Map<String, Object>> fetchAbandonedCheckouts(
      String shop, String token, int requestedFirst, String queryFilter) {
    String query =
        "query AbandonedCheckouts($first: Int!, $query: String) { abandonedCheckouts(first: $first, query: $query) { "
            + "nodes { id createdAt completedAt } pageInfo { hasNextPage endCursor } } }";
    return execute(
            shop,
            token,
            query,
            Map.of(
                "first",
                clampFirst(requestedFirst),
                "query",
                queryFilter == null ? "" : queryFilter))
        .map(
            root -> {
              JsonNode connection = root.path("data").path("abandonedCheckouts");
              List<Map<String, Object>> checkouts = new ArrayList<>();
              for (JsonNode checkout : connection.path("nodes")) {
                Map<String, Object> mapped = new HashMap<>();
                mapped.put("id", legacyId(checkout.path("id").asText()));
                mapped.put("created_at", checkout.path("createdAt").asText());
                mapped.put(
                    "completed_at",
                    checkout.path("completedAt").isNull()
                        ? null
                        : checkout.path("completedAt").asText());
                checkouts.add(mapped);
              }
              Map<String, Object> result = new HashMap<>();
              result.put("checkouts", checkouts);
              addPageInfo(result, connection.path("pageInfo"));
              result.put("api_transport", "graphql");
              return result;
            });
  }

  private Mono<JsonNode> execute(
      String shop, String token, String query, Map<String, Object> variables) {
    Map<String, Object> body = Map.of("query", query, "variables", variables);
    return webClient
        .post()
        .uri(shopifyConfig.buildGraphqlUrl(shop))
        .contentType(MediaType.APPLICATION_JSON)
        .header("X-Shopify-Access-Token", token)
        .bodyValue(body)
        .retrieve()
        .bodyToMono(JsonNode.class)
        .flatMap(
            root -> {
              JsonNode errors = root.path("errors");
              if (errors.isArray() && !errors.isEmpty()) {
                return Mono.error(new ShopifyGraphqlException(errors.toString()));
              }
              return Mono.just(root);
            });
  }

  private Map<String, Object> mapProducts(JsonNode connection) {
    List<Map<String, Object>> products = new ArrayList<>();
    for (JsonNode product : connection.path("nodes")) {
      List<Map<String, Object>> variants = new ArrayList<>();
      for (JsonNode variant : product.path("variants").path("nodes")) {
        variants.add(
            Map.of(
                "id", legacyId(variant.path("id").asText()),
                "title", variant.path("title").asText(),
                "price", variant.path("price").asText("0"),
                "inventory_quantity", variant.path("inventoryQuantity").asInt(0)));
      }
      Map<String, Object> mapped = new LinkedHashMap<>();
      mapped.put("id", legacyId(product.path("id").asText()));
      mapped.put("title", product.path("title").asText());
      mapped.put("handle", product.path("handle").asText());
      mapped.put("status", product.path("status").asText().toLowerCase());
      mapped.put("created_at", product.path("createdAt").asText());
      mapped.put("updated_at", product.path("updatedAt").asText());
      mapped.put("product_type", product.path("productType").asText());
      mapped.put("vendor", product.path("vendor").asText());
      mapped.put("body_html", product.path("descriptionHtml").asText());
      mapped.put(
          "tags",
          objectMapper.convertValue(product.path("tags"), List.class).stream()
              .map(Object::toString)
              .collect(java.util.stream.Collectors.joining(", ")));
      mapped.put("variants", variants);
      products.add(mapped);
    }
    Map<String, Object> result = new HashMap<>();
    result.put("products", products);
    addPageInfo(result, connection.path("pageInfo"));
    result.put("api_version", shopifyConfig.getApiVersion());
    result.put("api_transport", "graphql");
    return result;
  }

  private Map<String, Object> mapOrders(JsonNode connection) {
    List<Map<String, Object>> orders = new ArrayList<>();
    for (JsonNode order : connection.path("nodes")) {
      Map<String, Object> mapped = new LinkedHashMap<>();
      mapped.put("id", legacyId(order.path("id").asText()));
      mapped.put("name", order.path("name").asText());
      mapped.put("created_at", order.path("createdAt").asText());
      mapped.put(
          "total_price", order.path("totalPriceSet").path("shopMoney").path("amount").asText("0"));
      mapped.put(
          "currency", order.path("totalPriceSet").path("shopMoney").path("currencyCode").asText());
      mapped.put("financial_status", order.path("displayFinancialStatus").asText().toLowerCase());
      mapped.put(
          "fulfillment_status", order.path("displayFulfillmentStatus").asText().toLowerCase());
      if (!order.path("customer").isMissingNode() && !order.path("customer").isNull()) {
        mapped.put("customer", Map.of("id", legacyId(order.path("customer").path("id").asText())));
      }
      orders.add(mapped);
    }
    Map<String, Object> result = new HashMap<>();
    result.put("orders", orders);
    addPageInfo(result, connection.path("pageInfo"));
    result.put("api_version", shopifyConfig.getApiVersion());
    result.put("api_transport", "graphql");
    return result;
  }

  private void addPageInfo(Map<String, Object> result, JsonNode pageInfo) {
    result.put("has_more", pageInfo.path("hasNextPage").asBoolean(false));
    if (!pageInfo.path("endCursor").isNull()) {
      result.put("next_page_info", pageInfo.path("endCursor").asText());
    }
  }

  private int clampFirst(int requestedFirst) {
    return Math.max(1, Math.min(requestedFirst, 250));
  }

  private String legacyId(String gid) {
    int slash = gid.lastIndexOf('/');
    return slash >= 0 ? gid.substring(slash + 1) : gid;
  }

  public static class ShopifyGraphqlException extends RuntimeException {
    public ShopifyGraphqlException(String message) {
      super(message);
    }
  }
}
