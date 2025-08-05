-- Market Intelligence Materialized Views for Performance Optimization
-- Phase 3: Advanced Features - Complex Analytics Views

-- =============================================
-- Discovery Performance Materialized View
-- =============================================

-- Create materialized view for discovery performance analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_discovery_performance_summary AS
SELECT 
    shop_id,
    DATE_TRUNC('day', discovered_at) as day,
    source,
    COUNT(*) as total_discoveries,
    COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as successful_discoveries,
    AVG(relevance_score) as avg_relevance_score,
    COUNT(CASE WHEN relevance_score > 0.7 THEN 1 END) as high_relevance_discoveries,
    COUNT(CASE WHEN relevance_score < 0.3 THEN 1 END) as low_relevance_discoveries,
    COUNT(DISTINCT product_id) as unique_products,
    COUNT(DISTINCT suggested_url) as unique_urls
FROM competitor_suggestions 
WHERE discovered_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY shop_id, DATE_TRUNC('day', discovered_at), source
ORDER BY shop_id, day DESC, source;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_discovery_performance_unique 
ON mv_discovery_performance_summary (shop_id, day, source);

-- Create additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mv_discovery_performance_shop_day 
ON mv_discovery_performance_summary (shop_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_discovery_performance_source 
ON mv_discovery_performance_summary (source);

-- =============================================
-- Competitor Analytics Materialized View
-- =============================================

-- Create materialized view for competitor analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_competitor_analytics_summary AS
SELECT 
    shop_id,
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as total_competitors,
    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_competitors,
    COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as archived_competitors,
    COUNT(DISTINCT platform) as unique_platforms,
    AVG(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active_ratio
FROM competitor_urls 
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY shop_id, DATE_TRUNC('day', created_at)
ORDER BY shop_id, day DESC;

-- Create indexes for competitor analytics view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_competitor_analytics_unique 
ON mv_competitor_analytics_summary (shop_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_competitor_analytics_shop 
ON mv_competitor_analytics_summary (shop_id);

-- =============================================
-- Price Analytics Materialized View
-- =============================================

-- Create materialized view for price analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_price_analytics_summary AS
SELECT 
    cu.shop_id,
    DATE_TRUNC('day', ps.checked_at) as day,
    cu.platform,
    COUNT(ps.id) as total_snapshots,
    COUNT(CASE WHEN ps.price IS NOT NULL AND ps.price > 0 THEN 1 END) as successful_snapshots,
    AVG(ps.price) as avg_price,
    MIN(ps.price) as min_price,
    MAX(ps.price) as max_price,
    COUNT(DISTINCT ps.competitor_url_id) as unique_competitors,
    COUNT(CASE WHEN ps.price IS NOT NULL AND ps.price > 0 THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(ps.id), 0) * 100 as success_rate
FROM price_snapshots ps
JOIN competitor_urls cu ON ps.competitor_url_id = cu.id
WHERE ps.checked_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY cu.shop_id, DATE_TRUNC('day', ps.checked_at), cu.platform
ORDER BY cu.shop_id, day DESC, cu.platform;

-- Create indexes for price analytics view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_price_analytics_unique 
ON mv_price_analytics_summary (shop_id, day, platform);

CREATE INDEX IF NOT EXISTS idx_mv_price_analytics_shop_day 
ON mv_price_analytics_summary (shop_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_price_analytics_platform 
ON mv_price_analytics_summary (platform);

-- =============================================
-- System Performance Materialized View
-- =============================================

-- Create materialized view for system performance analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_system_performance_summary AS
SELECT 
    DATE_TRUNC('hour', ps.checked_at) as hour,
    
    -- Request volume statistics
    COUNT(*) as total_requests,
    
    -- Overall success rate
    COUNT(CASE WHEN ps.price IS NOT NULL AND ps.price > 0 THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100 as overall_success_rate,
    
    -- Platform distribution
    COUNT(CASE WHEN cu.platform = 'amazon' THEN 1 END) as amazon_requests,
    COUNT(CASE WHEN cu.platform = 'walmart' THEN 1 END) as walmart_requests,
    COUNT(CASE WHEN cu.platform = 'ebay' THEN 1 END) as ebay_requests,
    COUNT(CASE WHEN cu.platform = 'shopify' THEN 1 END) as shopify_requests,
    COUNT(CASE WHEN cu.platform = 'other' THEN 1 END) as other_platform_requests,
    
    -- Error analysis
    COUNT(CASE WHEN ps.price IS NULL OR ps.price = 0 THEN 1 END) as failed_requests,
    
    -- Performance indicators
    COUNT(DISTINCT cu.shop_id) as active_shops,
    COUNT(DISTINCT ps.competitor_url_id) as active_competitors

FROM price_snapshots ps
JOIN competitor_urls cu ON ps.competitor_url_id = cu.id
WHERE ps.checked_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', ps.checked_at)
ORDER BY hour DESC;

-- Create indexes for system performance view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_system_performance_unique 
ON mv_system_performance_summary (hour);

CREATE INDEX IF NOT EXISTS idx_mv_system_performance_hour 
ON mv_system_performance_summary (hour DESC);

-- =============================================
-- Refresh Functions for Materialized Views
-- =============================================

-- Function to refresh discovery performance summary
CREATE OR REPLACE FUNCTION refresh_discovery_performance_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_discovery_performance_summary;
    -- Log the refresh
    INSERT INTO audit_logs (action, details, created_at) 
    VALUES ('REFRESH_MATERIALIZED_VIEW', 'Refreshed mv_discovery_performance_summary', CURRENT_TIMESTAMP);
EXCEPTION
    WHEN OTHERS THEN
        -- Log any errors
        INSERT INTO audit_logs (action, details, created_at) 
        VALUES ('ERROR', 'Failed to refresh mv_discovery_performance_summary: ' || SQLERRM, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh competitor analytics summary
CREATE OR REPLACE FUNCTION refresh_competitor_analytics_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_competitor_analytics_summary;
    INSERT INTO audit_logs (action, details, created_at) 
    VALUES ('REFRESH_MATERIALIZED_VIEW', 'Refreshed mv_competitor_analytics_summary', CURRENT_TIMESTAMP);
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO audit_logs (action, details, created_at) 
        VALUES ('ERROR', 'Failed to refresh mv_competitor_analytics_summary: ' || SQLERRM, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh price analytics summary
CREATE OR REPLACE FUNCTION refresh_price_analytics_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_price_analytics_summary;
    INSERT INTO audit_logs (action, details, created_at) 
    VALUES ('REFRESH_MATERIALIZED_VIEW', 'Refreshed mv_price_analytics_summary', CURRENT_TIMESTAMP);
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO audit_logs (action, details, created_at) 
        VALUES ('ERROR', 'Failed to refresh mv_price_analytics_summary: ' || SQLERRM, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh system performance summary
CREATE OR REPLACE FUNCTION refresh_system_performance_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_system_performance_summary;
    INSERT INTO audit_logs (action, details, created_at) 
    VALUES ('REFRESH_MATERIALIZED_VIEW', 'Refreshed mv_system_performance_summary', CURRENT_TIMESTAMP);
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO audit_logs (action, details, created_at) 
        VALUES ('ERROR', 'Failed to refresh mv_system_performance_summary: ' || SQLERRM, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Master function to refresh all market intelligence views
CREATE OR REPLACE FUNCTION refresh_all_mi_materialized_views()
RETURNS void AS $$
BEGIN
    -- Refresh all views in sequence
    PERFORM refresh_discovery_performance_summary();
    PERFORM refresh_competitor_analytics_summary();
    PERFORM refresh_price_analytics_summary();
    PERFORM refresh_system_performance_summary();
    
    -- Log completion
    INSERT INTO audit_logs (action, details, created_at) 
    VALUES ('REFRESH_MATERIALIZED_VIEW', 'Completed refresh of all Market Intelligence materialized views', CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Grant Permissions
-- =============================================

-- Grant read access to materialized views
GRANT SELECT ON mv_discovery_performance_summary TO PUBLIC;
GRANT SELECT ON mv_competitor_analytics_summary TO PUBLIC;
GRANT SELECT ON mv_price_analytics_summary TO PUBLIC;
GRANT SELECT ON mv_system_performance_summary TO PUBLIC;

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON MATERIALIZED VIEW mv_discovery_performance_summary IS 
'Discovery performance analytics including success rates, relevance scores, and source distribution for the last 30 days.';

COMMENT ON MATERIALIZED VIEW mv_competitor_analytics_summary IS 
'Competitor analytics including active/archived ratios, platform distribution, and shop-level statistics. Updated daily.';

COMMENT ON MATERIALIZED VIEW mv_price_analytics_summary IS 
'Price analytics including success rates by platform, price statistics, and competitor tracking. Updated every 4 hours.';

COMMENT ON MATERIALIZED VIEW mv_system_performance_summary IS 
'System-wide performance metrics including success rates, platform distribution, and hourly processing statistics. Refreshed every hour.';

-- =============================================
-- Initial Data Population
-- =============================================

-- Populate materialized views with initial data
SELECT refresh_all_mi_materialized_views();