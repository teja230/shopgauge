-- Add CONCURRENTLY to existing indexes for production safety
-- This migration re-creates indexes with CONCURRENTLY to avoid table locks in production

-- Drop and recreate session_id covering index with CONCURRENTLY
DROP INDEX IF EXISTS idx_shop_sessions_session_id_covering;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_session_id_covering 
ON shop_sessions(session_id) 
INCLUDE (last_accessed_at, updated_at, is_active);

-- Drop and recreate notifications id covering index with CONCURRENTLY
DROP INDEX IF EXISTS idx_notifications_id_covering;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_id_covering 
ON notifications(id) 
INCLUDE (shop, created_at, deleted);

-- Drop and recreate session cleanup index with CONCURRENTLY
DROP INDEX IF EXISTS idx_shop_sessions_cleanup_optimized;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_cleanup_optimized 
ON shop_sessions(is_active, last_accessed_at, updated_at) 
WHERE is_active = true;

-- Drop and recreate notification cleanup index with CONCURRENTLY
DROP INDEX IF EXISTS idx_notifications_cleanup_optimized;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_cleanup_optimized 
ON notifications(created_at, deleted, shop, read) 
WHERE deleted = false;

-- Drop and recreate active session shop index with CONCURRENTLY
DROP INDEX IF EXISTS idx_shop_sessions_active_shop_optimized;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_active_shop_optimized 
ON shop_sessions(shop_id, last_accessed_at DESC) 
WHERE is_active = true;

-- Drop and recreate notification session filtering index with CONCURRENTLY
DROP INDEX IF EXISTS idx_notifications_session_filtering;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_session_filtering 
ON notifications(shop, session_id, created_at DESC) 
WHERE deleted = false;

-- Drop and recreate session heartbeat index with CONCURRENTLY
DROP INDEX IF EXISTS idx_shop_sessions_heartbeat;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_sessions_heartbeat 
ON shop_sessions(session_id, last_accessed_at) 
WHERE is_active = true;
