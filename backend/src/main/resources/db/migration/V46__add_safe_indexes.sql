-- SAFE INDEX CREATION: Add indexes without CONCURRENTLY to avoid deployment timeouts
-- These indexes will be created quickly and safely during deployment

-- Add index for shop_sessions if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_shop_sessions_session_id_safe
ON shop_sessions(session_id);

-- Add index for daily_metrics if it doesn't exist  
CREATE INDEX IF NOT EXISTS idx_daily_metrics_shop_date_safe
ON daily_metrics(shop_id, date);

-- Add index for competitor_suggestions if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_shop_product_safe
ON competitor_suggestions(shop_id, product_id);

-- Note: These indexes are created without CONCURRENTLY to ensure fast deployment
-- They can be optimized later in a maintenance window if needed
