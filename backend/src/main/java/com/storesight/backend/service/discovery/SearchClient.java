package com.storesight.backend.service.discovery;

import java.util.List;
import java.util.Map;

/** Interface for search API clients that support competitor discovery */
public interface SearchClient {

  /** Search result returned by the API */
  class SearchResult {
    private String url;
    private String title;
    private Double price;
    private String description;
    private String provider; // Track which API provided this result

    public SearchResult(String url, String title, Double price, String description) {
      this.url = url;
      this.title = title;
      this.price = price;
      this.description = description;
    }

    // Getters
    public String getTitle() {
      return title;
    }

    public String getUrl() {
      return url;
    }

    public Double getPrice() {
      return price;
    }

    public String getDescription() {
      return description;
    }

    public String getProvider() {
      return provider;
    }

    public void setProvider(String provider) {
      this.provider = provider;
    }

    @Override
    public String toString() {
      return "SearchResult{"
          + "title='"
          + title
          + '\''
          + ", url='"
          + url
          + '\''
          + ", price="
          + price
          + ", description='"
          + description
          + '\''
          + ", provider='"
          + provider
          + '\''
          + '}';
    }
  }

  /** Search for competitors using keywords */
  List<SearchResult> search(String keywords, int maxResults);

  /** Check if the search client is properly configured and enabled */
  boolean isEnabled();

  /** Get the provider name for logging/debugging */
  String getProviderName();

  /** Get the cost per search for this provider */
  double getCostPerSearch();

  /** Get priority level (lower number = higher priority) */
  int getPriority();

  /** Check if provider supports the required volume */
  boolean supportsVolume(int requestsPerDay);

  /** Get provider-specific configuration */
  Map<String, Object> getProviderConfig();
}
