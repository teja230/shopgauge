package com.storesight.backend.service;

import com.storesight.backend.dto.ProductInterestRequest;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class ProductValidationService {
  private static final String KEY_PREFIX = "product-validation:interest:";
  private final StringRedisTemplate redisTemplate;
  private final MeterRegistry meterRegistry;

  public ProductValidationService(StringRedisTemplate redisTemplate, MeterRegistry meterRegistry) {
    this.redisTemplate = redisTemplate;
    this.meterRegistry = meterRegistry;
  }

  public void recordInterest(ProductInterestRequest request) {
    String plan = request.plan();
    Counter.builder("storesight.product.interest")
        .description("Anonymous pricing-plan interest selections")
        .tag("plan", plan)
        .tag("listing_band", request.monitoredListingsBand())
        .register(meterRegistry)
        .increment();

    String dailyKey = KEY_PREFIX + LocalDate.now();
    redisTemplate.opsForHash().increment(dailyKey, "plan:" + plan, 1L);
    redisTemplate.opsForHash().increment(dailyKey, "band:" + request.monitoredListingsBand(), 1L);
    redisTemplate.expire(dailyKey, Duration.ofDays(180));
  }

  public Map<String, Long> getTodaySummary() {
    Map<Object, Object> values = redisTemplate.opsForHash().entries(KEY_PREFIX + LocalDate.now());
    Map<String, Long> result = new LinkedHashMap<>();
    values.forEach((key, value) -> result.put(key.toString(), Long.parseLong(value.toString())));
    return result;
  }
}
