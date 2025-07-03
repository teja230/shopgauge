-- Add performance indexes for session cleanup and lookup operations
-- These indexes will significantly improve the performance of session cleanup queries

-- Index for findExpiredSessions() query
-- Query: SELECT ss FROM ShopSession ss WHERE ss.expiresAt IS NOT NULL AND ss.expiresAt < CURRENT_TIMESTAMP AND ss.isActive = true
CREATE INDEX IF NOT EXISTS idx_shop_sessions_expired_cleanup 
ON shop_sessions(expires_at, is_active) 
WHERE expires_at IS NOT NULL AND is_active = true;

-- Index for findInactiveSessionsOlderThan() query  
-- Query: SELECT ss FROM ShopSession ss WHERE ss.lastAccessedAt < :cutoffDate AND ss.isActive = true
CREATE INDEX IF NOT EXISTS idx_shop_sessions_inactive_cleanup 
ON shop_sessions(last_accessed_at, is_active) 
WHERE is_active = true;

-- Index for deleteOldInactiveSessions() query
-- Query: DELETE FROM ShopSession ss WHERE ss.isActive = false AND ss.updatedAt < :cutoffDate
CREATE INDEX IF NOT EXISTS idx_shop_sessions_delete_cleanup 
ON shop_sessions(is_active, updated_at) 
WHERE is_active = false;

-- Composite index for shop and session lookup optimization
-- Query: findActiveSessionByShopDomainAndSessionId, findByShopAndSessionIdAndIsActiveTrue
CREATE INDEX IF NOT EXISTS idx_shop_sessions_shop_session_active 
ON shop_sessions(shop_id, session_id, is_active) 
WHERE is_active = true;

-- Index for session counting and listing by shop
-- Query: findByShopAndIsActiveTrueOrderByLastAccessedAtDesc, countByShopAndIsActiveTrue
CREATE INDEX IF NOT EXISTS idx_shop_sessions_shop_active_accessed 
ON shop_sessions(shop_id, is_active, last_accessed_at DESC) 
WHERE is_active = true;

-- Index for general session cleanup by session_id
-- Used in various cleanup operations that reference session_id
CREATE INDEX IF NOT EXISTS idx_shop_sessions_session_id_active 
ON shop_sessions(session_id, is_active);

-- Add comments for documentation
COMMENT ON INDEX idx_shop_sessions_expired_cleanup IS 'Optimizes cleanup of expired sessions';
COMMENT ON INDEX idx_shop_sessions_inactive_cleanup IS 'Optimizes cleanup of inactive sessions by last_accessed_at';
COMMENT ON INDEX idx_shop_sessions_delete_cleanup IS 'Optimizes deletion of old inactive sessions';
COMMENT ON INDEX idx_shop_sessions_shop_session_active IS 'Optimizes lookup by shop and session ID';
COMMENT ON INDEX idx_shop_sessions_shop_active_accessed IS 'Optimizes shop session listing and counting';
COMMENT ON INDEX idx_shop_sessions_session_id_active IS 'Optimizes general session lookups and cleanup'; 