package com.storesight.backend.service.discovery;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Advanced keyword builder for competitor discovery. Generates intelligent search keywords from
 * product titles, descriptions, and categories.
 */
@Service
public class KeywordBuilder {

  private static final Logger log = LoggerFactory.getLogger(KeywordBuilder.class);

  // Common stop words to exclude from keywords
  private static final Set<String> STOP_WORDS =
      Set.of(
          "the",
          "and",
          "or",
          "but",
          "in",
          "on",
          "at",
          "to",
          "for",
          "of",
          "with",
          "by",
          "a",
          "an",
          "this",
          "that",
          "these",
          "those",
          "is",
          "are",
          "was",
          "were",
          "be",
          "been",
          "being",
          "have",
          "has",
          "had",
          "do",
          "does",
          "did",
          "will",
          "would",
          "could",
          "should",
          "may",
          "might",
          "must",
          "can",
          "shall",
          "size",
          "color",
          "colour",
          "new",
          "used",
          "brand",
          "item",
          "product",
          "available",
          "stock",
          "price",
          "sale",
          "buy",
          "purchase",
          "order");

  // Common e-commerce words that should be included
  private static final Set<String> IMPORTANT_WORDS =
      Set.of(
          "premium",
          "professional",
          "deluxe",
          "ultimate",
          "advanced",
          "pro",
          "max",
          "plus",
          "mini",
          "micro",
          "mega",
          "super",
          "extra",
          "xl",
          "xxl",
          "small",
          "medium",
          "large",
          "wireless",
          "bluetooth",
          "usb",
          "digital",
          "smart",
          "auto",
          "manual",
          "portable",
          "rechargeable",
          "waterproof",
          "outdoor",
          "indoor",
          "men",
          "women",
          "kids",
          "baby",
          "home",
          "kitchen",
          "office",
          "gaming",
          "sports",
          "fitness",
          "health",
          "beauty");

  // Patterns for extracting meaningful words
  private static final Pattern WORD_PATTERN = Pattern.compile("[a-zA-Z0-9]+");
  private static final Pattern BRAND_PATTERN = Pattern.compile("\\b[A-Z][a-z]+\\b");
  private static final Pattern MODEL_PATTERN = Pattern.compile("\\b[A-Z0-9]{2,}\\b");

  /** Build competitor keywords from product information */
  public String buildCompetitorKeywords(String productTitle, String description, String category) {
    log.debug("Building keywords for product: {}", productTitle);

    Set<String> keywords = new HashSet<>();

    // Extract keywords from title (most important)
    if (productTitle != null && !productTitle.trim().isEmpty()) {
      keywords.addAll(extractKeywords(productTitle, 1.0));
    }

    // Extract keywords from description (medium importance)
    if (description != null && !description.trim().isEmpty()) {
      keywords.addAll(extractKeywords(description, 0.6));
    }

    // Extract keywords from category (high importance)
    if (category != null && !category.trim().isEmpty()) {
      keywords.addAll(extractKeywords(category, 0.8));
    }

    // Build final keyword string
    String keywordString =
        keywords.stream()
            .limit(10) // Limit to top 10 keywords for cost efficiency
            .collect(Collectors.joining(" "));

    log.debug("Generated keywords: {}", keywordString);
    return keywordString;
  }

  /** Extract keywords from text with importance weighting */
  protected Set<String> extractKeywords(String text, double importance) {
    Set<String> keywords = new HashSet<>();

    if (text == null || text.trim().isEmpty()) {
      return keywords;
    }

    // Clean and normalize text
    String cleanText =
        text.toLowerCase().replaceAll("[^a-zA-Z0-9\\s]", " ").replaceAll("\\s+", " ").trim();

    // Extract words
    String[] words = cleanText.split("\\s+");

    for (String word : words) {
      if (isValidKeyword(word)) {
        keywords.add(word);
      }
    }

    // Extract brand names (capitalize first letter)
    keywords.addAll(extractBrandNames(text));

    // Extract model numbers
    keywords.addAll(extractModelNumbers(text));

    // Add category-specific keywords
    keywords.addAll(getCategoryKeywords(text));

    return keywords;
  }

  /** Check if a word is a valid keyword */
  protected boolean isValidKeyword(String word) {
    if (word == null || word.length() < 3) {
      return false;
    }

    word = word.toLowerCase();

    // Skip stop words
    if (STOP_WORDS.contains(word)) {
      return false;
    }

    // Include important words
    if (IMPORTANT_WORDS.contains(word)) {
      return true;
    }

    // Include words that are not too common
    return !isCommonWord(word);
  }

  /** Check if a word is too common */
  private boolean isCommonWord(String word) {
    // Add more common words that should be filtered out
    Set<String> commonWords =
        Set.of(
            "get", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
            "now", "also", "just", "like", "make", "made", "way", "use", "used", "good", "best",
            "great", "nice", "free", "easy", "fast", "quick", "high", "low", "old", "new");

    return commonWords.contains(word.toLowerCase());
  }

  /** Extract brand names from text */
  private Set<String> extractBrandNames(String text) {
    Set<String> brands = new HashSet<>();

    // Look for capitalized words that might be brand names
    String[] words = text.split("\\s+");
    for (String word : words) {
      if (word.length() > 2 && Character.isUpperCase(word.charAt(0))) {
        // Clean the word
        String cleanWord = word.replaceAll("[^a-zA-Z0-9]", "");
        if (cleanWord.length() > 2 && !STOP_WORDS.contains(cleanWord.toLowerCase())) {
          brands.add(cleanWord);
        }
      }
    }

    return brands;
  }

