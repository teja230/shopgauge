-- Add last_discovery_at column to shops table for server-side discovery cooldown tracking
-- This prevents discovery spam across different devices/browsers by storing cooldown server-side

ALTER TABLE shops ADD COLUMN last_discovery_at TIMESTAMP;

-- Add index for efficient queries
CREATE INDEX idx_shops_last_discovery_at ON shops(last_discovery_at);

-- Add comment explaining the purpose
COMMENT ON COLUMN shops.last_discovery_at IS 'Timestamp of last competitor discovery run for this shop. Used for 24-hour cooldown enforcement across all devices/browsers.'; 