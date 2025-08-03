package com.storesight.backend.service.discovery;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.DashboardCacheService;
import com.storesight.backend.service.ShopService;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@ExtendWith(MockitoExtension.class)
class ProductAwareKeywordBuilderTest {

  @Mock private DashboardCacheService dashboardCacheService;

  @Mock private ShopService shopService;

  @Mock private WebClient.Builder webClientBuilder;

  @Mock private WebClient webClient;

  @Mock private WebClient.RequestHeadersUriSpec requestHeadersUriSpec;

  @Mock private WebClient.RequestHeadersSpec requestHeadersSpec;

  @Mock private WebClient.ResponseSpec responseSpec;

  @InjectMocks private ProductAwareKeywordBuilder keywordBuilder;

  private ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  void setUp() {
    ReflectionTestUtils.setField(keywordBuilder, "objectMapper", objectMapper);
    ReflectionTestUtils.setField(keywordBuilder, "maxProductsToAnalyze", 20);
    ReflectionTestUtils.setField(keywordBuilder, "keywordCacheTtlMinutes", 30);
    ReflectionTestUtils.setField(keywordBuilder, "minKeywordFrequency", 2);
  }

  @Test
  void testBuildProductAwareKeywords_WithCachedProducts() throws Exception {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    String sessionId = "test-session";

    String cachedProductsJson =
        """
            {
                "products": [
                    {
                        "title": "Premium Cotton T-Shirt",
                        "product_type": "Apparel",
                        "vendor": "TestBrand",
                        "tags": "cotton,comfortable,casual",
                        "body_html": "<p>High quality cotton t-shirt</p>"
                    },
                    {
                        "title": "Leather Wallet Brown",
                        "product_type": "Accessories",
                        "vendor": "TestBrand",
                        "tags": "leather,wallet,brown",
                        "body_html": "<p>Genuine leather wallet</p>"
                    }
                ]
            }
            """;

    JsonNode cachedData = objectMapper.readTree(cachedProductsJson);
    when(dashboardCacheService.getCachedProductsData(shopDomain))
        .thenReturn(Optional.of(cachedData));

    // When
    String keywords = keywordBuilder.buildProductAwareKeywords(shopDomain, sessionId);

    // Then
    assertNotNull(keywords);
    assertFalse(keywords.trim().isEmpty());
    // The actual output shows: "cotton leather wallet cotton leather brown wallet wear"
    assertTrue(
        keywords.toLowerCase().contains("cotton") || keywords.toLowerCase().contains("leather"));
    assertTrue(
        keywords.toLowerCase().contains("wallet") || keywords.toLowerCase().contains("wear"));

    verify(dashboardCacheService).getCachedProductsData(shopDomain);
    verify(shopService, never()).getTokenForShop(anyString(), anyString());
  }

  @Test
  void testBuildProductAwareKeywords_WithShopifyAPI() throws Exception {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    String sessionId = "test-session";
    String accessToken = "test-token";

    when(dashboardCacheService.getCachedProductsData(shopDomain)).thenReturn(Optional.empty());
    when(shopService.getTokenForShop(shopDomain, sessionId)).thenReturn(accessToken);

    String apiResponse =
        """
            {
                "products": [
                    {
                        "title": "Wireless Bluetooth Headphones",
                        "product_type": "Electronics",
                        "vendor": "TechBrand",
                        "tags": "wireless,bluetooth,audio",
                        "body_html": "<p>High-quality wireless headphones</p>"
                    }
                ]
            }
            """;

    JsonNode responseData = objectMapper.readTree(apiResponse);

    when(webClientBuilder.build()).thenReturn(webClient);
    when(webClient.get()).thenReturn(requestHeadersUriSpec);
    when(requestHeadersUriSpec.uri(anyString())).thenReturn(requestHeadersSpec);
    when(requestHeadersSpec.header(anyString(), anyString())).thenReturn(requestHeadersSpec);
    when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
    when(responseSpec.bodyToMono(JsonNode.class)).thenReturn(Mono.just(responseData));

    // When
    String keywords = keywordBuilder.buildProductAwareKeywords(shopDomain, sessionId);

    // Then
    assertNotNull(keywords);
    assertFalse(keywords.trim().isEmpty());
    assertTrue(
        keywords.toLowerCase().contains("techbrand")
            || keywords.toLowerCase().contains("wireless"));

    verify(dashboardCacheService).getCachedProductsData(shopDomain);
    verify(shopService).getTokenForShop(shopDomain, sessionId);
    verify(dashboardCacheService).cacheProductsData(eq(shopDomain), any());
  }

  @Test
  void testBuildProductAwareKeywords_NoProducts_FallbackToGeneric() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    String sessionId = "test-session";

    when(dashboardCacheService.getCachedProductsData(shopDomain)).thenReturn(Optional.empty());
    when(shopService.getTokenForShop(shopDomain, sessionId)).thenReturn(null);

    // When
    String keywords = keywordBuilder.buildProductAwareKeywords(shopDomain, sessionId);

