-- Competitor suggestions table for automatic competitor discovery
CREATE TABLE IF NOT EXISTS competitor_suggestions (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    suggested_url TEXT NOT NULL,
    title VARCHAR(255),
    price NUMERIC(12,2),
    source VARCHAR(50) NOT NULL DEFAULT 'GOOGLE_SHOPPING',
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'APPROVED', 'IGNORED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, product_id, suggested_url)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_shop_status ON competitor_suggestions (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_product_status ON competitor_suggestions (product_id, status);
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_discovered_at ON competitor_suggestions (discovered_at);
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_source ON competitor_suggestions (source);

-- Create trigger for updated_at
CREATE TRIGGER update_competitor_suggestions_updated_at
    BEFORE UPDATE ON competitor_suggestions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 