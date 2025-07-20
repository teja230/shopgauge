-- Database Performance Optimization for Market Intelligence

-- Add composite indexes for common query patterns

-- Composite index for competitor URLs by shop and status
CREATE INDEX IF NOT EXISTS idx_competitor_urls_shop_status_active 
ON competitor_urls (shop_id, status) 
WHERE status = 'active';

-- Composite index for price snapshots with competitor and time
CREATE INDEX IF NOT EXISTS idx_price_snapshots_competitor_time_desc 
ON price_snapshots (competitor_url_id, checked_at DESC);

-- Composite index for price snapshots with significant changes
CREATE INDEX IF NOT EXISTS idx_price_snapshots_significant_changes 
ON price_snapshots (competitor_url_id, significant_change, checked_at DESC) 
WHERE significant_change = true;

-- Composite index for price alerts by shop and creation time
CREATE INDEX IF NOT EXISTS idx_price_alerts_shop_created_desc 
ON price_alerts (shop_id, created_at DESC);

-- Composite index for price alerts by notification status
CREATE INDEX IF NOT EXISTS idx_price_alerts_notification_pending 
ON price_alerts (notification_sent, created_at DESC) 
WHERE notification_sent = false;

-- Composite index for competitor suggestions by shop, status and relevance
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_shop_status_relevance 
ON competitor_suggestions (shop_id, status, relevance_score DESC) 
WHERE status = 'NEW';

-- Composite index for market intelligence costs by shop and date range
CREATE INDEX IF NOT EXISTS idx_market_intelligence_costs_shop_date_desc 
ON market_intelligence_costs (shop_id, date DESC);

-- Composite index for market intelligence costs by provider performance
CREATE INDEX IF NOT EXISTS idx_market_intelligence_costs_provider_performance 
ON market_intelligence_costs (provider, date DESC, cache_hit_rate DESC);

-- Add partial indexes for active records only
CREATE INDEX IF NOT EXISTS idx_competitor_urls_active_only 
ON competitor_urls (id, shop_id, url) 
WHERE status = 'active';

-- Add index for error tracking
CREATE INDEX IF NOT EXISTS idx_competitor_urls_error_tracking 
ON competitor_urls (shop_id, error_count, last_successful_check) 
WHERE error_count > 0;

-- Add index for platform-based queries
CREATE INDEX IF NOT EXISTS idx_competitor_urls_platform 
ON competitor_urls (shop_id, platform) 
WHERE platform IS NOT NULL;

-- Add covering index for price snapshots summary queries
CREATE INDEX IF NOT EXISTS idx_price_snapshots_summary 
ON price_snapshots (competitor_url_id, checked_at DESC) 
INCLUDE (price, price_change_percent, in_stock);

-- Add index for time-based cleanup operations (without date predicate due to immutability requirement)
CREATE INDEX IF NOT EXISTS idx_price_snapshots_cleanup 
ON price_snapshots (checked_at);

-- Add index for audit and monitoring queries
CREATE INDEX IF NOT EXISTS idx_market_intelligence_costs_monitoring 
ON market_intelligence_costs (date, provider) 
INCLUDE (daily_cost, daily_requests, cache_hit_rate);

-- Create materialized view for competitor performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS competitor_performance_summary AS
SELECT 
    cu.shop_id,
    cu.id as competitor_url_id,
    cu.url,
    cu.platform,
    cu.status,
    cu.error_count,
    cu.last_successful_check,
    COUNT(ps.id) as total_checks,
    AVG(ps.response_time_ms) as avg_response_time,
    COUNT(CASE WHEN ps.significant_change THEN 1 END) as significant_changes,
    MAX(ps.checked_at) as last_check,
    (SELECT price FROM price_snapshots WHERE competitor_url_id = cu.id ORDER BY checked_at DESC LIMIT 1) as current_price
FROM competitor_urls cu
LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id
GROUP BY cu.shop_id, cu.id, cu.url, cu.platform, cu.status, cu.error_count, cu.last_successful_check;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_performance_summary_unique 
ON competitor_performance_summary (shop_id, competitor_url_id);

-- Create index for materialized view queries
CREATE INDEX IF NOT EXISTS idx_competitor_performance_summary_shop 
ON competitor_performance_summary (shop_id, status);

-- Add function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_competitor_performance_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY competitor_performance_summary;
END;
$$ LANGUAGE plpgsql;

