-- Update competitor_urls table to work with Redis-cached products instead of database products
-- This migration adds shopify_product_id column and necessary indexes

-- Add shopify_product_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'competitor_urls' AND column_name = 'shopify_product_id') THEN
        ALTER TABLE competitor_urls ADD COLUMN shopify_product_id VARCHAR(64);
    END IF;
END $$;

-- Populate shopify_product_id from existing data (if any exists)
UPDATE competitor_urls 
SET shopify_product_id = p.shopify_product_id
FROM products p 
WHERE competitor_urls.product_id = p.id AND competitor_urls.shopify_product_id IS NULL;

-- Add foreign key constraint to shops table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_competitor_urls_shop_id') THEN
        ALTER TABLE competitor_urls ADD CONSTRAINT fk_competitor_urls_shop_id 
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitor_urls_shop_shopify_product 
    ON competitor_urls (shop_id, shopify_product_id);

CREATE INDEX IF NOT EXISTS idx_competitor_urls_shop_url 
    ON competitor_urls (shop_id, url);

-- Note: We keep the old product_id column for backward compatibility during transition
-- It can be removed in a future migration once all data is migrated