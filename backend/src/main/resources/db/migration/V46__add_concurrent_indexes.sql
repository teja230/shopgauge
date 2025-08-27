-- PRODUCTION OPTIMIZATION: Add CONCURRENTLY to critical indexes only
-- Note: Since we can't mix transactional and non-transactional statements,
-- we'll create the concurrent index with a new name instead of dropping/recreating

-- Create concurrent version of session index with new name
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_session_id_covering_v2
ON shop_sessions(session_id) 
INCLUDE (last_accessed_at, updated_at, is_active);

-- Note: The old index idx_shop_sessions_session_id_covering will remain
-- and can be dropped in a future maintenance window if needed
