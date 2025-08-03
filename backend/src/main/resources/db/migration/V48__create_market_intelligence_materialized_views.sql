-- Market Intelligence Materialized Views for Performance Optimization
-- Phase 3: Advanced Features - Complex Analytics Views

-- =============================================
-- Cost Analytics Materialized View
-- =============================================

-- Create materialized view for market intelligence cost summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_market_intelligence_cost_summary AS
SELECT 
    shop_id,
    DATE_TRUNC('day', created_at) as day,
    provider,
    SUM(daily_cost) as total_cost,
    SUM(daily_requests) as total_requests,
    COUNT(DISTINCT competitive_url_id) as unique_competitors,
    AVG(daily_cost / NULLIF(daily_requests, 0)) as avg_cost_per_request,
    MIN(daily_cost) as min_daily_cost,
    MAX(daily_cost) as max_daily_cost,
    COUNT(*) as total_records
FROM market_intelligence_costs 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY shop_id, DATE_TRUNC('day', created_at), provider
ORDER BY shop_id, day DESC, provider;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_mi_cost_summary_unique 
ON mv_market_intelligence_cost_summary (shop_id, day, provider);

-- Create additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mv_mi_cost_summary_shop_day 
ON mv_market_intelligence_cost_summary (shop_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_mi_cost_summary_provider 
ON mv_market_intelligence_cost_summary (provider);

-- =============================================
-- Competitor Performance Materialized View
-- =============================================

-- Create materialized view for competitor performance analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_competitor_performance_summary AS
SELECT 
    cu.shop_id,
    cu.id as competitor_id,
    cu.url as competitor_url,
    cu.label as competitor_label,
    cu.platform,
    cu.scraper_source,
    
    -- Price statistics
    COUNT(ps.id) as total_price_snapshots,
    AVG(ps.price) as avg_price,
    MIN(ps.price) as min_price,
    MAX(ps.price) as max_price,
    STDDEV(ps.price) as price_volatility,
    
    -- Recent price data (last 7 days)
    COUNT(CASE WHEN ps.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_snapshots,
    AVG(CASE WHEN ps.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN ps.price END) as recent_avg_price,
    
    -- Last successful scrape
    MAX(ps.created_at) as last_price_update,
    
    -- Success rate calculation
    COUNT(CASE WHEN ps.price IS NOT NULL AND ps.price > 0 THEN 1 END)::DECIMAL / NULLIF(COUNT(ps.id), 0) * 100 as success_rate,
    
    -- Status information
    cu.is_active,
    cu.deleted_at,
    cu.created_at as competitor_added_date,
    
    -- Calculated fields
    CASE 
        WHEN cu.deleted_at IS NOT NULL THEN 'ARCHIVED'
        WHEN MAX(ps.created_at) < CURRENT_DATE - INTERVAL '7 days' THEN 'STALE'
        WHEN cu.is_active = true THEN 'ACTIVE'
        ELSE 'INACTIVE'
    END as status,
    
    -- Days since last update
    EXTRACT(DAYS FROM (CURRENT_TIMESTAMP - MAX(ps.created_at))) as days_since_last_update

FROM competitor_urls cu
LEFT JOIN price_snapshots ps ON cu.id = ps.competitive_url_id
WHERE cu.created_at >= CURRENT_DATE - INTERVAL '90 days'  -- Focus on recent competitors
GROUP BY cu.shop_id, cu.id, cu.url, cu.label, cu.platform, cu.scraper_source, cu.is_active, cu.deleted_at, cu.created_at
ORDER BY cu.shop_id, total_price_snapshots DESC;

-- Create indexes for competitor performance view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_competitor_performance_unique 
ON mv_competitor_performance_summary (shop_id, competitor_id);

CREATE INDEX IF NOT EXISTS idx_mv_competitor_performance_shop_status 
ON mv_competitor_performance_summary (shop_id, status);

CREATE INDEX IF NOT EXISTS idx_mv_competitor_performance_platform 
ON mv_competitor_performance_summary (platform);

CREATE INDEX IF NOT EXISTS idx_mv_competitor_performance_last_update 
ON mv_competitor_performance_summary (last_price_update);

-- =============================================
-- Price Trend Analytics Materialized View
-- =============================================

-- Create materialized view for price trend analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_price_trend_analytics AS
WITH price_changes AS (
    SELECT 
        ps.competitive_url_id,
        cu.shop_id,
        cu.platform,
        ps.price,
        ps.created_at,
        LAG(ps.price) OVER (PARTITION BY ps.competitive_url_id ORDER BY ps.created_at) as prev_price,
        LAG(ps.created_at) OVER (PARTITION BY ps.competitive_url_id ORDER BY ps.created_at) as prev_date
    FROM price_snapshots ps
    JOIN competitor_urls cu ON ps.competitive_url_id = cu.id
    WHERE ps.created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND ps.price IS NOT NULL 
    AND ps.price > 0
),
trend_calculations AS (
    SELECT 
        shop_id,
        competitive_url_id,
        platform,
        created_at,
        price,
        prev_price,
        CASE 
            WHEN prev_price IS NOT NULL AND prev_price > 0 THEN
                ((price - prev_price) / prev_price * 100)
            ELSE 0
        END as price_change_percent,
        CASE 
            WHEN prev_price IS NOT NULL THEN
                EXTRACT(DAYS FROM (created_at - prev_date))
            ELSE NULL
        END as days_between_updates
    FROM price_changes
    WHERE prev_price IS NOT NULL
)
SELECT 
    shop_id,
    competitive_url_id,
    platform,
    DATE_TRUNC('day', created_at) as day,
    
    -- Price statistics for the day
    COUNT(*) as daily_updates,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price,
    
    -- Price change statistics
    AVG(price_change_percent) as avg_price_change_percent,
    MIN(price_change_percent) as min_price_change_percent,
    MAX(price_change_percent) as max_price_change_percent,
    COUNT(CASE WHEN price_change_percent > 5 THEN 1 END) as significant_increases,
    COUNT(CASE WHEN price_change_percent < -5 THEN 1 END) as significant_decreases,
    
    -- Update frequency
    AVG(days_between_updates) as avg_days_between_updates,
    
    -- Trend indicators
    CASE 
        WHEN AVG(price_change_percent) > 2 THEN 'INCREASING'
        WHEN AVG(price_change_percent) < -2 THEN 'DECREASING'
        ELSE 'STABLE'
    END as trend_direction,
    
    -- Volatility indicator
    CASE 
        WHEN STDDEV(price_change_percent) > 10 THEN 'HIGH'
        WHEN STDDEV(price_change_percent) > 5 THEN 'MEDIUM'
        ELSE 'LOW'
    END as volatility_level

FROM trend_calculations
GROUP BY shop_id, competitive_url_id, platform, DATE_TRUNC('day', created_at)
ORDER BY shop_id, day DESC, competitive_url_id;

-- Create indexes for price trend analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_price_trend_unique 
ON mv_price_trend_analytics (shop_id, competitive_url_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_price_trend_shop_day 
ON mv_price_trend_analytics (shop_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_price_trend_platform 
ON mv_price_trend_analytics (platform);

CREATE INDEX IF NOT EXISTS idx_mv_price_trend_direction 
ON mv_price_trend_analytics (trend_direction);

-- =============================================
-- System Performance Materialized View
-- =============================================

-- Create materialized view for system performance analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_system_performance_summary AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    
    -- Request volume statistics
    COUNT(*) as total_requests,
    COUNT(CASE WHEN scraper_source = 'jsoup' THEN 1 END) as jsoup_requests,
    COUNT(CASE WHEN scraper_source = 'scrapingdog' THEN 1 END) as scrapingdog_requests,
    COUNT(CASE WHEN scraper_source = 'serper' THEN 1 END) as serper_requests,
    COUNT(CASE WHEN scraper_source = 'serpapi' THEN 1 END) as serpapi_requests,
    
    -- Success rate by source
    COUNT(CASE WHEN scraper_source = 'jsoup' AND price IS NOT NULL AND price > 0 THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN scraper_source = 'jsoup' THEN 1 END), 0) * 100 as jsoup_success_rate,
    
    COUNT(CASE WHEN scraper_source = 'scrapingdog' AND price IS NOT NULL AND price > 0 THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN scraper_source = 'scrapingdog' THEN 1 END), 0) * 100 as scrapingdog_success_rate,
    
    COUNT(CASE WHEN scraper_source = 'serper' AND price IS NOT NULL AND price > 0 THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN scraper_source = 'serper' THEN 1 END), 0) * 100 as serper_success_rate,
    
    COUNT(CASE WHEN scraper_source = 'serpapi' AND price IS NOT NULL AND price > 0 THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN scraper_source = 'serpapi' THEN 1 END), 0) * 100 as serpapi_success_rate,
    
    -- Overall success rate
    COUNT(CASE WHEN price IS NOT NULL AND price > 0 THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100 as overall_success_rate,
    
    -- Platform distribution
    COUNT(CASE WHEN platform = 'amazon' THEN 1 END) as amazon_requests,
    COUNT(CASE WHEN platform = 'walmart' THEN 1 END) as walmart_requests,
    COUNT(CASE WHEN platform = 'ebay' THEN 1 END) as ebay_requests,
    COUNT(CASE WHEN platform = 'shopify' THEN 1 END) as shopify_requests,
    COUNT(CASE WHEN platform = 'other' THEN 1 END) as other_platform_requests,
    
    -- Error analysis
    COUNT(CASE WHEN price IS NULL OR price = 0 THEN 1 END) as failed_requests,
    
    -- Performance indicators
    COUNT(DISTINCT cu.shop_id) as active_shops,
    COUNT(DISTINCT ps.competitive_url_id) as active_competitors,
    
    -- Calculate average processing time per hour (estimated)
    EXTRACT(EPOCH FROM (MAX(ps.created_at) - MIN(ps.created_at))) / NULLIF(COUNT(*), 0) as avg_processing_interval_seconds

FROM price_snapshots ps
JOIN competitor_urls cu ON ps.competitive_url_id = cu.id
WHERE ps.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- Create indexes for system performance view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_system_performance_unique 
ON mv_system_performance_summary (hour);

CREATE INDEX IF NOT EXISTS idx_mv_system_performance_hour 
ON mv_system_performance_summary (hour DESC);

-- =============================================
-- Refresh Functions for Materialized Views
-- =============================================

-- Function to refresh market intelligence cost summary
CREATE OR REPLACE FUNCTION refresh_mi_cost_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_intelligence_cost_summary;
    -- Log the refresh
    INSERT INTO system_logs (level, message, created_at) 
    VALUES ('INFO', 'Refreshed mv_market_intelligence_cost_summary', CURRENT_TIMESTAMP);
EXCEPTION
    WHEN OTHERS THEN
        -- Log any errors
        INSERT INTO system_logs (level, message, created_at) 
        VALUES ('ERROR', 'Failed to refresh mv_market_intelligence_cost_summary: ' || SQLERRM, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh competitor performance summary
CREATE OR REPLACE FUNCTION refresh_competitor_performance_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_competitor_performance_summary;
    INSERT INTO system_logs (level, message, created_at) 
    VALUES ('INFO', 'Refreshed mv_competitor_performance_summary', CURRENT_TIMESTAMP);
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO system_logs (level, message, created_at) 
        VALUES ('ERROR', 'Failed to refresh mv_competitor_performance_summary: ' || SQLERRM, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh price trend analytics
CREATE OR REPLACE FUNCTION refresh_price_trend_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_price_trend_analytics;
    INSERT INTO system_logs (level, message, created_at) 
    VALUES ('INFO', 'Refreshed mv_price_trend_analytics', CURRENT_TIMESTAMP);
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO system_logs (level, message, created_at) 
        VALUES ('ERROR', 'Failed to refresh mv_price_trend_analytics: ' || SQLERRM, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh system performance summary
CREATE OR REPLACE FUNCTION refresh_system_performance_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_system_performance_summary;
    INSERT INTO system_logs (level, message, created_at) 
    VALUES ('INFO', 'Refreshed mv_system_performance_summary', CURRENT_TIMESTAMP);
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO system_logs (level, message, created_at) 
        VALUES ('ERROR', 'Failed to refresh mv_system_performance_summary: ' || SQLERRM, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Master function to refresh all market intelligence views
CREATE OR REPLACE FUNCTION refresh_all_mi_materialized_views()
RETURNS void AS $$
BEGIN
    -- Refresh all views in sequence
    PERFORM refresh_mi_cost_summary();
    PERFORM refresh_competitor_performance_summary();
    PERFORM refresh_price_trend_analytics();
    PERFORM refresh_system_performance_summary();
    
    -- Log completion
    INSERT INTO system_logs (level, message, created_at) 
    VALUES ('INFO', 'Completed refresh of all Market Intelligence materialized views', CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Grant Permissions
-- =============================================

-- Grant read access to materialized views
GRANT SELECT ON mv_market_intelligence_cost_summary TO PUBLIC;
GRANT SELECT ON mv_competitor_performance_summary TO PUBLIC;
GRANT SELECT ON mv_price_trend_analytics TO PUBLIC;
GRANT SELECT ON mv_system_performance_summary TO PUBLIC;

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON MATERIALIZED VIEW mv_market_intelligence_cost_summary IS 
'Aggregated cost analytics for Market Intelligence operations, refreshed daily. Includes cost per provider, request statistics, and performance metrics for the last 30 days.';

COMMENT ON MATERIALIZED VIEW mv_competitor_performance_summary IS 
'Comprehensive competitor performance analytics including price statistics, success rates, and status tracking. Updated every 4 hours to maintain current data.';

COMMENT ON MATERIALIZED VIEW mv_price_trend_analytics IS 
'Price trend analysis with change calculations, volatility indicators, and trend directions. Provides insights into price movements and market dynamics.';

COMMENT ON MATERIALIZED VIEW mv_system_performance_summary IS 
'System-wide performance metrics including success rates by scraper source, platform distribution, and hourly processing statistics. Refreshed every hour.';

-- =============================================
-- Initial Data Population
-- =============================================

-- Populate materialized views with initial data
SELECT refresh_all_mi_materialized_views();