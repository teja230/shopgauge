-- Advanced Query Optimization Migration
-- This migration adds comprehensive indexes and optimizations for identified slow queries

-- ============================================================================
-- SHOP SESSIONS TABLE OPTIMIZATIONS
-- ============================================================================

-- Composite index for session heartbeat operations (most frequent)
-- Optimizes: UPDATE shop_sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_heartbeat_optimized 
ON shop_sessions(session_id, is_active) 
WHERE is_active = true;

-- Covering index for session lookup with all commonly accessed fields
-- Optimizes: SELECT * FROM shop_sessions WHERE session_id = ? AND is_active = true
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_lookup_covering 
ON shop_sessions(session_id, is_active) 
INCLUDE (shop_id, access_token, last_accessed_at, expires_at, created_at);

-- Optimized index for shop-based session queries
-- Optimizes: SELECT * FROM shop_sessions WHERE shop_id = ? AND is_active = true ORDER BY last_accessed_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_shop_active_optimized 
ON shop_sessions(shop_id, is_active, last_accessed_at DESC) 
WHERE is_active = true;

-- Index for security monitoring queries by IP address
-- Optimizes: SELECT * FROM shop_sessions WHERE ip_address = ? AND is_active = true
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_security_ip 
ON shop_sessions(ip_address, is_active, created_at DESC) 
WHERE is_active = true;

-- Index for user agent pattern matching (security monitoring)
-- Optimizes: SELECT * FROM shop_sessions WHERE user_agent LIKE '%pattern%' AND is_active = true
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_security_ua 
ON shop_sessions(user_agent, is_active, created_at DESC) 
WHERE is_active = true;

-- ============================================================================
-- NOTIFICATIONS TABLE OPTIMIZATIONS
-- ============================================================================

-- Composite index for session-specific notification queries
-- Optimizes: SELECT * FROM notifications WHERE shop = ? AND session_id = ? AND deleted = false
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_shop_session_optimized 
ON notifications(shop, session_id, deleted, created_at DESC) 
WHERE deleted = false;

-- Index for unread notification counting
-- Optimizes: SELECT COUNT(*) FROM notifications WHERE shop = ? AND read = false AND deleted = false
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread_count 
ON notifications(shop, read, deleted) 
WHERE read = false AND deleted = false;

-- Covering index for notification listing with all fields
-- Optimizes: SELECT * FROM notifications WHERE shop = ? AND deleted = false ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_listing_covering 
ON notifications(shop, deleted, created_at DESC) 
INCLUDE (id, session_id, title, message, category, read, scope);

-- Index for notification cleanup by creation date
-- Optimizes: DELETE FROM notifications WHERE created_at < ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_cleanup_date 
ON notifications(created_at) 
WHERE deleted = false;

-- Index for category-based filtering
-- Optimizes: SELECT * FROM notifications WHERE shop = ? AND category = ? AND deleted = false
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_category_filter 
ON notifications(shop, category, deleted, created_at DESC) 
WHERE deleted = false;

-- ============================================================================
-- AUDIT LOGS TABLE OPTIMIZATIONS
-- ============================================================================

-- Composite index for shop-based audit log queries
-- Optimizes: SELECT * FROM audit_logs WHERE shop_id = ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_shop_date_optimized 
ON audit_logs(shop_id, created_at DESC);

-- Index for action-based filtering
-- Optimizes: SELECT * FROM audit_logs WHERE shop_id = ? AND action = ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_shop_action 
ON audit_logs(shop_id, action, created_at DESC);

-- Index for date range queries
-- Optimizes: SELECT * FROM audit_logs WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_date_range 
ON audit_logs(created_at DESC);

-- Index for cleanup operations
-- Optimizes: DELETE FROM audit_logs WHERE created_at < ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_cleanup 
ON audit_logs(created_at);

-- Index for orphaned audit logs (from deleted shops)
-- Optimizes: SELECT * FROM audit_logs WHERE shop_id IS NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_orphaned 
ON audit_logs(shop_id, created_at DESC) 
WHERE shop_id IS NULL;

-- ============================================================================
-- SHOPS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for shopify domain lookups (most common)
-- Optimizes: SELECT * FROM shops WHERE shopify_domain = ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_domain_optimized 
ON shops(shopify_domain) 
WHERE deleted_at IS NULL;

