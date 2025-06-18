-- This migration will only run in the test profile
DO $$
BEGIN
    -- Only run if we're in the test profile
    IF current_setting('spring.profiles.active', true) = 'test' THEN
        -- Seed test shop
        INSERT INTO shops (shopify_domain, access_token) 
        VALUES ('test-shop.myshopify.com', 'dummy_token')
        ON CONFLICT (shopify_domain) DO NOTHING;

        -- Seed test product
        INSERT INTO products (shop_id, shopify_product_id, title, price) 
        SELECT id, 'prod_1', 'Test Product', 19.99 
        FROM shops 
        WHERE shopify_domain = 'test-shop.myshopify.com'
        ON CONFLICT (shopify_product_id) DO NOTHING;

        -- Seed test order
        INSERT INTO orders (shop_id, shopify_order_id, total_price) 
        SELECT id, 'order_1', 19.99 
        FROM shops 
        WHERE shopify_domain = 'test-shop.myshopify.com'
        ON CONFLICT (shopify_order_id) DO NOTHING;

        -- Seed competitor URL
        INSERT INTO competitor_urls (product_id, url, label) 
        SELECT p.id, 'https://competitor.com/product/1', 'Competitor 1' 
        FROM products p 
        JOIN shops s ON p.shop_id = s.id 
        WHERE s.shopify_domain = 'test-shop.myshopify.com'
        ON CONFLICT (url) DO NOTHING;

        -- Seed price snapshot
        INSERT INTO price_snapshots (competitor_url_id, price, in_stock) 
        SELECT cu.id, 18.99, true 
        FROM competitor_urls cu 
        JOIN products p ON cu.product_id = p.id 
        JOIN shops s ON p.shop_id = s.id 
        WHERE s.shopify_domain = 'test-shop.myshopify.com'
        ON CONFLICT (competitor_url_id, checked_at) DO NOTHING;

        -- Seed alert
        INSERT INTO alerts (shop_id, product_id, competitor_url_id, type, message) 
        SELECT s.id, p.id, cu.id, 'price', 'Competitor price dropped below threshold' 
        FROM shops s 
        JOIN products p ON p.shop_id = s.id 
        JOIN competitor_urls cu ON cu.product_id = p.id 
        WHERE s.shopify_domain = 'test-shop.myshopify.com'
        ON CONFLICT (shop_id, product_id, competitor_url_id, type) DO NOTHING;

        -- Seed daily metrics
        INSERT INTO daily_metrics (shop_id, date, conversion_rate, abandoned_cart_count, top_selling_products)
        SELECT 
            s.id,
            CURRENT_DATE,
            1.2,
            5,
            '[{"title": "Test Product 1", "quantity": 10}, {"title": "Test Product 2", "quantity": 8}]'::jsonb
        FROM shops s
        WHERE NOT EXISTS (
            SELECT 1 FROM daily_metrics dm 
            WHERE dm.shop_id = s.id 
            AND dm.date = CURRENT_DATE
        );
    END IF;
END $$; 