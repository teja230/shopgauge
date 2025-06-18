CREATE TABLE IF NOT EXISTS daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id),
    date DATE NOT NULL,
    conversion_rate DECIMAL(5,2),
    abandoned_cart_count INTEGER,
    top_selling_products JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_shop_date ON daily_metrics(shop_id, date); 