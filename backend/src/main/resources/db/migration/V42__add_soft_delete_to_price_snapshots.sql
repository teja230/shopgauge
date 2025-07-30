-- Add soft delete support to price_snapshots table
ALTER TABLE price_snapshots 
ADD COLUMN deleted_at TIMESTAMP NULL;

-- Add index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_price_snapshots_deleted_at ON price_snapshots (deleted_at);

-- Add comment for documentation
COMMENT ON COLUMN price_snapshots.deleted_at IS 'Soft delete timestamp - NULL means active, timestamp means deleted'; 