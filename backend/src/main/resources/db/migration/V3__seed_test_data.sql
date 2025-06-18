-- Seed test shop
INSERT INTO shops (id, shopify_domain, access_token, created_at) VALUES (1, 'test-shop.myshopify.com', 'dummy_token', NOW());

-- Seed test product
INSERT INTO products (id, shop_id, shopify_product_id, title, price, created_at) VALUES (1, 1, 'prod_1', 'Test Product', 19.99, NOW());

-- Seed test order
INSERT INTO orders (id, shop_id, shopify_order_id, total_price, created_at) VALUES (1, 1, 'order_1', 19.99, NOW());

-- Seed competitor URL
INSERT INTO competitor_urls (id, product_id, url, label, created_at) VALUES (1, 1, 'https://competitor.com/product/1', 'Competitor 1', NOW());

-- Seed price snapshot
INSERT INTO price_snapshots (id, competitor_url_id, price, in_stock, checked_at) VALUES (1, 1, 18.99, true, NOW());

-- Seed alert
INSERT INTO alerts (id, shop_id, product_id, competitor_url_id, type, message, created_at) VALUES (1, 1, 1, 1, 'price', 'Competitor price dropped below threshold', NOW());

-- Seed daily metrics
INSERT INTO daily_metrics (id, shop_id, date, conversion_rate, top_selling_products, abandoned_cart_count, created_at) VALUES (
  1, 1, CURRENT_DATE, 1.2, '[{"title": "Test Product", "sales": 10, "delta": 5.0}]', 2, NOW()
); 