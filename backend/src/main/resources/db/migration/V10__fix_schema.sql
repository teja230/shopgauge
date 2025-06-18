-- Drop existing tables if they exist
DROP TABLE IF EXISTS daily_metrics CASCADE;
DROP TABLE IF EXISTS shops CASCADE;

-- Recreate shops table with proper constraints
CREATE TABLE IF NOT EXISTS shops (
    id BIGSERIAL PRIMARY KEY,
    shopify_domain VARCHAR(255) NOT NULL UNIQUE,
    access_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create daily metrics table
CREATE TABLE IF NOT EXISTS daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id),
    date DATE NOT NULL,
    conversion_rate DOUBLE PRECISION,
    abandoned_cart_count INTEGER,
    top_selling_products JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_shop_date UNIQUE (shop_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_metrics_shop_date ON daily_metrics (shop_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics (date);

-- Create trigger for updated_at
CREATE TRIGGER update_daily_metrics_updated_at
    BEFORE UPDATE ON daily_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 