-- V33: Add Analytics Views
-- This migration creates analytics views that depend on the deleted_at column

-- Create a view for competitor performance analytics
CREATE OR REPLACE VIEW competitor_performance_analytics AS
SELECT 
    cu.id,
    cu.shop_id,
    cu.url,
    cu.domain,
    cu.platform,
    cu.status,
    cu.error_count,
    cu.last_successful_check,
    cu.response_time_ms,
    COUNT(ps.id) as total_snapshots,
    COUNT(ps.id) FILTER (WHERE ps.significant_change = true) as significant_changes,
    AVG(ps.price) as avg_price,
    MIN(ps.price) as min_price,
    MAX(ps.price) as max_price,
    MAX(ps.checked_at) as last_price_check,
    COUNT(pa.id) as total_alerts
FROM competitor_urls cu
LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id
LEFT JOIN price_alerts pa ON cu.id = pa.competitor_url_id
WHERE cu.deleted_at IS NULL
GROUP BY cu.id, cu.shop_id, cu.url, cu.domain, cu.platform, cu.status, cu.error_count, cu.last_successful_check, cu.response_time_ms;

COMMENT ON VIEW competitor_performance_analytics IS 'Comprehensive analytics view for competitor monitoring performance';

-- Grant necessary permissions
GRANT SELECT ON competitor_performance_analytics TO PUBLIC; 