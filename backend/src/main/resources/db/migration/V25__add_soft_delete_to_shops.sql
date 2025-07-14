-- Flyway Migration: Add soft delete fields to shops table for billing and data retention

-- Add soft delete columns to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(255);

-- Create index for efficient querying of active shops
CREATE INDEX IF NOT EXISTS idx_shops_is_active ON shops(is_active);

-- Create index for efficient querying of deleted shops
CREATE INDEX IF NOT EXISTS idx_shops_deleted_at ON shops(deleted_at);

-- Create index for billing queries (active shops)
CREATE INDEX IF NOT EXISTS idx_shops_billing ON shops(is_active, created_at);

-- Update existing shops to be active (in case of data migration)
UPDATE shops SET is_active = true WHERE is_active IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN shops.deleted_at IS 'Timestamp when shop was soft deleted (for billing retention)';
COMMENT ON COLUMN shops.is_active IS 'Whether shop is active (true) or soft deleted (false)';
COMMENT ON COLUMN shops.deletion_reason IS 'Reason for shop deletion (for billing and compliance)'; 