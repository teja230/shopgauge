-- Advanced query optimization indexes for better performance
-- This migration adds strategic indexes to improve query performance

-- Optimize shop_sessions queries
-- Index for session cleanup queries (finding expired/inactive sessions)
CREATE INDEX IF NOT EXISTS idx_shop_sessions_cleanup ON shop_sessions(is_active, last_accessed_at);

-- Composite index for shop session lookups
CREATE INDEX IF NOT EXISTS idx_shop_sessions_shop_active ON shop_sessions(shop_id, is_active, last_accessed_at);

-- Optimize notifications queries  
-- Index for notification queries by shop and read status
CREATE INDEX IF NOT EXISTS idx_notifications_shop_read ON notifications(shop, read, created_at);

-- Index for unread notifications count queries (simplified without WHERE clause)
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(shop, read);

-- Optimize audit_logs queries (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        -- Index for audit log queries by shop and timestamp
        CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_timestamp ON audit_logs(shop_id, created_at);
        
        -- Index for recent audit logs (simplified without time-based WHERE clause)
        CREATE INDEX IF NOT EXISTS idx_audit_logs_recent ON audit_logs(created_at);
    END IF;
END $$;

-- Optimize daily_metrics queries
-- Composite index for metrics queries by shop and date range
CREATE INDEX IF NOT EXISTS idx_daily_metrics_shop_date ON daily_metrics(shop_id, date);

-- Index for recent metrics queries (simplified without time-based WHERE clause)
CREATE INDEX IF NOT EXISTS idx_daily_metrics_recent ON daily_metrics(date, shop_id);

-- Add database statistics update
ANALYZE shop_sessions;
ANALYZE notifications;
ANALYZE daily_metrics;

-- Add comments for documentation
COMMENT ON INDEX idx_shop_sessions_cleanup IS 'Optimizes session cleanup queries';
COMMENT ON INDEX idx_shop_sessions_shop_active IS 'Optimizes active session lookups by shop';
COMMENT ON INDEX idx_notifications_shop_read IS 'Optimizes notification queries by shop and read status';
COMMENT ON INDEX idx_notifications_unread IS 'Optimizes unread notification count queries';
COMMENT ON INDEX idx_daily_metrics_shop_date IS 'Optimizes metrics queries by shop and date range';
COMMENT ON INDEX idx_daily_metrics_recent IS 'Optimizes recent metrics queries';