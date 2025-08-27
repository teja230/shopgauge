-- PRODUCTION OPTIMIZATION: Add CONCURRENTLY to critical indexes only
-- Simplified to avoid connection leaks during deployment

-- Only recreate the most critical index for session management
DROP INDEX IF EXISTS idx_shop_sessions_session_id_covering;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_session_id_covering 
ON shop_sessions(session_id) 
INCLUDE (last_accessed_at, updated_at, is_active);

-- Note: Other indexes will be added in future deployments to avoid startup delays
