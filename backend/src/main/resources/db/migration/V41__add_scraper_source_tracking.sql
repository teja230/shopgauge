-- V41: Add Scraper Source Tracking
-- This migration adds scraper source tracking to distinguish between different scraping methods

-- Add scraper_source column to price_snapshots table
ALTER TABLE price_snapshots 
ADD COLUMN IF NOT EXISTS scraper_source VARCHAR(50) DEFAULT 'direct';

-- Add comment to clarify scraper source usage
COMMENT ON COLUMN price_snapshots.scraper_source IS 'Source of price data: direct (Jsoup/Selenium), scrapingdog, serper, serpapi, or cached';

-- Update existing price_snapshots with appropriate scraper sources based on scraper_version
UPDATE price_snapshots 
SET scraper_source = CASE 
    WHEN scraper_version LIKE '%cached%' THEN 'cached'
    WHEN scraper_version LIKE '%immediate%' THEN 'direct'
    WHEN scraper_version LIKE '%v2.0%' THEN 'direct'
    ELSE 'direct'
END
WHERE scraper_source = 'direct' OR scraper_source IS NULL;

-- Add index for scraper_source for efficient querying
CREATE INDEX IF NOT EXISTS idx_price_snapshots_scraper_source ON price_snapshots (scraper_source);

-- Add index for combined platform and scraper source analysis
CREATE INDEX IF NOT EXISTS idx_price_snapshots_platform_source ON price_snapshots (platform, scraper_source); 