    // Then
    assertNotNull(keywords);
    assertFalse(keywords.trim().isEmpty());
    assertTrue(keywords.contains("shop") || keywords.contains("store"));

    verify(dashboardCacheService).getCachedProductsData(shopDomain);
    verify(shopService).getTokenForShop(shopDomain, sessionId);
  }

  @Test
  void testBuildProductAwareKeywords_APIError_FallbackToGeneric() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    String sessionId = "test-session";
    String accessToken = "test-token";

    when(dashboardCacheService.getCachedProductsData(shopDomain)).thenReturn(Optional.empty());
    when(shopService.getTokenForShop(shopDomain, sessionId)).thenReturn(accessToken);

    when(webClientBuilder.build()).thenReturn(webClient);
    when(webClient.get()).thenReturn(requestHeadersUriSpec);
    when(requestHeadersUriSpec.uri(anyString())).thenReturn(requestHeadersSpec);
    when(requestHeadersSpec.header(anyString(), anyString())).thenReturn(requestHeadersSpec);
    when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
    when(responseSpec.bodyToMono(JsonNode.class))
        .thenReturn(Mono.error(new RuntimeException("API Error")));

    // When
    String keywords = keywordBuilder.buildProductAwareKeywords(shopDomain, sessionId);

    // Then
    assertNotNull(keywords);
    assertFalse(keywords.trim().isEmpty());
    assertTrue(keywords.contains("shop") || keywords.contains("store"));
  }

  @Test
  void testKeywordExtraction_WithSpecialPatterns() throws Exception {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    String sessionId = "test-session";

    String cachedProductsJson =
        """
            {
                "products": [
                    {
                        "title": "Red Cotton T-Shirt Size L",
                        "product_type": "Apparel",
                        "vendor": "FashionBrand",
                        "tags": "red,cotton,large,comfortable",
                        "body_html": "<p>Premium red cotton t-shirt in large size</p>"
                    },
                    {
                        "title": "Black Leather Jacket XL",
                        "product_type": "Outerwear",
                        "vendor": "FashionBrand",
                        "tags": "black,leather,xl,jacket",
                        "body_html": "<p>Genuine black leather jacket</p>"
                    }
                ]
            }
            """;

    JsonNode cachedData = objectMapper.readTree(cachedProductsJson);
    when(dashboardCacheService.getCachedProductsData(shopDomain))
        .thenReturn(Optional.of(cachedData));

    // When
    String keywords = keywordBuilder.buildProductAwareKeywords(shopDomain, sessionId);

    // Then
    assertNotNull(keywords);
    // The actual output shows: "cotton red black cotton black leather apparel wear xl"
    assertTrue(keywords.toLowerCase().contains("red") || keywords.toLowerCase().contains("black"));
    assertTrue(
        keywords.toLowerCase().contains("cotton") || keywords.toLowerCase().contains("leather"));
    assertTrue(
        keywords.toLowerCase().contains("apparel") || keywords.toLowerCase().contains("wear"));
  }

  @Test
  void testKeywordWeighting_BrandPriority() throws Exception {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    String sessionId = "test-session";

    String cachedProductsJson =
        """
            {
                "products": [
                    {
                        "title": "Nike Running Shoes",
                        "product_type": "Footwear",
                        "vendor": "Nike",
                        "tags": "running,shoes,athletic",
                        "body_html": "<p>Nike athletic running shoes</p>"
                    },
                    {
                        "title": "Nike Basketball Shoes",
                        "product_type": "Footwear",
                        "vendor": "Nike",
                        "tags": "basketball,shoes,athletic",
                        "body_html": "<p>Nike basketball shoes</p>"
                    },
                    {
                        "title": "Nike Training Gear",
                        "product_type": "Apparel",
                        "vendor": "Nike",
                        "tags": "training,athletic,gear",
                        "body_html": "<p>Nike training equipment</p>"
                    }
                ]
            }
            """;

    JsonNode cachedData = objectMapper.readTree(cachedProductsJson);
    when(dashboardCacheService.getCachedProductsData(shopDomain))
        .thenReturn(Optional.of(cachedData));

    // When
    String keywords = keywordBuilder.buildProductAwareKeywords(shopDomain, sessionId);

    // Then
    assertNotNull(keywords);
    assertTrue(keywords.toLowerCase().contains("nike"));
    assertTrue(
        keywords.toLowerCase().contains("shoes") || keywords.toLowerCase().contains("athletic"));

    // Nike should appear early in the keywords due to high frequency
    String[] keywordArray = keywords.toLowerCase().split("\\s+");
    boolean nikeFoundEarly = false;
    for (int i = 0; i < Math.min(5, keywordArray.length); i++) {
      if (keywordArray[i].contains("nike")) {
        nikeFoundEarly = true;
        break;
      }
    }
    assertTrue(nikeFoundEarly, "Brand keyword 'nike' should appear early in keyword string");
  }
}