-- Create function for database maintenance and cleanup
CREATE OR REPLACE FUNCTION cleanup_old_price_snapshots(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete price snapshots older than retention period, keeping at least one per competitor
    WITH snapshots_to_keep AS (
        SELECT DISTINCT ON (competitor_url_id) 
            id, competitor_url_id, checked_at
        FROM price_snapshots 
        WHERE checked_at >= CURRENT_DATE - INTERVAL '1 day' * retention_days
        ORDER BY competitor_url_id, checked_at DESC
    ),
    latest_snapshots AS (
        SELECT DISTINCT ON (competitor_url_id) 
            id, competitor_url_id
        FROM price_snapshots 
        ORDER BY competitor_url_id, checked_at DESC
    )
    DELETE FROM price_snapshots 
    WHERE checked_at < CURRENT_DATE - INTERVAL '1 day' * retention_days
    AND id NOT IN (SELECT id FROM snapshots_to_keep)
    AND id NOT IN (SELECT id FROM latest_snapshots);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup operation
    INSERT INTO admin_audit_logs (action, details, created_at)
    VALUES ('DATABASE_CLEANUP', 
            jsonb_build_object('deleted_snapshots', deleted_count, 'retention_days', retention_days),
            CURRENT_TIMESTAMP);
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for analyzing query performance
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE (
    query_type TEXT,
    avg_duration_ms NUMERIC,
    call_count BIGINT,
    total_duration_ms NUMERIC
) AS $$
BEGIN
    -- This would integrate with pg_stat_statements if available
    -- For now, return basic table statistics
    RETURN QUERY
    SELECT 
        'competitor_urls_queries'::TEXT,
        0.0::NUMERIC,
        0::BIGINT,
        0.0::NUMERIC
    WHERE FALSE; -- Placeholder - would need pg_stat_statements extension
END;
$$ LANGUAGE plpgsql;

-- Create function to update table statistics
CREATE OR REPLACE FUNCTION update_market_intelligence_statistics()
RETURNS void AS $$
BEGIN
    -- Analyze tables for better query planning
    ANALYZE competitor_urls;
    ANALYZE price_snapshots;
    ANALYZE competitor_suggestions;
    ANALYZE price_alerts;
    ANALYZE market_intelligence_costs;
    
    -- Refresh materialized view
    PERFORM refresh_competitor_performance_summary();
    
    -- Log the statistics update
    INSERT INTO admin_audit_logs (action, details, created_at)
    VALUES ('STATISTICS_UPDATE', 
            jsonb_build_object('timestamp', CURRENT_TIMESTAMP, 'tables_analyzed', 5),
            CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Additional Performance Indexes (consolidated from V33)

-- Additional indexes for competitor_urls
CREATE INDEX IF NOT EXISTS idx_competitor_urls_domain 
ON competitor_urls (domain) 
WHERE domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitor_urls_last_check 
ON competitor_urls (last_successful_check DESC) 
WHERE last_successful_check IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_competitor_urls_shop_product_status 
ON competitor_urls (shop_id, product_id, status) 
WHERE deleted_at IS NULL;

-- Additional indexes for price_snapshots
CREATE INDEX IF NOT EXISTS idx_price_snapshots_price_changes 
ON price_snapshots (competitor_url_id, price_change_percent) 
WHERE price_change_percent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_price_snapshots_price_range 
ON price_snapshots (price) 
WHERE price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_price_snapshots_in_stock 
ON price_snapshots (competitor_url_id, in_stock, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_competitor_price_time 
ON price_snapshots (competitor_url_id, price, checked_at DESC) 
WHERE price IS NOT NULL;

-- Additional indexes for competitor_suggestions
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_shop_status_new 
ON competitor_suggestions (shop_id, status) 
WHERE status = 'NEW';

CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_relevance 
ON competitor_suggestions (relevance_score DESC) 
WHERE relevance_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_discovered 
ON competitor_suggestions (discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_platform 
ON competitor_suggestions (platform) 
WHERE platform IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_shop_product 
ON competitor_suggestions (shop_id, product_id);

CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_pending_approval 
ON competitor_suggestions (shop_id, discovered_at DESC) 
WHERE status = 'NEW' AND processed_at IS NULL;

-- Additional indexes for market_intelligence_costs
CREATE INDEX IF NOT EXISTS idx_market_intelligence_costs_provider_date 
ON market_intelligence_costs (provider, date DESC);

CREATE INDEX IF NOT EXISTS idx_market_intelligence_costs_daily_cost 
ON market_intelligence_costs (daily_cost DESC) 
WHERE daily_cost > 0;

CREATE INDEX IF NOT EXISTS idx_market_intelligence_costs_requests 
ON market_intelligence_costs (daily_requests DESC) 
WHERE daily_requests > 0;

CREATE INDEX IF NOT EXISTS idx_market_intelligence_costs_cache_hit_rate 
ON market_intelligence_costs (cache_hit_rate) 
WHERE cache_hit_rate IS NOT NULL;

-- Additional indexes for price_alerts
CREATE INDEX IF NOT EXISTS idx_price_alerts_competitor_created 
ON price_alerts (competitor_url_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_alerts_alert_type 
ON price_alerts (alert_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_alerts_change_percent 
ON price_alerts (ABS(change_percent) DESC) 
WHERE change_percent IS NOT NULL;

-- Add table comments for documentation
COMMENT ON TABLE competitor_urls IS 'Stores competitor URLs being tracked for each shop with status and error tracking';
COMMENT ON TABLE price_snapshots IS 'Historical price data for competitors with change detection and performance metrics';
COMMENT ON TABLE competitor_suggestions IS 'AI-discovered competitor suggestions with relevance scoring';
COMMENT ON TABLE price_alerts IS 'Price change notifications and alert history';
COMMENT ON TABLE market_intelligence_costs IS 'Cost tracking and performance metrics for API usage';

-- Add column comments for key fields
COMMENT ON COLUMN competitor_urls.status IS 'Current status: active, error, paused';
COMMENT ON COLUMN competitor_urls.error_count IS 'Number of consecutive scraping errors';
COMMENT ON COLUMN competitor_urls.platform IS 'Detected platform: amazon, shopify, woocommerce, other';
COMMENT ON COLUMN price_snapshots.significant_change IS 'True if price change exceeds threshold (typically 5%)';
COMMENT ON COLUMN price_snapshots.response_time_ms IS 'Scraping response time in milliseconds';
COMMENT ON COLUMN competitor_suggestions.relevance_score IS 'AI relevance score from 0.00 to 1.00';
COMMENT ON COLUMN price_alerts.alert_type IS 'Type of alert: price_drop, price_increase, back_in_stock, out_of_stock';