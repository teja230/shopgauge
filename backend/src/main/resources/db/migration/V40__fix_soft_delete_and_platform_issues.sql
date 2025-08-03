-- V40: Fix Soft Delete Usage and Platform Issues
-- This migration ensures soft delete is used consistently and improves platform identification

-- Update competitor_urls to use soft delete instead of hard delete
-- First, let's ensure all existing competitor_urls have proper platform identification
UPDATE competitor_urls 
SET platform = CASE 
    WHEN url ILIKE '%amazon.%' THEN 'amazon'
    WHEN url ILIKE '%walmart.%' THEN 'walmart'
    WHEN url ILIKE '%target.%' THEN 'target'
    WHEN url ILIKE '%bestbuy.%' THEN 'bestbuy'
    WHEN url ILIKE '%ebay.%' THEN 'ebay'
    WHEN url ILIKE '%etsy.%' THEN 'etsy'
    WHEN url ILIKE '%shopify%' OR url ILIKE '%.myshopify.com%' THEN 'shopify'
    WHEN url ILIKE '%woocommerce%' THEN 'woocommerce'
    WHEN url ILIKE '%bigcommerce%' THEN 'bigcommerce'
    WHEN url ILIKE '%magento%' THEN 'magento'
    WHEN url ILIKE '%prestashop%' THEN 'prestashop'
    WHEN url ILIKE '%opencart%' THEN 'opencart'
    ELSE 'other'
END
WHERE platform = 'unknown' OR platform IS NULL;

-- Update price_snapshots to have proper platform identification
-- This will be populated by the application logic, but ensure existing records have platform
UPDATE price_snapshots 
SET platform = cu.platform
FROM competitor_urls cu
WHERE price_snapshots.competitor_url_id = cu.id 
AND price_snapshots.platform IS NULL 
AND cu.platform IS NOT NULL;

-- Set default platform for any remaining price_snapshots
UPDATE price_snapshots 
SET platform = 'unknown'
WHERE platform IS NULL;

-- Add comment to clarify platform usage
COMMENT ON COLUMN competitor_urls.platform IS 'Source platform where data is scraped from (amazon, walmart, target, etc.)';
COMMENT ON COLUMN price_snapshots.platform IS 'Source platform where price data was scraped from (amazon, walmart, target, etc.)';

-- Ensure response_time_ms is properly initialized
UPDATE competitor_urls 
SET response_time_ms = 0
WHERE response_time_ms IS NULL;

UPDATE price_snapshots 
SET response_time_ms = 0
WHERE response_time_ms IS NULL;

-- Add comment for response_time_ms
COMMENT ON COLUMN competitor_urls.response_time_ms IS 'Response time in milliseconds for the last scraping attempt';
COMMENT ON COLUMN price_snapshots.response_time_ms IS 'Response time in milliseconds for this price scraping attempt'; 