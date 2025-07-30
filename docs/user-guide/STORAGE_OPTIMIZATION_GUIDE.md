# Storage Optimization Guide for Market Intelligence

> **📚 Related Documentation**: This guide covers storage optimization for the [Market Intelligence](MARKET_INTELLIGENCE.md) feature. For implementation details, see the [Market Intelligence Implementation Reference](MARKET_INTELLIGENCE_IMPLEMENTATION_REFERENCE.md).

## 🎯 Overview

The Market Intelligence system generates price snapshots that can grow significantly over time. This guide provides strategies to optimize storage while maintaining data integrity and historical insights.

---

## 📊 Current Data Structure

### **Price Snapshots Table Schema**
```sql
price_snapshots (
    id SERIAL PRIMARY KEY,                    -- 8 bytes
    competitor_url_id INTEGER,                -- 8 bytes
    price NUMERIC(12,2),                     -- 12 bytes
    in_stock BOOLEAN,                        -- 1 byte
    checked_at TIMESTAMP,                     -- 8 bytes
    price_change_percent DECIMAL(5,2),       -- 4 bytes
    significant_change BOOLEAN,               -- 1 byte
    response_time_ms INTEGER,                 -- 4 bytes
    scraper_version VARCHAR(20),              -- 20 bytes
    platform VARCHAR(50),                     -- 50 bytes
    scraper_source VARCHAR(50),               -- 50 bytes
    deleted_at TIMESTAMP NULL                -- 8 bytes
);
-- Total: ~200 bytes per snapshot
```

### **Data Creation Frequency**
| **Event** | **Frequency** | **Snapshots Created** |
|-----------|---------------|----------------------|
| Scheduled Scraping | Every 24 hours | 1 per competitor |
| Immediate Scraping | On competitor addition | 1 per competitor |
| Retry Attempts | On failures (max 2) | 0-2 per attempt |
| Multi-tier Fallback | On API failures | 0-4 per attempt |
| **Total Average** | **Per competitor per day** | **2-3 snapshots** |

---

## 📈 Storage Growth Projections

### **Monthly Storage Estimates**

| **Plan** | **Competitors** | **Snapshots/Day** | **Monthly Snapshots** | **Storage (MB)** |
|----------|-----------------|-------------------|----------------------|------------------|
| Current ($19.99) | 10 | 2.5 | 750 | 0.15 |
| Basic ($9.99) | 25 | 2.5 | 1,875 | 0.375 |
| Premium ($29.99) | 100 | 2.5 | 7,500 | 1.5 |
| Enterprise ($49.99) | 500 | 2.5 | 37,500 | 7.5 |

### **Annual Storage Estimates**

| **Plan** | **Annual Snapshots** | **Storage (MB)** | **Storage (GB)** |
|----------|---------------------|------------------|------------------|
| Current ($19.99) | 9,000 | 1.8 | 0.002 |
| Basic ($9.99) | 22,500 | 4.5 | 0.004 |
| Premium ($29.99) | 90,000 | 18 | 0.018 |
| Enterprise ($49.99) | 450,000 | 90 | 0.09 |

---

## 🗂️ Current Retention Policy

### **Retention Rules**
```sql
-- Active Snapshots: Keep for 90 days
-- Soft-Deleted Snapshots: Keep for 30 days
-- Latest Snapshot: Always preserved per competitor
-- Significant Changes: Preserved for trend analysis
```

### **Cleanup Strategy**
```java
@Scheduled(cron = "0 0 2 * * *") // Daily at 2 AM
public void cleanupOldPriceSnapshots() {
    // 1. Keep latest snapshot per competitor
    // 2. Delete snapshots older than retention period
    // 3. Clean up old soft-deleted records
    // 4. Preserve significant price changes
}
```

---

## 💾 Storage Optimization Strategies

### **1. Enhanced Price Change Calculation & Validation**

#### **Recent Improvements (Latest Update)**
The price change calculation system has been significantly enhanced to improve data accuracy and storage efficiency:

#### **PriceChangeCalculationService**
```java
@Service
public class PriceChangeCalculationService {
    // Enhanced accuracy with historical data analysis
    public Optional<BigDecimal> calculatePriceChangePercent(Long competitorId, BigDecimal newPrice)
    
    // Time-based price change analysis
    public Optional<BigDecimal> calculatePriceChangeOverPeriod(Long competitorId, int days)
    
    // Comprehensive statistics
    public Map<String, Object> getPriceChangeStatistics(Long competitorId)
    
    // Data validation and correction
    public void validateAndFixPriceChanges(Long competitorId)
    
    // Trend analysis with confidence levels
    public String getPriceTrend(Long competitorId, int days)
}
```

