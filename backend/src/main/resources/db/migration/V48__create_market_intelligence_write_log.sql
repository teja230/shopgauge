CREATE TABLE market_intelligence_write_log (
    id BIGSERIAL PRIMARY KEY,
    operation_id UUID NOT NULL UNIQUE,
    shop_domain VARCHAR(255) NOT NULL,
    data_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_market_intelligence_write_log_shop_created
    ON market_intelligence_write_log (shop_domain, created_at DESC);

CREATE INDEX idx_market_intelligence_write_log_type_created
    ON market_intelligence_write_log (data_type, created_at DESC);
