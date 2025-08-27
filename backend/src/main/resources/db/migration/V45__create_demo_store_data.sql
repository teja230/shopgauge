-- V45: Create Demo Store Data for ShopGauge Demo Mode
-- This migration creates a comprehensive demo store with realistic data

-- Create the demo store
INSERT INTO shops (shopify_domain, access_token, is_active, created_at, updated_at) 
VALUES (
    'demo-shopgauge.myshopify.com', 
    'demo_access_token_shopgauge_2024',
    true,
    CURRENT_TIMESTAMP - INTERVAL '45 days',
    CURRENT_TIMESTAMP
) ON CONFLICT (shopify_domain) DO UPDATE SET
    access_token = EXCLUDED.access_token,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP;

-- Create demo shop session
INSERT INTO shop_sessions (shop_id, session_id, access_token, user_agent, ip_address, created_at, updated_at, last_accessed_at, is_active)
SELECT 
    s.id,
    'demo-session-shopgauge-2024',
    'demo_access_token_shopgauge_2024',
    'Demo Mode User Agent',
    '127.0.0.1',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    true
FROM shops s 
WHERE s.shopify_domain = 'demo-shopgauge.myshopify.com'
ON CONFLICT (session_id) DO UPDATE SET
    last_accessed_at = CURRENT_TIMESTAMP,
    is_active = true;

-- Note: Demo products are now managed via Redis cache by DemoDataService
-- This migration no longer needs to insert into a products table since the backend
-- uses Redis for product caching (see V37/V38 migrations and DemoDataService)

-- Create demo competitor URLs with realistic competitors
WITH demo_shop AS (
    SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'
),
demo_product_ids AS (
    SELECT unnest(ARRAY['demo_prod_1', 'demo_prod_2', 'demo_prod_3', 'demo_prod_4', 'demo_prod_5', 'demo_prod_6', 'demo_prod_7', 'demo_prod_8']) AS shopify_product_id
)
INSERT INTO competitor_urls (shop_id, shopify_product_id, url, label, domain, platform, status, created_at)
SELECT 
    ds.id,
    dp.shopify_product_id,
    CASE 
        WHEN dp.shopify_product_id = 'demo_prod_1' THEN 'https://amazon.com/premium-wireless-headphones-demo'
        WHEN dp.shopify_product_id = 'demo_prod_2' THEN 'https://amazon.com/smart-fitness-tracker-demo'
        WHEN dp.shopify_product_id = 'demo_prod_3' THEN 'https://wayfair.com/ergonomic-office-chair-demo'
        WHEN dp.shopify_product_id = 'demo_prod_4' THEN 'https://amazon.com/portable-power-bank-demo'
        WHEN dp.shopify_product_id = 'demo_prod_5' THEN 'https://williams-sonoma.com/coffee-maker-demo'
        WHEN dp.shopify_product_id = 'demo_prod_6' THEN 'https://amazon.com/led-desk-lamp-demo'
        WHEN dp.shopify_product_id = 'demo_prod_7' THEN 'https://bestbuy.com/bluetooth-speaker-demo'
        WHEN dp.shopify_product_id = 'demo_prod_8' THEN 'https://amazon.com/laptop-stand-demo'
    END,
    CASE 
        WHEN dp.shopify_product_id = 'demo_prod_1' THEN 'Amazon - Premium Headphones'
        WHEN dp.shopify_product_id = 'demo_prod_2' THEN 'Amazon - Fitness Tracker'
        WHEN dp.shopify_product_id = 'demo_prod_3' THEN 'Wayfair - Office Chair'
        WHEN dp.shopify_product_id = 'demo_prod_4' THEN 'Amazon - Power Bank'
        WHEN dp.shopify_product_id = 'demo_prod_5' THEN 'Williams Sonoma - Coffee Maker'
        WHEN dp.shopify_product_id = 'demo_prod_6' THEN 'Amazon - Desk Lamp'
        WHEN dp.shopify_product_id = 'demo_prod_7' THEN 'Best Buy - Speaker'
        WHEN dp.shopify_product_id = 'demo_prod_8' THEN 'Amazon - Laptop Stand'
    END,
    CASE 
        WHEN dp.shopify_product_id IN ('demo_prod_1', 'demo_prod_2', 'demo_prod_4', 'demo_prod_6', 'demo_prod_8') THEN 'amazon.com'
        WHEN dp.shopify_product_id = 'demo_prod_3' THEN 'wayfair.com'
        WHEN dp.shopify_product_id = 'demo_prod_5' THEN 'williams-sonoma.com'
        WHEN dp.shopify_product_id = 'demo_prod_7' THEN 'bestbuy.com'
    END,
    CASE 
        WHEN dp.shopify_product_id IN ('demo_prod_1', 'demo_prod_2', 'demo_prod_4', 'demo_prod_6', 'demo_prod_8') THEN 'amazon'
        WHEN dp.shopify_product_id = 'demo_prod_3' THEN 'wayfair'
        WHEN dp.shopify_product_id = 'demo_prod_5' THEN 'other'
        WHEN dp.shopify_product_id = 'demo_prod_7' THEN 'other'
    END,
    'active',
    CURRENT_TIMESTAMP - INTERVAL '25 days'