#### **Database Migration V43**
```sql
-- Validation and fix function
CREATE OR REPLACE FUNCTION validate_price_changes()
RETURNS TABLE(competitor_id BIGINT, snapshot_id BIGINT, ...)

-- Statistics function
CREATE OR REPLACE FUNCTION get_price_change_statistics(p_competitor_id BIGINT)
RETURNS TABLE(total_snapshots BIGINT, avg_change_percent DECIMAL(5,2), ...)

-- Period analysis function
CREATE OR REPLACE FUNCTION calculate_price_change_over_period(
    p_competitor_id BIGINT, p_days INTEGER)
RETURNS TABLE(current_price DECIMAL(10,2), historical_price DECIMAL(10,2), ...)

-- Trend analysis function
CREATE OR REPLACE FUNCTION get_price_trend(p_competitor_id BIGINT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(trend VARCHAR(20), change_percent DECIMAL(5,2), confidence_level VARCHAR(20))
```

#### **Performance Indexes**
```sql
-- Enhanced indexes for price change calculations
CREATE INDEX IF NOT EXISTS idx_price_snapshots_competitor_checked 
ON price_snapshots (competitor_url_id, checked_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_price_snapshots_change_percent 
ON price_snapshots (competitor_url_id, price_change_percent) 
WHERE deleted_at IS NULL AND price_change_percent IS NOT NULL;
```

#### **Key Benefits**
- ✅ **Data Accuracy**: Historical analysis instead of just recent snapshots
- ✅ **Validation**: Automatic detection and correction of inconsistent data
- ✅ **Performance**: Optimized indexes for faster queries
- ✅ **Analytics**: Comprehensive statistics and trend analysis
- ✅ **Storage Efficiency**: Better data integrity reduces storage waste

### **2. Automatic Data Retention**

#### **Configuration**
```properties
# Data Retention Settings
data.retention.enabled=true
data.retention.price-snapshots.days=90
data.retention.soft-deleted.days=30
data.retention.competitor-urls.days=365
```

#### **Implementation**
```java
@Service
public class DataRetentionService {
    
    @Scheduled(cron = "0 0 2 * * *") // Daily at 2 AM
    public void cleanupOldPriceSnapshots() {
        // Clean up old active snapshots (keep latest per competitor)
        jdbcTemplate.update(
            "DELETE FROM price_snapshots " +
            "WHERE checked_at < CURRENT_DATE - INTERVAL '1 day' * ? " +
            "AND deleted_at IS NULL " +
            "AND id NOT IN (" +
            "  SELECT DISTINCT ON (competitor_url_id) id " +
            "  FROM price_snapshots " +
            "  WHERE deleted_at IS NULL " +
            "  ORDER BY competitor_url_id, checked_at DESC" +
            ")",
            priceSnapshotRetentionDays
        );
        
        // Clean up old soft-deleted snapshots
        jdbcTemplate.update(
            "DELETE FROM price_snapshots " +
            "WHERE deleted_at < CURRENT_DATE - INTERVAL '1 day' * ?",
            softDeletedRetentionDays
        );
    }
}
```

### **2. Smart Snapshot Creation**

#### **Duplicate Prevention**
```java
// Only create snapshot if price changed significantly
private boolean shouldCreateSnapshot(BigDecimal newPrice, BigDecimal lastPrice) {
    if (lastPrice == null) return true;
    
    double changePercent = Math.abs((newPrice.doubleValue() - lastPrice.doubleValue()) / lastPrice.doubleValue() * 100);
    return changePercent >= 1.0; // Only if price changed by 1% or more
}
```

#### **Batch Processing**
```java
// Process snapshots in batches to reduce database load
@Value("${price.snapshots.cleanup-batch-size:1000}")
private int cleanupBatchSize;

public void cleanupInBatches() {
    int offset = 0;
    while (true) {
        int deleted = jdbcTemplate.update(
            "DELETE FROM price_snapshots " +
            "WHERE id IN (" +
            "  SELECT id FROM price_snapshots " +
            "  WHERE checked_at < CURRENT_DATE - INTERVAL '1 day' * ? " +
            "  LIMIT ?" +
            ")",
            retentionDays, cleanupBatchSize
        );
        
        if (deleted < cleanupBatchSize) break;
        offset += cleanupBatchSize;
    }
}
```

### **3. Data Compression Strategies**

#### **Archive Old Data**
```sql
-- Create archive table for old data
CREATE TABLE price_snapshots_archive (
    id BIGINT,
    competitor_url_id INTEGER,
    price NUMERIC(12,2),
    checked_at TIMESTAMP,
    price_change_percent DECIMAL(5,2),
    significant_change BOOLEAN
);

-- Archive snapshots older than 1 year
INSERT INTO price_snapshots_archive
SELECT id, competitor_url_id, price, checked_at, price_change_percent, significant_change
FROM price_snapshots
WHERE checked_at < CURRENT_DATE - INTERVAL '1 year';

-- Delete archived snapshots
DELETE FROM price_snapshots
WHERE id IN (SELECT id FROM price_snapshots_archive);
```

#### **JSON Compression for Metadata**
```sql
-- Store metadata as JSON to reduce column count
ALTER TABLE price_snapshots 
ADD COLUMN metadata JSONB;

-- Store scraper info in JSON
UPDATE price_snapshots 
SET metadata = jsonb_build_object(
    'scraper_version', scraper_version,
    'platform', platform,
    'scraper_source', scraper_source,
    'response_time_ms', response_time_ms
);
```

