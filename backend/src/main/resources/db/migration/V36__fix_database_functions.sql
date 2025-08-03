-- Fix database functions with correct PostgreSQL syntax

-- Recreate the cleanup function with proper syntax
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

-- Recreate the query performance analysis function
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

-- Recreate the statistics update function
CREATE OR REPLACE FUNCTION update_market_intelligence_statistics()
RETURNS void AS $$
BEGIN
    -- Analyze tables for better query planning
    ANALYZE competitor_urls;
    ANALYZE price_snapshots;
    ANALYZE competitor_suggestions;
    ANALYZE market_intelligence_costs;
    
    -- Log the statistics update
    INSERT INTO admin_audit_logs (action, details, created_at)
    VALUES ('STATISTICS_UPDATE', 
            jsonb_build_object('timestamp', CURRENT_TIMESTAMP, 'tables_analyzed', 4),
            CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;