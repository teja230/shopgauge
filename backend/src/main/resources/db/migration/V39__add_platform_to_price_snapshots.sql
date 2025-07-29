-- Add platform column to price_snapshots table for better tracking
ALTER TABLE price_snapshots 
ADD COLUMN IF NOT EXISTS platform VARCHAR(50);

-- Update existing price_snapshots with platform information based on competitor_urls
UPDATE price_snapshots 
SET platform = cu.platform
FROM competitor_urls cu
WHERE price_snapshots.competitor_url_id = cu.id 
AND price_snapshots.platform IS NULL 
AND cu.platform IS NOT NULL;

-- Set default platform for any remaining records
UPDATE price_snapshots 
SET platform = 'unknown'
WHERE platform IS NULL; 