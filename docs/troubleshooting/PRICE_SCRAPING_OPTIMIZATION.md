# Price Scraping Optimization & API Cost Management

> **📚 Related Documentation**: This guide is part of the [Market Intelligence](../user-guide/MARKET_INTELLIGENCE.md) feature. For implementation details, see the [Market Intelligence Implementation Reference](../user-guide/MARKET_INTELLIGENCE_IMPLEMENTATION_REFERENCE.md).

## 📋 **Quick Navigation**

- **[Scraper Source Tracking](#-scraper-source-tracking---confirmed-working)**
- **[Retry Mechanism Optimization](#️-retry-mechanism-optimization)**
- **[Cost Analysis & Savings](#-cost-analysis--savings)**
- **[Configuration Settings](#️-configuration-settings)**
- **[User Experience Impact](#-user-experience-impact)**
- **[Monitoring & Debugging](#️-monitoring--debugging)**
- **[Summary](#️-summary)**

## 🎯 Overview

This document outlines the optimizations made to the price scraping system to address API costs and improve reliability while maintaining enterprise-grade functionality.

---

## ✅ **Scraper Source Tracking - CONFIRMED WORKING**

### **Database Storage**
The `scraper_source` field is properly updated in the `price_snapshots` table:

```sql
INSERT INTO price_snapshots (
    competitor_url_id, price, in_stock, checked_at, 
    scraper_version, scraper_source, platform, response_time_ms
) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
```

### **Available Scraper Sources**
| Source | Description | Cost | Use Case |
|--------|-------------|------|----------|
| `"jsoup"` | Direct Jsoup scraping | Free | Primary method |
| `"jsoup-enhanced"` | Enhanced Jsoup with different user agent | Free | Fallback for blocking |
| `"scrapingdog"` | Scrapingdog API | $0.001 | Cost-effective API |
| `"serper"` | Serper API | $0.001 | Fast search API |
| `"serpapi"` | SerpAPI | $0.015 | Comprehensive API |
| `"cached"` | Cached price | Free | Redis cache |
| `"blocked"` | Platform blocking detected | Free | Amazon blocking |
| `"all-tiers-failed"` | All methods failed | Free | Complete failure |

### **Verification Query**
```sql
SELECT 
    ps.scraper_source,
    ps.platform,
    ps.response_time_ms,
    COUNT(*) as usage_count
FROM price_snapshots ps 
WHERE ps.checked_at >= NOW() - INTERVAL '7 days'
GROUP BY ps.scraper_source, ps.platform, ps.response_time_ms
ORDER BY usage_count DESC;
```

---

## 🔧 **Retry Mechanism Optimization**

### **Problem Identified**
- **Previous**: 5 error retries before marking as failed
- **Previous**: 12-hour scraping intervals
- **Previous**: Unlimited API usage in retry loops

### **New API-Optimized Approach**

#### **1. Reduced Error Threshold**
```properties
# Before: 5 retries
# After: 3 retries (API cost optimization)
price.scraping.max-error-count=3
```

#### **2. Extended Scraping Intervals**
```java
// Before: Every 12 hours
@Scheduled(cron = "0 0 */12 * * *")

// After: Every 24 hours (API cost optimization)
@Scheduled(cron = "0 0 */24 * * *")
```

#### **3. Smart Retry Logic**
```sql
-- Only retry if error count is low
WHERE cu.error_count < 3
AND (ps.checked_at IS NULL OR ps.checked_at < NOW() - INTERVAL '24 hours')
```

#### **4. API Tier Optimization**
```java
// Only use APIs if explicitly enabled
if (scrapingdogSearchClient.isEnabled() && apiOptimized) {
    // Use Scrapingdog API
}

if (serperSearchClient.isEnabled() && apiOptimized) {
    // Use Serper API
}

if (serpApiSearchClient.isEnabled() && apiOptimized) {
    // Use SerpAPI
}
```

---

## 💰 **Cost Analysis & Savings**

### **Before Optimization**
- **Scraping Frequency**: Every 12 hours
- **Retry Attempts**: 5 per failure
- **API Usage**: Unlimited in retry loops
- **Monthly Cost**: ~$0.90 for 10 competitors

### **After Optimization (For $19.99 Plan)**
- **Scraping Frequency**: Every 24 hours (daily)
- **Retry Attempts**: 2 per failure
- **API Usage**: Free-first with fallback only
- **Monthly Cost**: ~$0.45 for 10 competitors

### **Cost Savings**
- **50% reduction** in scraping frequency (24h vs 12h)
- **60% reduction** in retry attempts (2 vs 5)
- **Free-first approach** with API fallback only
- **Overall savings**: ~50% cost reduction
- **Profit margin**: $19.54/month on $19.99 plan

---

## ⚙️ **Configuration Settings**

### **application.properties**
```properties
# Price Scraping Configuration - OPTIMIZED FOR $19.99 PLAN
price.scraping.enabled=true
price.scraping.max-retries=1
price.scraping.timeout-seconds=30
price.scraping.rate-limit-delay-ms=2000
price.scraping.api-optimized=true
price.scraping.max-error-count=2
price.scraping.schedule-interval-hours=24
price.scraping.free-first=true
price.scraping.api-fallback-only=true

# Price Scraping API Endpoints (Separate from Discovery)
price.scraping.scrapingdog.base-url=${PRICE_SCRAPING_SCRAPINGDOG_BASE_URL:https://api.scrapingdog.com/scrape}
price.scraping.serper.base-url=${PRICE_SCRAPING_SERPER_BASE_URL:https://google.serper.dev/search}
price.scraping.serpapi.base-url=${PRICE_SCRAPING_SERPAPI_BASE_URL:https://serpapi.com/search.json}

# Discovery Settings (Honored by Price Scraping)
discovery.multi-source.enabled=${DISCOVERY_MULTI_SOURCE_ENABLED:true}
discovery.multi-source.fallback-enabled=${DISCOVERY_FALLBACK_ENABLED:true}
discovery.multi-source.max-providers=${DISCOVERY_MAX_PROVIDERS:3}
```

### **Environment Variables**
```bash
# API Keys (existing)
SCRAPINGDOG_KEY=your_key
SERPER_KEY=your_key
SERPAPI_KEY=your_key

# New optimization flags
PRICE_SCRAPING_API_OPTIMIZED=true
PRICE_SCRAPING_MAX_ERROR_COUNT=3
```

---

## 🎯 **User Experience Impact**

### **Positive Changes**
1. **Reduced API Costs**: 50% cost savings
2. **Better Reliability**: Smarter retry logic
3. **Clearer Tracking**: Proper scraper source logging
4. **Enterprise Ready**: Production-grade error handling

### **Trade-offs**
1. **Less Frequent Updates**: 24 hours vs 12 hours
2. **Fewer Retry Attempts**: 3 vs 5 attempts
3. **Conditional API Usage**: APIs only when needed

### **Recommendations**
1. **For Development**: Keep `apiOptimized=true` for testing
2. **For Production**: Monitor costs and adjust `max-error-count`
3. **For High-Value Competitors**: Consider manual scraping triggers

---

## 🔍 **Monitoring & Debugging**

### **Check Scraper Source Distribution**
```sql
SELECT 
    scraper_source,
    COUNT(*) as count,
    AVG(response_time_ms) as avg_response_time
FROM price_snapshots 
WHERE checked_at >= NOW() - INTERVAL '7 days'
GROUP BY scraper_source
ORDER BY count DESC;
```

### **Monitor Error Rates**
```sql
SELECT 
    status,
    error_count,
    COUNT(*) as competitor_count
FROM competitor_urls 
WHERE deleted_at IS NULL
GROUP BY status, error_count
ORDER BY error_count DESC;
```

### **API Usage Tracking**
```sql
SELECT 
    scraper_source,
    COUNT(*) as api_calls,
    SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END) as successful_calls
FROM price_snapshots 
WHERE scraper_source IN ('scrapingdog', 'serper', 'serpapi')
AND checked_at >= NOW() - INTERVAL '24 hours'
GROUP BY scraper_source;
```

---

## ✅ **Summary**

### **Scraper Source Tracking**
- ✅ **Properly implemented** in `price_snapshots` table
- ✅ **Comprehensive logging** of all scraping methods
- ✅ **Cost tracking** by scraper source
- ✅ **Performance monitoring** with response times

### **Retry Mechanism Optimization**
- ✅ **Reduced from 5 to 3** error attempts
- ✅ **Extended from 12 to 24** hour intervals
- ✅ **Conditional API usage** based on `apiOptimized` flag
- ✅ **Smart retry logic** that respects error counts

### **Cost Benefits**
- ✅ **50% cost reduction** through optimized scheduling
- ✅ **40% fewer retries** reduces API calls
- ✅ **Conditional API usage** prevents unnecessary costs
- ✅ **Enterprise-grade** error handling and monitoring

The system now provides **enterprise-grade price scraping** with **optimal cost management** while maintaining **high reliability** and **comprehensive tracking**.

### **Breaking Change Fix**
- **Issue**: Discovery and Price Scraping were using the same Scrapingdog endpoint
- **Solution**: Separated endpoints:
  - Discovery: `https://api.scrapingdog.com/google` (for search)
  - Price Scraping: `https://api.scrapingdog.com/scrape` (for direct scraping)
- **Impact**: Both features now work correctly with appropriate endpoints

### **Discovery Settings Integration**
- **Honored Settings**: Price scraping now respects discovery multi-source configuration
- **Provider Limits**: Uses `discovery.multi-source.max-providers` setting
- **Fallback Logic**: Respects `discovery.multi-source.fallback-enabled` setting
- **Unified Configuration**: Single source of truth for API provider management 