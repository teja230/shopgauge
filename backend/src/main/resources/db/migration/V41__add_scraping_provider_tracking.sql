-- V41: Add Scraping Provider Tracking
-- This migration adds tracking for which external API/service was used for scraping

-- Add scraping_provider column to competitor_urls table
ALTER TABLE competitor_urls 
ADD COLUMN IF NOT EXISTS scraping_provider VARCHAR(50) DEFAULT 'jsoup';

-- Add scraping_provider column to price_snapshots table  
ALTER TABLE price_snapshots 
ADD COLUMN IF NOT EXISTS scraping_provider VARCHAR(50) DEFAULT 'jsoup';

-- Update existing records with default provider based on scraper_version
UPDATE competitor_urls 
SET scraping_provider = CASE 
    WHEN scraper_version LIKE '%selenium%' THEN 'selenium'
    WHEN scraper_version LIKE '%cached%' THEN 'cached'
    ELSE 'jsoup'
END
WHERE scraping_provider = 'jsoup';

UPDATE price_snapshots 
SET scraping_provider = CASE 
    WHEN scraper_version LIKE '%selenium%' THEN 'selenium'
    WHEN scraper_version LIKE '%cached%' THEN 'cached'
    WHEN scraper_version LIKE '%immediate%' THEN 'jsoup'
    ELSE 'jsoup'
END
WHERE scraping_provider = 'jsoup';

-- Add comments to clarify provider usage
COMMENT ON COLUMN competitor_urls.scraping_provider IS 'External API/service used for scraping (jsoup, selenium, scrapingdog, serper, cached)';
COMMENT ON COLUMN price_snapshots.scraping_provider IS 'External API/service used for this price scraping (jsoup, selenium, scrapingdog, serper, cached)';

-- Add index for scraping_provider for analytics
CREATE INDEX IF NOT EXISTS idx_competitor_urls_scraping_provider ON competitor_urls (scraping_provider);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_scraping_provider ON price_snapshots (scraping_provider); 