-- Update table statistics for performance optimization
-- This helps the query planner make better decisions with the new indexes

-- Update statistics for shop_sessions table
ANALYZE shop_sessions;

-- Update statistics for notifications table  
ANALYZE notifications;

-- Update statistics for shops table (may be referenced in joins)
ANALYZE shops; 