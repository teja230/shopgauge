-- Performance optimization indexes for slow queries identified in monitoring
-- These indexes target the most frequent and slow query patterns

-- Index for frequent session_id lookups and updates (the slowest queries)
-- This supports: UPDATE shop_sessions SET ... WHERE session_id = ?
-- Note: CONCURRENTLY should be used in production to avoid table locks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_session_id_covering 
ON shop_sessions(session_id) 
INCLUDE (last_accessed_at, updated_at, is_active);

-- Index for notification deletions by ID (second slowest query pattern)
-- This supports: DELETE FROM notifications WHERE id = ?
-- Primary key already exists, but add covering index for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_id_covering 
ON notifications(id) 
INCLUDE (shop, created_at, deleted);

-- Composite index for session cleanup queries
-- This supports session cleanup operations that check both is_active and timestamps
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_cleanup_optimized 
ON shop_sessions(is_active, last_accessed_at, updated_at) 
WHERE is_active = true;

-- Index for notification cleanup queries
-- This supports bulk notification deletion patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_cleanup_optimized 
ON notifications(created_at, deleted, shop, read) 
WHERE deleted = false;

-- Partial index for active session counting and listing
-- This supports: SELECT * FROM shop_sessions WHERE shop_id = ? AND is_active = true
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_active_shop_optimized 
ON shop_sessions(shop_id, last_accessed_at DESC) 
WHERE is_active = true;

-- Index for notification session filtering
-- This supports: SELECT * FROM notifications WHERE shop = ? AND (session_id = ? OR session_id IS NULL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_session_filtering 
ON notifications(shop, session_id, created_at DESC) 
WHERE deleted = false;

-- Index for session heartbeat updates (most frequent operation)
-- This supports frequent last_accessed_at updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_heartbeat 
ON shop_sessions(session_id, last_accessed_at) 
WHERE is_active = true; 