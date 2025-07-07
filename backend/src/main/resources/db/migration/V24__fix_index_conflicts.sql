-- Fix index creation conflicts from V22 migration
-- Drop and recreate indexes to ensure clean state

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_shop_sessions_session_id_covering;
DROP INDEX IF EXISTS idx_notifications_id_covering;
DROP INDEX IF EXISTS idx_shop_sessions_cleanup_optimized;
DROP INDEX IF EXISTS idx_notifications_cleanup_optimized;
DROP INDEX IF EXISTS idx_shop_sessions_active_shop_optimized;
DROP INDEX IF EXISTS idx_notifications_session_filtering;
DROP INDEX IF EXISTS idx_shop_sessions_heartbeat;

-- Recreate indexes without CONCURRENTLY to avoid conflicts
-- Index for frequent session_id lookups and updates
CREATE INDEX idx_shop_sessions_session_id_covering 
ON shop_sessions(session_id) 
INCLUDE (last_accessed_at, updated_at, is_active);

-- Index for notification deletions by ID
CREATE INDEX idx_notifications_id_covering 
ON notifications(id) 
INCLUDE (shop, created_at, deleted);

-- Composite index for session cleanup queries
CREATE INDEX idx_shop_sessions_cleanup_optimized 
ON shop_sessions(is_active, last_accessed_at, updated_at) 
WHERE is_active = true;

-- Index for notification cleanup queries
CREATE INDEX idx_notifications_cleanup_optimized 
ON notifications(created_at, deleted, shop, read) 
WHERE deleted = false;

-- Partial index for active session counting and listing
CREATE INDEX idx_shop_sessions_active_shop_optimized 
ON shop_sessions(shop_id, last_accessed_at DESC) 
WHERE is_active = true;

-- Index for notification session filtering
CREATE INDEX idx_notifications_session_filtering 
ON notifications(shop, session_id, created_at DESC) 
WHERE deleted = false;

-- Index for session heartbeat updates
CREATE INDEX idx_shop_sessions_heartbeat 
ON shop_sessions(session_id, last_accessed_at) 
WHERE is_active = true; 