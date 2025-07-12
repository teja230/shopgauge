-- Create market intelligence costs table for historical cost tracking per shop
CREATE TABLE market_intelligence_costs (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL,
    date DATE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    daily_cost DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
    daily_requests INT NOT NULL DEFAULT 0,
    daily_discoveries INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to shops table
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX idx_shop_date ON market_intelligence_costs (shop_id, date);
CREATE INDEX idx_date_provider ON market_intelligence_costs (date, provider);
CREATE INDEX idx_shop_provider ON market_intelligence_costs (shop_id, provider);

-- Create unique constraint to prevent duplicate entries for same shop/date/provider
CREATE UNIQUE INDEX uk_shop_date_provider ON market_intelligence_costs (shop_id, date, provider);

-- Add comment to table
COMMENT ON TABLE market_intelligence_costs IS 'Historical cost tracking for Market Intelligence features per shop'; 