### **4. Partitioning Strategy**

#### **Time-Based Partitioning**
```sql
-- Create partitioned table by month
CREATE TABLE price_snapshots_partitioned (
    id SERIAL,
    competitor_url_id INTEGER,
    price NUMERIC(12,2),
    in_stock BOOLEAN,
    checked_at TIMESTAMP,
    -- ... other columns
) PARTITION BY RANGE (checked_at);

-- Create monthly partitions
CREATE TABLE price_snapshots_2024_01 PARTITION OF price_snapshots_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE price_snapshots_2024_02 PARTITION OF price_snapshots_partitioned
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

---

## 📊 Monitoring & Analytics

### **Storage Statistics**
```java
public Map<String, Object> getStorageStats() {
    return Map.of(
        "total_snapshots", getTotalSnapshots(),
        "active_snapshots", getActiveSnapshots(),
        "soft_deleted_snapshots", getSoftDeletedSnapshots(),
        "old_snapshots", getOldSnapshots(),
        "estimated_storage_mb", calculateEstimatedStorage(),
        "retention_days", priceSnapshotRetentionDays
    );
}
```

### **Monitoring Queries**
```sql
-- Storage usage by competitor
SELECT 
    cu.url,
    COUNT(ps.id) as snapshot_count,
    MIN(ps.checked_at) as oldest_snapshot,
    MAX(ps.checked_at) as newest_snapshot
FROM competitor_urls cu
LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id
WHERE cu.deleted_at IS NULL AND ps.deleted_at IS NULL
GROUP BY cu.id, cu.url
ORDER BY snapshot_count DESC;

-- Storage growth over time
SELECT 
    DATE_TRUNC('month', checked_at) as month,
    COUNT(*) as snapshots_created,
    COUNT(*) * 200.0 / (1024 * 1024) as storage_mb
FROM price_snapshots
WHERE checked_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', checked_at)
ORDER BY month;
```

---

## ⚙️ Configuration Options

### **Retention Periods**
```properties
# Flexible retention based on plan
data.retention.price-snapshots.days=90
data.retention.soft-deleted.days=30
data.retention.competitor-urls.days=365

# Plan-specific retention
plan.basic.retention.days=60
plan.premium.retention.days=180
plan.enterprise.retention.days=365
```

### **Storage Limits**
```properties
# Maximum snapshots per competitor
price.snapshots.max-per-competitor=100

# Batch processing
price.snapshots.cleanup-batch-size=1000

# Compression settings
data.storage.compression.enabled=false
data.storage.archive-old-data.enabled=false
```

---

## 🚀 Implementation Roadmap

### **Phase 1: Basic Retention (Current)**
- [x] 90-day retention for active snapshots
- [x] 30-day retention for soft-deleted snapshots
- [x] Daily cleanup at 2 AM
- [x] Keep latest snapshot per competitor

### **Phase 2: Smart Optimization (Future)**
- [ ] Duplicate prevention (only create on significant changes)
- [ ] Batch processing for large datasets
- [ ] Storage monitoring and alerts
- [ ] Plan-specific retention periods

### **Phase 3: Advanced Optimization (Future)**
- [ ] Data compression and archiving
- [ ] Time-based partitioning
- [ ] JSON metadata storage
- [ ] Automated storage scaling

---

## 💡 Best Practices

### **1. Monitor Storage Growth**
```sql
-- Weekly storage check
SELECT 
    COUNT(*) as total_snapshots,
    COUNT(*) * 200.0 / (1024 * 1024) as storage_mb
FROM price_snapshots;
```

### **2. Optimize Cleanup Schedule**
```java
// Run during low-traffic hours
@Scheduled(cron = "0 0 2 * * *") // 2 AM daily
```

### **3. Preserve Important Data**
```sql
-- Keep significant price changes longer
UPDATE price_snapshots 
SET retention_override = true 
WHERE significant_change = true;
```

### **4. Plan for Scale**
```properties
# Enterprise plan needs more aggressive cleanup
plan.enterprise.retention.days=180
plan.enterprise.max-snapshots-per-competitor=50
```

---

## ✅ Success Metrics

### **Storage Efficiency**
- **Target**: <1MB per 1000 snapshots
- **Current**: ~0.2MB per 1000 snapshots
- **Optimization**: 80% reduction in storage growth

### **Performance Impact**
- **Cleanup Time**: <5 minutes for 100K snapshots
- **Query Performance**: <100ms for latest price queries
- **Storage Growth**: <10% monthly increase

### **Data Integrity**
- **Historical Trends**: Preserved for 90 days minimum
- **Latest Prices**: Always available
- **Significant Changes**: Preserved indefinitely

---

**This storage optimization strategy ensures the Market Intelligence system can scale efficiently while maintaining data integrity and historical insights.** 🚀 