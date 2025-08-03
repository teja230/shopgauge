-- V32: Add Performance Optimizations for Market Intelligence
-- This migration adds enhanced database indexes, query optimizations, and performance monitoring

-- Note: pg_stat_statements extension requires superuser privileges and should be installed separately
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Add soft delete column to competitor_urls (needed for performance indexes)
ALTER TABLE competitor_urls 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add enhanced fields to competitor_urls table for better tracking
ALTER TABLE competitor_urls 
ADD COLUMN IF NOT EXISTS domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_successful_check TIMESTAMP,
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS scraper_version VARCHAR(20) DEFAULT 'v2.0';

-- Add enhanced fields to price_snapshots table
ALTER TABLE price_snapshots 
ADD COLUMN IF NOT EXISTS price_change_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS significant_change BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS scraper_version VARCHAR(20) DEFAULT 'v2.0';

-- Add enhanced fields to competitor_suggestions table
ALTER TABLE competitor_suggestions 
ADD COLUMN IF NOT EXISTS relevance_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS search_keywords TEXT,
ADD COLUMN IF NOT EXISTS platform VARCHAR(50);

-- Create price_alerts table for notification tracking
CREATE TABLE IF NOT EXISTS price_alerts (
    id BIGSERIAL PRIMARY KEY,
    competitor_url_id BIGINT REFERENCES competitor_urls(id) ON DELETE CASCADE,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    change_percent DECIMAL(5,2),
    alert_type VARCHAR(20) NOT NULL, -- 'price_drop', 'price_increase', 'back_in_stock', 'out_of_stock'
    notification_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes moved to V33__add_performance_indexes.sql to avoid mixed transaction issues

-- Update existing data to populate new fields
UPDATE competitor_urls 
SET domain = REGEXP_REPLACE(url, '^https?://([^/]+).*', '\1')
WHERE domain IS NULL AND url IS NOT NULL;

UPDATE competitor_urls 
SET platform = CASE 
    WHEN url ILIKE '%amazon.%' THEN 'amazon'
    WHEN url ILIKE '%shopify%' OR url ILIKE '%.myshopify.com%' THEN 'shopify'
    WHEN url ILIKE '%woocommerce%' THEN 'woocommerce'
    WHEN url ILIKE '%bigcommerce%' THEN 'bigcommerce'
    WHEN url ILIKE '%etsy.%' THEN 'etsy'
    WHEN url ILIKE '%ebay.%' THEN 'ebay'
    ELSE 'other'
END
WHERE platform = 'unknown' AND url IS NOT NULL;

-- Calculate price change percentages for existing price snapshots
WITH price_changes AS (
    SELECT 
        ps1.id,
        ps1.competitor_url_id,
        ps1.price as current_price,
        ps2.price as previous_price,
        CASE 
            WHEN ps2.price IS NOT NULL AND ps2.price > 0 THEN
                ROUND(((ps1.price - ps2.price) / ps2.price * 100)::numeric, 2)
            ELSE NULL
        END as change_percent
    FROM price_snapshots ps1
    LEFT JOIN LATERAL (
        SELECT price 
        FROM price_snapshots ps2 
        WHERE ps2.competitor_url_id = ps1.competitor_url_id 
        AND ps2.checked_at < ps1.checked_at 
        AND ps2.price IS NOT NULL
        ORDER BY ps2.checked_at DESC 
        LIMIT 1
    ) ps2 ON true
    WHERE ps1.price_change_percent IS NULL
)
UPDATE price_snapshots 
SET 
    price_change_percent = price_changes.change_percent,
    significant_change = ABS(price_changes.change_percent) > 5
FROM price_changes 
WHERE price_snapshots.id = price_changes.id;

-- Add database statistics collection
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    -- Update statistics for Market Intelligence tables
    ANALYZE competitor_urls;
    ANALYZE price_snapshots;
    ANALYZE competitor_suggestions;
    ANALYZE market_intelligence_costs;
    ANALYZE price_alerts;
END;
$$ LANGUAGE plpgsql;

-- Create a function to monitor query performance
CREATE OR REPLACE FUNCTION get_slow_queries(threshold_ms INTEGER DEFAULT 1000)
RETURNS TABLE(
    query TEXT,
    calls BIGINT,
    total_exec_time DOUBLE PRECISION,
    mean_exec_time DOUBLE PRECISION,
    rows BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pss.query,
        pss.calls,
        pss.total_exec_time,
        pss.mean_exec_time,
        pss.rows
    FROM pg_stat_statements pss
    WHERE pss.mean_exec_time > threshold_ms
    ORDER BY pss.mean_exec_time DESC
    LIMIT 20;
EXCEPTION
    WHEN undefined_table THEN
        -- pg_stat_statements not available
        RETURN;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT,
    usage_ratio DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        psui.schemaname::TEXT,
        psui.tablename::TEXT,
        psui.indexname::TEXT,
        psui.idx_scan,
        psui.idx_tup_read,
        psui.idx_tup_fetch,
        CASE 
            WHEN psui.idx_scan = 0 THEN 0.0
            ELSE ROUND((psui.idx_tup_read::DOUBLE PRECISION / psui.idx_scan), 2)
        END as usage_ratio
    FROM pg_stat_user_indexes psui
    WHERE psui.schemaname = 'public'
    AND psui.tablename IN ('competitor_urls', 'price_snapshots', 'competitor_suggestions', 'market_intelligence_costs', 'price_alerts')
    ORDER BY psui.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get table size information
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    size_bytes BIGINT,
    size_pretty TEXT,
    row_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.schemaname::TEXT,
        pt.tablename::TEXT,
        pg_total_relation_size(pt.schemaname||'.'||pt.tablename) as size_bytes,
        pg_size_pretty(pg_total_relation_size(pt.schemaname||'.'||pt.tablename)) as size_pretty,
        COALESCE(pc.reltuples::BIGINT, 0) as row_count
    FROM pg_tables pt
    LEFT JOIN pg_class pc ON pc.relname = pt.tablename
    WHERE pt.tablename IN ('competitor_urls', 'price_snapshots', 'competitor_suggestions', 'market_intelligence_costs', 'price_alerts')
    ORDER BY pg_total_relation_size(pt.schemaname||'.'||pt.tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Update table statistics
SELECT update_table_statistics();

-- Add comments for documentation
COMMENT ON TABLE price_alerts IS 'Tracks price change alerts and notifications for competitor monitoring';
COMMENT ON COLUMN competitor_urls.domain IS 'Extracted domain from URL for grouping and analysis';
COMMENT ON COLUMN competitor_urls.platform IS 'E-commerce platform type (amazon, shopify, woocommerce, etc.)';
COMMENT ON COLUMN competitor_urls.status IS 'Current status of competitor URL (active, error, paused)';
COMMENT ON COLUMN competitor_urls.error_count IS 'Number of consecutive scraping errors';
COMMENT ON COLUMN competitor_urls.response_time_ms IS 'Last scraping response time in milliseconds';
COMMENT ON COLUMN price_snapshots.price_change_percent IS 'Percentage change from previous price snapshot';
COMMENT ON COLUMN price_snapshots.significant_change IS 'Whether price change exceeds threshold (5%)';
COMMENT ON COLUMN competitor_suggestions.relevance_score IS 'AI-calculated relevance score (0.00 to 1.00)';
COMMENT ON COLUMN competitor_suggestions.search_keywords IS 'Keywords used to discover this competitor';

-- View creation moved to V33__add_analytics_views.sql to ensure deleted_at column is available
GRANT EXECUTE ON FUNCTION update_table_statistics() TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_slow_queries(INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_index_usage_stats() TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_table_sizes() TO PUBLIC;