-- Covering index for active shop queries
-- Optimizes: SELECT * FROM shops WHERE deleted_at IS NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_active_covering 
ON shops(deleted_at) 
INCLUDE (id, shopify_domain, shop_name, access_token, created_at, updated_at) 
WHERE deleted_at IS NULL;

-- Index for shop cleanup operations
-- Optimizes: SELECT * FROM shops WHERE deleted_at IS NOT NULL AND deleted_at < ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_cleanup 
ON shops(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- ADMIN AUDIT LOGS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for admin action queries
-- Optimizes: SELECT * FROM admin_audit_logs ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_audit_logs_date 
ON admin_audit_logs(created_at DESC);

-- Index for action-based filtering
-- Optimizes: SELECT * FROM admin_audit_logs WHERE action = ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_audit_logs_action 
ON admin_audit_logs(action, created_at DESC);

-- Index for IP-based security monitoring
-- Optimizes: SELECT * FROM admin_audit_logs WHERE ip_address = ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_audit_logs_ip 
ON admin_audit_logs(ip_address, created_at DESC);

-- ============================================================================
-- MARKET INTELLIGENCE COSTS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for shop-based cost queries
-- Optimizes: SELECT * FROM market_intelligence_costs WHERE shop_id = ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mi_costs_shop_date 
ON market_intelligence_costs(shop_id, created_at DESC);

-- Index for cost aggregation queries
-- Optimizes: SELECT SUM(cost) FROM market_intelligence_costs WHERE created_at >= ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mi_costs_aggregation 
ON market_intelligence_costs(created_at, cost);

-- Index for provider-based analysis
-- Optimizes: SELECT * FROM market_intelligence_costs WHERE provider = ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mi_costs_provider 
ON market_intelligence_costs(provider, created_at DESC);

-- ============================================================================
-- COMPETITOR SUGGESTIONS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for shop-based competitor queries
-- Optimizes: SELECT * FROM competitor_suggestions WHERE shop_id = ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_competitor_suggestions_shop 
ON competitor_suggestions(shop_id, created_at DESC);

-- Index for URL-based deduplication
-- Optimizes: SELECT * FROM competitor_suggestions WHERE competitor_url = ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_competitor_suggestions_url 
ON competitor_suggestions(competitor_url);

-- Index for product-based filtering
-- Optimizes: SELECT * FROM competitor_suggestions WHERE shop_id = ? AND product_title = ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_competitor_suggestions_product 
ON competitor_suggestions(shop_id, product_title, created_at DESC);

-- ============================================================================
-- QUERY RESULT CACHING SETUP
-- ============================================================================

-- Create a table for query result caching
CREATE TABLE IF NOT EXISTS query_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for cache expiration cleanup
CREATE INDEX IF NOT EXISTS idx_query_cache_expiration 
ON query_cache(expires_at);

-- Index for cache statistics
CREATE INDEX IF NOT EXISTS idx_query_cache_stats 
ON query_cache(last_accessed_at, hit_count);

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- Create a view for slow query monitoring
CREATE OR REPLACE VIEW slow_query_stats AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('shop_sessions', 'notifications', 'audit_logs', 'shops', 'admin_audit_logs', 'market_intelligence_costs', 'competitor_suggestions');

-- Create a view for index usage statistics
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ============================================================================
-- MAINTENANCE PROCEDURES
-- ============================================================================

-- Function to update table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    ANALYZE shop_sessions;
    ANALYZE notifications;
    ANALYZE audit_logs;
    ANALYZE shops;
    ANALYZE admin_audit_logs;
    ANALYZE market_intelligence_costs;
    ANALYZE competitor_suggestions;
    ANALYZE query_cache;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM query_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE query_cache IS 'Application-level query result caching for frequently accessed data';
COMMENT ON FUNCTION update_table_statistics() IS 'Updates PostgreSQL statistics for all main tables to improve query planning';
COMMENT ON FUNCTION cleanup_expired_cache() IS 'Removes expired entries from the query cache table';
COMMENT ON VIEW slow_query_stats IS 'Provides statistics for monitoring query performance and index effectiveness';
COMMENT ON VIEW index_usage_stats IS 'Shows index usage statistics to identify unused or underutilized indexes';