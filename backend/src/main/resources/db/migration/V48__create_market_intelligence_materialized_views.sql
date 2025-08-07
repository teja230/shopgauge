-- ====================================================================
-- CORRECTED Market Intelligence Materialized Views Migration
-- ====================================================================
-- This migration creates materialized views for analytics dashboards
-- using only tables that actually exist in the database schema.
-- ====================================================================

-- Discovery Performance Summary View
-- Uses competitor_urls and price_snapshots data for performance analytics
-- Ensure idempotency if views were partially created in a previous failed run
DROP MATERIALIZED VIEW IF EXISTS mv_discovery_performance_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_competitor_analytics_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_price_analytics_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_system_performance_summary CASCADE;

CREATE MATERIALIZED VIEW mv_discovery_performance_summary AS
SELECT 
    'discovery_performance' as metric_type,
    COUNT(DISTINCT cu.id) as total_competitors,
    COUNT(DISTINCT cu.shop_id) as total_shops,
    COUNT(DISTINCT CASE WHEN cu.status = 'active' THEN cu.id END) as active_competitors,
    COUNT(DISTINCT ps.id) as total_price_checks,
    COALESCE(AVG(ps.response_time_ms), 0) as avg_response_time,
    COUNT(DISTINCT CASE WHEN ps.checked_at > NOW() - INTERVAL '24 hours' THEN ps.id END) as recent_checks,
    COUNT(DISTINCT CASE WHEN cu.error_count > 0 THEN cu.id END) as competitors_with_errors,
    CURRENT_TIMESTAMP as last_updated
FROM competitor_urls cu
LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id AND ps.deleted_at IS NULL
WHERE cu.deleted_at IS NULL
WITH NO DATA;

-- Create index for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_discovery_performance_summary_last_updated 
ON mv_discovery_performance_summary(last_updated);

