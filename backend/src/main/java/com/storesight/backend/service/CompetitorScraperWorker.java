package com.storesight.backend.service;

import java.util.List;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Profile("worker")
public class CompetitorScraperWorker {
  private static final Logger log = LoggerFactory.getLogger(CompetitorScraperWorker.class);
  private final RedisTemplate<String, Object> redisTemplate;
  private WebDriver driver;
  @Autowired private AlertService alertService;

  public CompetitorScraperWorker(
      RedisTemplate<String, Object> redisTemplate,
      @Value("${selenium.enabled:false}") boolean seleniumEnabled) {
    this.redisTemplate = redisTemplate;
    if (seleniumEnabled) {
      ChromeOptions options = new ChromeOptions();
      options.addArguments("--headless", "--no-sandbox");
      this.driver = new ChromeDriver(options);
    }
  }

  @Scheduled(cron = "0 15 2 * * *")
  public void scrapeCompetitors() {
    log.info("[Worker] Starting competitor scrape job");
    // TODO: Fetch active competitor URLs from DB
    List<String> urls = List.of(); // placeholder
    for (String url : urls) {
      try {
        boolean requiresJs = false; // TODO: fetch from DB
        double price = 0.0;
        boolean inStock = true;
        if (requiresJs && driver != null) {
          driver.get(url);
          String html = driver.getPageSource();
          Document doc = Jsoup.parse(html);
          // TODO: parse price/inStock from doc
        } else {
          Document doc = Jsoup.connect(url).get();
          // TODO: parse price/inStock from doc
        }
        // TODO: Persist price_snapshots
        // TODO: If price/inStock triggers alert, enqueue to Redis
        // When a price change is detected:
        // alertService.triggerBusinessEvent(shop, "Competitor Price Change", "Competitor price
        // changed for product X: $oldPrice -> $newPrice");
      } catch (Exception e) {
        log.error("Failed to scrape {}: {}", url, e.getMessage());
      }
    }
  }
}
