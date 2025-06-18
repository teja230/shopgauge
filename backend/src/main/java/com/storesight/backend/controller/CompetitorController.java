package com.storesight.backend.controller;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class CompetitorController {
  @Autowired private JdbcTemplate jdbcTemplate;

  @GetMapping("/competitors")
  public List<CompetitorDto> getCompetitors() {
    List<Map<String, Object>> rows =
        jdbcTemplate.queryForList("SELECT * FROM competitor_urls WHERE product_id=1");
    return rows.stream()
        .map(
            row ->
                new CompetitorDto(
                    String.valueOf(row.get("id")),
                    String.valueOf(row.get("url")),
                    18.99, // TODO: join with price_snapshots for real price
                    true, // TODO: join with price_snapshots for real inStock
                    0.0, // TODO: calculate percentDiff
                    "2025-06-17T16:54:02.307+00:00" // TODO: use real lastChecked
                    ))
        .collect(Collectors.toList());
  }

  public static class CompetitorDto {
    public String id;
    public String url;
    public double price;
    public boolean inStock;
    public double percentDiff;
    public String lastChecked;

    public CompetitorDto(
        String id,
        String url,
        double price,
        boolean inStock,
        double percentDiff,
        String lastChecked) {
      this.id = id;
      this.url = url;
      this.price = price;
      this.inStock = inStock;
      this.percentDiff = percentDiff;
      this.lastChecked = lastChecked;
    }
  }
}
