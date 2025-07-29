-- Remove product_id column from competitor_urls table
-- This migration removes the legacy product_id column since we now use shopify_product_id

-- First, ensure all data has been migrated to shopify_product_id
-- This should have been done in V37, but let's double-check
UPDATE competitor_urls 
SET shopify_product_id = p.shopify_product_id
FROM products p 
WHERE competitor_urls.product_id = p.id 
AND competitor_urls.shopify_product_id IS NULL;

-- Drop any indexes that reference product_id
DROP INDEX IF EXISTS idx_competitor_urls_shop_product_status;
DROP INDEX IF EXISTS idx_competitor_urls_product_id;

-- Drop the foreign key constraint for product_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'competitor_urls_product_id_fkey') THEN
        ALTER TABLE competitor_urls DROP CONSTRAINT competitor_urls_product_id_fkey;
    END IF;
END $$;

-- Drop the product_id column
ALTER TABLE competitor_urls DROP COLUMN IF EXISTS product_id;

-- Add comment to document the change
COMMENT ON TABLE competitor_urls IS 'Competitor URLs now use shopify_product_id instead of product_id for Redis-cached products'; 