-- Competitor Analytics Summary View  
-- Aggregates competitor data by shop and platform
CREATE MATERIALIZED VIEW mv_competitor_analytics_summary AS
SELECT 
    cu.shop_id,
    cu.platform,
    COUNT(cu.id) as competitor_count,
    COUNT(CASE WHEN cu.status = 'active' THEN 1 END) as active_count,
    COUNT(CASE WHEN cu.status = 'inactive' THEN 1 END) as inactive_count,
    AVG(cu.error_count) as avg_error_count,
    MAX(cu.last_successful_check) as last_successful_check,
    COUNT(CASE WHEN cu.last_successful_check > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_activity_count,
    CURRENT_TIMESTAMP as last_updated
FROM competitor_urls cu
WHERE cu.deleted_at IS NULL
GROUP BY cu.shop_id, cu.platform
WITH NO DATA;

-- Create index for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_competitor_analytics_summary_shop_platform 
ON mv_competitor_analytics_summary(shop_id, platform);

-- Price Analytics Summary View
-- Aggregates price data for trend analysis
CREATE MATERIALIZED VIEW mv_price_analytics_summary AS
SELECT 
    ps.competitor_url_id,
    cu.shop_id,
    cu.platform,
    COUNT(ps.id) as total_price_checks,
    AVG(ps.price) as avg_price,
    MIN(ps.price) as min_price,
    MAX(ps.price) as max_price,
    COUNT(CASE WHEN ps.price_change_percent IS NOT NULL THEN 1 END) as price_changes,
    AVG(CASE WHEN ps.price_change_percent IS NOT NULL THEN ps.price_change_percent END) as avg_price_change_percent,
    COUNT(CASE WHEN ps.significant_change = true THEN 1 END) as significant_changes,
    COUNT(CASE WHEN ps.in_stock = true THEN 1 END) as in_stock_count,
    COUNT(CASE WHEN ps.in_stock = false THEN 1 END) as out_of_stock_count,
    MAX(ps.checked_at) as last_price_check,
    AVG(ps.response_time_ms) as avg_response_time,
    CURRENT_TIMESTAMP as last_updated
FROM price_snapshots ps
JOIN competitor_urls cu ON ps.competitor_url_id = cu.id
WHERE ps.deleted_at IS NULL 
  AND cu.deleted_at IS NULL
GROUP BY ps.competitor_url_id, cu.shop_id, cu.platform
WITH NO DATA;

-- Create index for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_price_analytics_summary_competitor_shop 
ON mv_price_analytics_summary(competitor_url_id, shop_id);

-- System Performance Summary View
-- System-wide performance metrics without referencing non-existent tables
CREATE MATERIALIZED VIEW mv_system_performance_summary AS
SELECT 
    'system_performance' as metric_type,
    COUNT(DISTINCT cu.shop_id) as total_active_shops,
    COUNT(cu.id) as total_competitors,
    COUNT(ps.id) as total_price_snapshots,
    COUNT(pa.id) as total_price_alerts,
    AVG(ps.response_time_ms) as avg_response_time,
    COUNT(CASE WHEN cu.error_count = 0 THEN 1 END) as healthy_competitors,
    COUNT(CASE WHEN cu.error_count > 0 THEN 1 END) as unhealthy_competitors,
    COUNT(CASE WHEN ps.checked_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_activity_1h,
    COUNT(CASE WHEN ps.checked_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_activity_24h,
    CURRENT_TIMESTAMP as last_updated
FROM competitor_urls cu
LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id AND ps.deleted_at IS NULL
LEFT JOIN price_alerts pa ON cu.id = pa.competitor_url_id
WHERE cu.deleted_at IS NULL
WITH NO DATA;

-- Create index for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_system_performance_summary_last_updated 
ON mv_system_performance_summary(last_updated);

-- ====================================================================
-- MATERIALIZED VIEW REFRESH FUNCTIONS (WITHOUT audit_logs)
-- ====================================================================

-- Function to refresh discovery performance summary
CREATE OR REPLACE FUNCTION refresh_mv_discovery_performance_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_discovery_performance_summary;
    
    -- Log to application logs (remove audit_logs reference)
    RAISE NOTICE 'Refreshed mv_discovery_performance_summary at %', NOW();
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to refresh mv_discovery_performance_summary: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh competitor analytics summary
CREATE OR REPLACE FUNCTION refresh_mv_competitor_analytics_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_competitor_analytics_summary;
    
    -- Log to application logs
    RAISE NOTICE 'Refreshed mv_competitor_analytics_summary at %', NOW();
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to refresh mv_competitor_analytics_summary: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh price analytics summary
CREATE OR REPLACE FUNCTION refresh_mv_price_analytics_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_price_analytics_summary;
    
    -- Log to application logs
    RAISE NOTICE 'Refreshed mv_price_analytics_summary at %', NOW();
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to refresh mv_price_analytics_summary: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh system performance summary
CREATE OR REPLACE FUNCTION refresh_mv_system_performance_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_system_performance_summary;
    
    -- Log to application logs
    RAISE NOTICE 'Refreshed mv_system_performance_summary at %', NOW();
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to refresh mv_system_performance_summary: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_market_intelligence_views()
RETURNS void AS $$
BEGIN
    PERFORM refresh_mv_discovery_performance_summary();
    PERFORM refresh_mv_competitor_analytics_summary();
    PERFORM refresh_mv_price_analytics_summary();
    PERFORM refresh_mv_system_performance_summary();
    
    RAISE NOTICE 'Refreshed all Market Intelligence materialized views at %', NOW();
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to refresh some Market Intelligence materialized views: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- INITIAL DATA POPULATION (DISABLED)
-- ====================================================================
-- Note: Do not populate data during migration to avoid startup stalls on small instances.
-- Admin can trigger refresh on-demand after deployment when needed.

-- ====================================================================
-- GRANTS AND PERMISSIONS
-- ====================================================================

-- Grant read access to materialized views
GRANT SELECT ON mv_discovery_performance_summary TO storesight;
GRANT SELECT ON mv_competitor_analytics_summary TO storesight;
GRANT SELECT ON mv_price_analytics_summary TO storesight;
GRANT SELECT ON mv_system_performance_summary TO storesight;

-- Grant execute permissions on refresh functions
GRANT EXECUTE ON FUNCTION refresh_mv_discovery_performance_summary() TO storesight;
GRANT EXECUTE ON FUNCTION refresh_mv_competitor_analytics_summary() TO storesight;
GRANT EXECUTE ON FUNCTION refresh_mv_price_analytics_summary() TO storesight;
GRANT EXECUTE ON FUNCTION refresh_mv_system_performance_summary() TO storesight;
GRANT EXECUTE ON FUNCTION refresh_all_market_intelligence_views() TO storesight;

-- ====================================================================
-- COMMENTS FOR DOCUMENTATION
-- ====================================================================

COMMENT ON MATERIALIZED VIEW mv_discovery_performance_summary IS 
'Aggregated performance metrics for discovery operations across all shops';

COMMENT ON MATERIALIZED VIEW mv_competitor_analytics_summary IS 
'Summary of competitor data by shop and platform for analytics dashboard';

COMMENT ON MATERIALIZED VIEW mv_price_analytics_summary IS 
'Price analytics aggregated by competitor URL for trend analysis';

COMMENT ON MATERIALIZED VIEW mv_system_performance_summary IS 
'System-wide performance and health metrics for monitoring dashboard';

COMMENT ON FUNCTION refresh_all_market_intelligence_views() IS 
'Refreshes all Market Intelligence materialized views in the correct order';