FROM demo_shop ds
CROSS JOIN demo_product_ids dp
ON CONFLICT (shop_id, shopify_product_id, url) DO UPDATE SET
    label = EXCLUDED.label,
    domain = EXCLUDED.domain,
    platform = EXCLUDED.platform,
    status = EXCLUDED.status,
    updated_at = CURRENT_TIMESTAMP;

-- Create additional competitor URLs for better demo data
WITH demo_shop AS (
    SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'
)
INSERT INTO competitor_urls (shop_id, shopify_product_id, url, label, domain, platform, status, created_at)
SELECT 
    ds.id,
    'demo_prod_1',
    'https://bestbuy.com/premium-headphones-alternative-demo',
    'Best Buy - Premium Audio',
    'bestbuy.com',
    'other',
    'active',
    CURRENT_TIMESTAMP - INTERVAL '20 days'
FROM demo_shop ds
UNION ALL
SELECT 
    ds.id,
    'demo_prod_2',
    'https://target.com/fitness-tracker-alternative-demo',
    'Target - Fitness Watch',
    'target.com',
    'other',
    'active',
    CURRENT_TIMESTAMP - INTERVAL '18 days'
FROM demo_shop ds
ON CONFLICT (shop_id, shopify_product_id, url) DO UPDATE SET
    label = EXCLUDED.label,
    domain = EXCLUDED.domain,
    platform = EXCLUDED.platform,
    status = EXCLUDED.status,
    updated_at = CURRENT_TIMESTAMP;

-- Create realistic price snapshots with trending data
WITH demo_competitors AS (
    SELECT cu.id, cu.shopify_product_id
    FROM competitor_urls cu
    JOIN shops s ON cu.shop_id = s.id
    WHERE s.shopify_domain = 'demo-shopgauge.myshopify.com'
),
base_prices AS (
    SELECT 
        dc.id,
        dc.shopify_product_id,
        CASE dc.shopify_product_id
            WHEN 'demo_prod_1' THEN 139.99 -- Slightly lower than our price
            WHEN 'demo_prod_2' THEN 94.99  -- Slightly higher
            WHEN 'demo_prod_3' THEN 279.99 -- Lower
            WHEN 'demo_prod_4' THEN 44.99  -- Higher
            WHEN 'demo_prod_5' THEN 199.99 -- Higher
            WHEN 'demo_prod_6' THEN 45.99  -- Slightly lower
            WHEN 'demo_prod_7' THEN 74.99  -- Lower
            WHEN 'demo_prod_8' THEN 79.99  -- Higher
        END as base_price
    FROM demo_competitors dc
)
INSERT INTO price_snapshots (competitor_url_id, price, in_stock, checked_at, significant_change, price_change_percent, response_time_ms)
SELECT 
    bp.id,
    -- Create price variations over time
    bp.base_price + (random() - 0.5) * 20, -- Random price variations
    CASE WHEN random() > 0.1 THEN true ELSE false END, -- 90% in stock
    CURRENT_TIMESTAMP - (generate_series || ' hours')::INTERVAL,
    CASE WHEN random() > 0.8 THEN true ELSE false END, -- 20% significant changes
    (random() - 0.5) * 30, -- Price change percentage between -15% and +15%
    (random() * 2000 + 500)::INTEGER -- Response time between 500-2500ms
FROM base_prices bp, generate_series(1, 72); -- 72 hours of data (3 days)

-- Note: Demo orders are now managed via Redis cache and API responses by DemoDataService
-- This migration no longer needs to insert into an orders table since the backend
-- uses Redis for order caching (see analytics endpoints and DemoDataService)

