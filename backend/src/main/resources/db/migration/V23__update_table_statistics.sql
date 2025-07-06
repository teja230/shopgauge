-- Update table statistics to help query planner optimize performance
-- This migration contains non-transactional ANALYZE statements
-- and must be run separately from transactional index creation

-- Update statistics for shop_sessions table to help query planner
-- This improves performance for session-related queries
ANALYZE shop_sessions;

-- Update statistics for notifications table to help query planner  
-- This improves performance for notification-related queries
ANALYZE notifications; 