  /** Extract model numbers from text */
  private Set<String> extractModelNumbers(String text) {
    Set<String> models = new HashSet<>();

    // Look for alphanumeric patterns that might be model numbers
    String[] words = text.split("\\s+");
    for (String word : words) {
      String cleanWord = word.replaceAll("[^a-zA-Z0-9]", "");
      if (cleanWord.length() >= 3
          && cleanWord.matches(".*\\d.*")
          && cleanWord.matches(".*[a-zA-Z].*")) {
        models.add(cleanWord);
      }
    }

    return models;
  }

  /** Get category-specific keywords */
  private Set<String> getCategoryKeywords(String text) {
    Set<String> categoryKeywords = new HashSet<>();
    String lowerText = text.toLowerCase();

    // Electronics
    if (lowerText.contains("electronic")
        || lowerText.contains("gadget")
        || lowerText.contains("device")
        || lowerText.contains("tech")) {
      categoryKeywords.addAll(Arrays.asList("electronics", "gadgets", "devices", "tech"));
    }

    // Fashion
    if (lowerText.contains("clothing")
        || lowerText.contains("apparel")
        || lowerText.contains("fashion")
        || lowerText.contains("wear")) {
      categoryKeywords.addAll(Arrays.asList("clothing", "apparel", "fashion", "wear"));
    }

    // Home & Garden
    if (lowerText.contains("home")
        || lowerText.contains("garden")
        || lowerText.contains("furniture")
        || lowerText.contains("decor")) {
      categoryKeywords.addAll(Arrays.asList("home", "garden", "furniture", "decor"));
    }

    // Sports & Outdoors
    if (lowerText.contains("sports")
        || lowerText.contains("outdoor")
        || lowerText.contains("fitness")
        || lowerText.contains("exercise")) {
      categoryKeywords.addAll(Arrays.asList("sports", "outdoor", "fitness", "exercise"));
    }

    // Beauty & Health
    if (lowerText.contains("beauty")
        || lowerText.contains("health")
        || lowerText.contains("skincare")
        || lowerText.contains("makeup")) {
      categoryKeywords.addAll(Arrays.asList("beauty", "health", "skincare", "makeup"));
    }

    return categoryKeywords;
  }

  /** Build keywords for Google Shopping search */
  public String buildGoogleShoppingKeywords(
      String productTitle, String description, String category) {
    String baseKeywords = buildCompetitorKeywords(productTitle, description, category);

    // Add Google Shopping specific terms
    return baseKeywords + " buy online shop price compare";
  }

  /** Build keywords for Amazon search */
  public String buildAmazonKeywords(String productTitle, String description, String category) {
    String baseKeywords = buildCompetitorKeywords(productTitle, description, category);

    // Add Amazon specific terms
    return baseKeywords + " amazon prime delivery";
  }

  /** Build keywords for general web search */
  public String buildWebSearchKeywords(String productTitle, String description, String category) {
    String baseKeywords = buildCompetitorKeywords(productTitle, description, category);

    // Add general web search terms
    return baseKeywords + " store retail purchase";
  }

  /** Analyze keyword quality and suggest improvements */
  public KeywordAnalysis analyzeKeywords(String keywords) {
    String[] words = keywords.split("\\s+");

    int totalWords = words.length;
    int brandWords = 0;
    int modelWords = 0;
    int categoryWords = 0;
    int stopWords = 0;

    for (String word : words) {
      if (STOP_WORDS.contains(word.toLowerCase())) {
        stopWords++;
      } else if (IMPORTANT_WORDS.contains(word.toLowerCase())) {
        categoryWords++;
      } else if (word.matches(".*\\d.*") && word.matches(".*[a-zA-Z].*")) {
        modelWords++;
      } else if (Character.isUpperCase(word.charAt(0))) {
        brandWords++;
      }
    }

    double quality =
        calculateKeywordQuality(totalWords, brandWords, modelWords, categoryWords, stopWords);

    return new KeywordAnalysis(
        totalWords, brandWords, modelWords, categoryWords, stopWords, quality);
  }

  /** Calculate keyword quality score */
  private double calculateKeywordQuality(
      int total, int brands, int models, int categories, int stopWords) {
    if (total == 0) return 0.0;

    double brandScore = (double) brands / total * 0.3;
    double modelScore = (double) models / total * 0.2;
    double categoryScore = (double) categories / total * 0.3;
    double stopWordPenalty = (double) stopWords / total * 0.2;

    return Math.max(0.0, brandScore + modelScore + categoryScore - stopWordPenalty);
  }

  /** Keyword analysis result */
  public static class KeywordAnalysis {
    private final int totalWords;
    private final int brandWords;
    private final int modelWords;
    private final int categoryWords;
    private final int stopWords;
    private final double quality;

    public KeywordAnalysis(
        int totalWords,
        int brandWords,
        int modelWords,
        int categoryWords,
        int stopWords,
        double quality) {
      this.totalWords = totalWords;
      this.brandWords = brandWords;
      this.modelWords = modelWords;
      this.categoryWords = categoryWords;
      this.stopWords = stopWords;
      this.quality = quality;
    }

    // Getters
    public int getTotalWords() {
      return totalWords;
    }

    public int getBrandWords() {
      return brandWords;
    }

    public int getModelWords() {
      return modelWords;
    }

    public int getCategoryWords() {
      return categoryWords;
    }

    public int getStopWords() {
      return stopWords;
    }

    public double getQuality() {
      return quality;
    }

    public boolean isHighQuality() {
      return quality > 0.7;
    }

    public boolean isMediumQuality() {
      return quality > 0.4;
    }

    public boolean isLowQuality() {
      return quality <= 0.4;
    }
  }
}
