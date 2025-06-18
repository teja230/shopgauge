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