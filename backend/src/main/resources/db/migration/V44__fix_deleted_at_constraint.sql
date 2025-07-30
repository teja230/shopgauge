-- V44: Fix deleted_at constraint issue for database tools
-- This migration adds a composite unique constraint to resolve tool-specific issues

-- Add composite unique constraint for price_snapshots
-- This ensures that active records (deleted_at IS NULL) are unique per competitor
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_snapshots_active_unique 
ON price_snapshots (competitor_url_id, checked_at) 
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_price_snapshots_active_unique IS 'Ensures unique active price snapshots per competitor per check time';

-- Note: This resolves the database tool issue where it expects unique constraints
-- The actual business logic doesn't require this, but it satisfies the tool's expectations 