-- Create demo price alerts
WITH demo_competitors AS (
    SELECT cu.id, cu.shopify_product_id, cu.url
    FROM competitor_urls cu
    JOIN shops s ON cu.shop_id = s.id
    WHERE s.shopify_domain = 'demo-shopgauge.myshopify.com'
    LIMIT 5 -- Create alerts for first 5 competitors
)
INSERT INTO price_alerts (shop_id, competitor_url_id, old_price, new_price, change_percent, alert_type, created_at, notification_sent)
SELECT 
    (SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'),
    dc.id,
    150.00 + (random() * 50),
    135.00 + (random() * 40),
    -10.0 + (random() * 20), -- Between -10% and +10%
    CASE 
        WHEN random() > 0.5 THEN 'price_drop'
        ELSE 'price_increase'
    END,
    CURRENT_TIMESTAMP - (random() * INTERVAL '7 days'),
    CASE WHEN random() > 0.3 THEN true ELSE false END -- 70% notifications sent
FROM demo_competitors dc;

-- Create demo daily metrics for analytics dashboard
WITH demo_shop AS (
    SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'
)
INSERT INTO daily_metrics (shop_id, date, conversion_rate, abandoned_cart_count, top_selling_products, created_at)
SELECT 
    ds.id,
    CURRENT_DATE - generate_series,
    2.5 + (random() * 3), -- Conversion rate between 2.5% and 5.5%
    (random() * 15)::INTEGER, -- 0-15 abandoned carts
    jsonb_build_object(
        'products', jsonb_build_array(
            jsonb_build_object('id', 'demo_prod_1', 'sales', (random() * 20)::INTEGER),
            jsonb_build_object('id', 'demo_prod_2', 'sales', (random() * 15)::INTEGER),
            jsonb_build_object('id', 'demo_prod_3', 'sales', (random() * 10)::INTEGER)
        )
    ),
    CURRENT_TIMESTAMP - (generate_series || ' days')::INTERVAL
FROM demo_shop ds, generate_series(0, 89) -- 90 days of metrics
ON CONFLICT (shop_id, date) DO UPDATE SET
    conversion_rate = EXCLUDED.conversion_rate,
    abandoned_cart_count = EXCLUDED.abandoned_cart_count,
    top_selling_products = EXCLUDED.top_selling_products,
    updated_at = CURRENT_TIMESTAMP;

-- Create demo competitor suggestions
WITH demo_shop AS (
    SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'
),
demo_product_data AS (
    SELECT unnest(ARRAY[1, 2, 3, 4, 5, 6, 7, 8]) AS product_id,
           unnest(ARRAY['demo_prod_1', 'demo_prod_2', 'demo_prod_3', 'demo_prod_4', 'demo_prod_5', 'demo_prod_6', 'demo_prod_7', 'demo_prod_8']) AS shopify_product_id
)
INSERT INTO competitor_suggestions (shop_id, product_id, suggested_url, title, platform, relevance_score, status, discovered_at, source)
SELECT 
    ds.id,
    dp.product_id,
    'https://example-competitor-' || generate_series || '.com/product',
    'Suggested Competitor ' || generate_series,
    CASE generate_series % 4
        WHEN 0 THEN 'amazon'
        WHEN 1 THEN 'shopify'
        WHEN 2 THEN 'woocommerce'
        ELSE 'other'
    END,
    0.5 + (random() * 0.5), -- Relevance score between 0.5 and 1.0
    CASE 
        WHEN generate_series <= 3 THEN 'NEW'
        WHEN generate_series <= 6 THEN 'APPROVED'
        ELSE 'IGNORED'
    END,
    CURRENT_TIMESTAMP - (generate_series || ' days')::INTERVAL,
    'ai_discovery'
FROM demo_shop ds
CROSS JOIN demo_product_data dp 
CROSS JOIN generate_series(1, 10)
ON CONFLICT (shop_id, product_id, suggested_url) DO UPDATE SET
    title = EXCLUDED.title,
    platform = EXCLUDED.platform,
    relevance_score = EXCLUDED.relevance_score,
    status = EXCLUDED.status,
    discovered_at = EXCLUDED.discovered_at,
    source = EXCLUDED.source;

-- Create demo audit logs
WITH demo_shop AS (
    SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com'
)
INSERT INTO audit_logs (shop_id, action, details, user_agent, ip_address, created_at)
SELECT 
    ds.id,
    CASE generate_series % 4
        WHEN 0 THEN 'CREATE'
        WHEN 1 THEN 'UPDATE'
        WHEN 2 THEN 'DELETE'
        ELSE 'VIEW'
    END,
    'Demo action performed on entity demo_entity_' || generate_series,
    'Demo Mode User Agent',
    '127.0.0.1',
    CURRENT_TIMESTAMP - (generate_series || ' hours')::INTERVAL
FROM demo_shop ds, generate_series(1, 20);

-- Add indexes for demo data performance
CREATE INDEX IF NOT EXISTS idx_demo_shops_domain ON shops(shopify_domain) WHERE shopify_domain = 'demo-shopgauge.myshopify.com';

-- Add comments for documentation
COMMENT ON TABLE shops IS 'Includes demo store: demo-shopgauge.myshopify.com for demo mode';
COMMENT ON COLUMN shops.shopify_domain IS 'Special domain demo-shopgauge.myshopify.com is used for demo mode';

-- Verify demo data creation
DO $$
DECLARE
    demo_shop_count INTEGER;
    demo_competitors_count INTEGER;
    demo_metrics_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO demo_shop_count FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com';
    SELECT COUNT(*) INTO demo_competitors_count FROM competitor_urls WHERE shop_id = (SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com');
    SELECT COUNT(*) INTO demo_metrics_count FROM daily_metrics WHERE shop_id = (SELECT id FROM shops WHERE shopify_domain = 'demo-shopgauge.myshopify.com');
    
    RAISE NOTICE 'Demo data verification: Shop: %, Competitors: %, Metrics: %', demo_shop_count, demo_competitors_count, demo_metrics_count;
    RAISE NOTICE 'Note: Demo products are managed via Redis cache by DemoDataService';
END $$;
