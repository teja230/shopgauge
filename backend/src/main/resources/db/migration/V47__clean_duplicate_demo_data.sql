-- CLEAN DUPLICATE DEMO DATA: Remove duplicate competitor URLs and related data
-- This migration fixes duplicates created by multiple runs of V45 before ON CONFLICT was added

-- First, delete dependent records (price_snapshots and price_alerts) for duplicate competitor URLs
WITH demo_shop AS (
    SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'
),
duplicate_competitors AS (
    SELECT 
        cu.id,
        ROW_NUMBER() OVER (
            PARTITION BY cu.shop_id, cu.shopify_product_id, cu.url 
            ORDER BY cu.created_at ASC
        ) as row_num
    FROM competitor_urls cu
    JOIN demo_shop ds ON cu.shop_id = ds.id
)
DELETE FROM price_snapshots 
WHERE competitor_url_id IN (
    SELECT id FROM duplicate_competitors WHERE row_num > 1
);

-- Delete price_alerts for duplicate competitor URLs
WITH demo_shop AS (
    SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'
),
duplicate_competitors AS (
    SELECT 
        cu.id,
        ROW_NUMBER() OVER (
            PARTITION BY cu.shop_id, cu.shopify_product_id, cu.url 
            ORDER BY cu.created_at ASC
        ) as row_num
    FROM competitor_urls cu
    JOIN demo_shop ds ON cu.shop_id = ds.id
)
DELETE FROM price_alerts 
WHERE competitor_url_id IN (
    SELECT id FROM duplicate_competitors WHERE row_num > 1
);

-- Now delete the duplicate competitor URLs (foreign key constraints are satisfied)
WITH demo_shop AS (
    SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'
),
duplicate_competitors AS (
    SELECT 
        cu.id,
        ROW_NUMBER() OVER (
            PARTITION BY cu.shop_id, cu.shopify_product_id, cu.url 
            ORDER BY cu.created_at ASC
        ) as row_num
    FROM competitor_urls cu
    JOIN demo_shop ds ON cu.shop_id = ds.id
)
DELETE FROM competitor_urls 
WHERE id IN (
    SELECT id FROM duplicate_competitors WHERE row_num > 1
);

-- Clean up duplicate competitor suggestions
-- Keep only the first occurrence of each unique combination
WITH demo_shop AS (
    SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'
),
duplicate_suggestions AS (
    SELECT 
        cs.id,
        ROW_NUMBER() OVER (
            PARTITION BY cs.shop_id, cs.product_id, cs.suggested_url 
            ORDER BY cs.discovered_at ASC
        ) as row_num
    FROM competitor_suggestions cs
    JOIN demo_shop ds ON cs.shop_id = ds.id
)
DELETE FROM competitor_suggestions 
WHERE id IN (
    SELECT id FROM duplicate_suggestions WHERE row_num > 1
);

-- Verify cleanup results
DO $$
DECLARE
    demo_shop_id INTEGER;
    competitors_count INTEGER;
    price_snapshots_count INTEGER;
    suggestions_count INTEGER;
BEGIN
    SELECT id INTO demo_shop_id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com';
    
    SELECT COUNT(*) INTO competitors_count 
    FROM competitor_urls 
    WHERE shop_id = demo_shop_id;
    
    SELECT COUNT(*) INTO price_snapshots_count 
    FROM price_snapshots ps
    JOIN competitor_urls cu ON ps.competitor_url_id = cu.id
    WHERE cu.shop_id = demo_shop_id;
    
    SELECT COUNT(*) INTO suggestions_count 
    FROM competitor_suggestions 
    WHERE shop_id = demo_shop_id;
    
    RAISE NOTICE 'Demo data cleanup completed:';
    RAISE NOTICE 'Unique competitors: %', competitors_count;
    RAISE NOTICE 'Price snapshots: %', price_snapshots_count;
    RAISE NOTICE 'Competitor suggestions: %', suggestions_count;
END $$;

-- Add comments for documentation
COMMENT ON TABLE competitor_urls IS 'Cleaned duplicate demo data - each competitor URL should be unique per shop/product combination';
