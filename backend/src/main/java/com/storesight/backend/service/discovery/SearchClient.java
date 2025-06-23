package com.storesight.backend.service.discovery;

import java.util.List;

/** Interface for external search providers used in competitor discovery */
public interface SearchClient {

  /**
   * Search for products using the provided keywords
   *
   * @param keywords The search query keywords
   * @param maxResults Maximum number of results to return
   * @return List of search results
   */
  List<SearchResult> search(String keywords, int maxResults);

  /**
   * Check if the search client is enabled and configured
   *
   * @return true if the client can be used for searches
   */
  boolean isEnabled();

  /**
   * Get the provider name
   *
   * @return Name of the search provider
   */
  String getProviderName();

  /** Represents a search result from the external provider */
  class SearchResult {
    private final String title;
    private final String url;
    private final Double price;
    private final String source;

    public SearchResult(String title, String url, Double price, String source) {
      this.title = title;
      this.url = url;
      this.price = price;
      this.source = source;
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

    public String getSource() {
      return source;
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
          + ", source='"
          + source
          + '\''
          + '}';
    }
  }
}
