-- Create price_alerts table for tracking price change notifications
CREATE TABLE price_alerts (
    id BIGSERIAL PRIMARY KEY,
    competitor_url_id BIGINT REFERENCES competitor_urls(id) ON DELETE CASCADE,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    change_percent DECIMAL(5,2),
    alert_type VARCHAR(20) NOT NULL, -- 'price_drop', 'price_increase', 'back_in_stock', 'out_of_stock'
    notification_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_price_alerts_shop_created ON price_alerts (shop_id, created_at DESC);
CREATE INDEX idx_price_alerts_competitor_created ON price_alerts (competitor_url_id, created_at DESC);
CREATE INDEX idx_price_alerts_notification_sent ON price_alerts (notification_sent, created_at DESC);

-- Add enhanced fields to existing tables for better price tracking
ALTER TABLE competitor_urls 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_successful_check TIMESTAMP,
ADD COLUMN IF NOT EXISTS platform VARCHAR(50),
ADD COLUMN IF NOT EXISTS domain TEXT;

-- Add enhanced fields to price_snapshots for better analytics
ALTER TABLE price_snapshots 
ADD COLUMN IF NOT EXISTS price_change_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS significant_change BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS scraper_version VARCHAR(20);

-- Update existing competitor_urls with domain and platform information
UPDATE competitor_urls 
SET domain = CASE 
    WHEN url ~ '^https?://([^/]+)' THEN 
        regexp_replace(regexp_replace(url, '^https?://', ''), '/.*', '')
    ELSE 'unknown'
END,
platform = CASE 
    WHEN url ILIKE '%amazon.%' THEN 'amazon'
    WHEN url ILIKE '%shopify%' OR url ILIKE '%myshopify.com%' THEN 'shopify'
    WHEN url ILIKE '%woocommerce%' THEN 'woocommerce'
    WHEN url ILIKE '%bigcommerce%' THEN 'bigcommerce'
    ELSE 'other'
END
WHERE domain IS NULL OR platform IS NULL;