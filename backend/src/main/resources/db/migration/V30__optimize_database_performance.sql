-- Database Performance Optimization for Market Intelligence

-- Add composite indexes for common query patterns

-- Composite index for competitor URLs by shop and status
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Composite index for price snapshots with competitor and time
-- Moved to V34__add_performance_indexes.sql

-- Composite index for price snapshots with significant changes
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Composite index for price alerts by shop and creation time
-- Moved to V34__add_performance_indexes.sql due to table dependencies

-- Composite index for price alerts by notification status
-- Moved to V34__add_performance_indexes.sql due to table dependencies

-- Composite index for competitor suggestions by shop, status and relevance
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Composite index for market intelligence costs by shop and date range
CREATE INDEX IF NOT EXISTS idx_market_intelligence_costs_shop_date_desc 
ON market_intelligence_costs (shop_id, date DESC);

-- Composite index for market intelligence costs by provider performance
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Add partial indexes for active records only
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Add index for error tracking
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Add index for platform-based queries
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Add covering index for price snapshots summary queries
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Add index for time-based cleanup operations (without date predicate due to immutability requirement)
-- Moved to V34__add_performance_indexes.sql

-- Add index for audit and monitoring queries
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Create materialized view for competitor performance summary
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Add function to refresh materialized view
-- Moved to V34__add_performance_indexes.sql due to materialized view dependencies

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
    -- ANALYZE price_alerts; -- Table created in V32
    ANALYZE market_intelligence_costs;
    
    -- Refresh materialized view (moved to V34)
    -- PERFORM refresh_competitor_performance_summary();
    
    -- Log the statistics update
    INSERT INTO admin_audit_logs (action, details, created_at)
    VALUES ('STATISTICS_UPDATE', 
            jsonb_build_object('timestamp', CURRENT_TIMESTAMP, 'tables_analyzed', 5),
            CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Additional Performance Indexes (consolidated from V33)

-- Additional indexes for competitor_urls
-- Moved to V34__add_performance_indexes.sql due to column dependencies


-- Moved to V34__add_performance_indexes.sql

-- Additional indexes for price_snapshots
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Additional indexes for competitor_suggestions
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Additional indexes for market_intelligence_costs
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Additional indexes for price_alerts
-- Moved to V34__add_performance_indexes.sql due to column dependencies

-- Add table comments for documentation
COMMENT ON TABLE competitor_urls IS 'Stores competitor URLs being tracked for each shop with status and error tracking';
COMMENT ON TABLE price_snapshots IS 'Historical price data for competitors with change detection and performance metrics';
COMMENT ON TABLE competitor_suggestions IS 'AI-discovered competitor suggestions with relevance scoring';
-- COMMENT ON TABLE price_alerts IS 'Price change notifications and alert history'; -- Table created in V32
COMMENT ON TABLE market_intelligence_costs IS 'Cost tracking and performance metrics for API usage';

-- Add column comments for key fields
-- Moved to V34__add_performance_indexes.sql due to column dependencies