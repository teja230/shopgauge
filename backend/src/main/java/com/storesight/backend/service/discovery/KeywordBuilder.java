package com.storesight.backend.service.discovery;

import java.util.*;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Service to build search keywords from product information */
@Component
public class KeywordBuilder {

  private static final Logger log = LoggerFactory.getLogger(KeywordBuilder.class);

  // Common words to exclude from keywords
  private static final Set<String> STOP_WORDS =
      Set.of(
          "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he", "in", "is",
          "it", "its", "of", "on", "that", "the", "to", "was", "will", "with", "or", "but");

  // Words that are too generic for good search results
  private static final Set<String> GENERIC_WORDS =
      Set.of(
          "product",
          "item",
          "thing",
          "stuff",
          "goods",
          "best",
          "top",
          "new",
          "sale",
          "discount",
          "cheap",
          "buy",
          "shop",
          "store",
          "online",
          "free",
          "shipping",
          "delivery");

  /**
   * Build search keywords from product title and tags
   *
   * @param productTitle The product title
   * @param productTags List of product tags (can be null)
   * @param brandName Brand name to include (can be null)
   * @param maxWords Maximum number of words to include in the final keyword string
   * @return Optimized keyword string for search
   */
  public String buildKeywords(
      String productTitle, List<String> productTags, String brandName, int maxWords) {
    Set<String> keywords = new LinkedHashSet<>();

    // Add brand name first if available
    if (brandName != null && !brandName.trim().isEmpty()) {
      keywords.add(cleanWord(brandName));
    }

    // Process product title
    if (productTitle != null) {
      List<String> titleWords = extractSignificantWords(productTitle);
      keywords.addAll(
          titleWords.stream()
              .limit(Math.max(1, maxWords - keywords.size()))
              .collect(Collectors.toList()));
    }

    // Add relevant tags if we have space
    if (productTags != null && keywords.size() < maxWords) {
      List<String> cleanTags =
          productTags.stream()
              .filter(tag -> tag != null && !tag.trim().isEmpty())
              .map(this::cleanWord)
              .filter(tag -> !tag.isEmpty() && !GENERIC_WORDS.contains(tag.toLowerCase()))
              .limit(maxWords - keywords.size())
              .collect(Collectors.toList());
      keywords.addAll(cleanTags);
    }

    String result = String.join(" ", keywords).trim();
    log.debug("Built keywords for '{}': '{}'", productTitle, result);

    return result;
  }

  /** Build keywords with default parameters */
  public String buildKeywords(String productTitle, List<String> productTags, String brandName) {
    return buildKeywords(productTitle, productTags, brandName, 6);
  }

  /** Build keywords with just title and brand */
  public String buildKeywords(String productTitle, String brandName) {
    return buildKeywords(productTitle, null, brandName, 6);
  }

  /** Extract significant words from a product title */
  private List<String> extractSignificantWords(String title) {
    if (title == null || title.trim().isEmpty()) {
      return List.of();
    }

    // Split by common delimiters and clean
    String[] words =
        title
            .toLowerCase()
            .replaceAll("[^a-zA-Z0-9\\s-]", " ") // Remove special chars except hyphens
            .split("\\s+");

    return Arrays.stream(words)
        .map(this::cleanWord)
        .filter(word -> !word.isEmpty())
        .filter(word -> word.length() > 2) // Remove very short words
        .filter(word -> !STOP_WORDS.contains(word))
        .filter(word -> !GENERIC_WORDS.contains(word))
        .filter(word -> !isNumericOnly(word)) // Remove pure numbers
        .distinct()
        .collect(Collectors.toList());
  }

  /** Clean and normalize a word */
  private String cleanWord(String word) {
    if (word == null) return "";

    return word.trim()
        .toLowerCase()
        .replaceAll("[^a-zA-Z0-9-]", "") // Keep alphanumeric and hyphens
        .replaceAll("^-+|-+$", ""); // Remove leading/trailing hyphens
  }

  /** Check if a word is purely numeric */
  private boolean isNumericOnly(String word) {
    return word.matches("^\\d+$");
  }

  /**
   * Build keywords specifically for competitor discovery This version is more focused on finding
   * similar products
   */
  public String buildCompetitorKeywords(
      String productTitle, List<String> productTags, String brandName) {
    // For competitor discovery, we want to be more specific
    // Include brand but also generic terms that help find alternatives
    Set<String> keywords = new LinkedHashSet<>();

    // Add core product words (without brand to find competitors)
    if (productTitle != null) {
      List<String> titleWords = extractSignificantWords(productTitle);
      keywords.addAll(titleWords.stream().limit(4).collect(Collectors.toList()));
    }

    // Add the most relevant tag
    if (productTags != null && !productTags.isEmpty()) {
      productTags.stream()
          .filter(tag -> tag != null && !tag.trim().isEmpty())
          .map(this::cleanWord)
          .filter(tag -> !tag.isEmpty() && !GENERIC_WORDS.contains(tag.toLowerCase()))
          .findFirst()
          .ifPresent(keywords::add);
    }

    String result = String.join(" ", keywords).trim();
    log.debug("Built competitor keywords for '{}': '{}'", productTitle, result);

    return result;
  }
}
