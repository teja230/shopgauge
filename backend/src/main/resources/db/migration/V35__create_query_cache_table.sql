-- Create query_cache table for QueryResultCacheService
CREATE TABLE IF NOT EXISTS query_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    hit_count BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_query_cache_expires_at ON query_cache(expires_at);

-- Create index for hit count statistics
CREATE INDEX IF NOT EXISTS idx_query_cache_hit_count ON query_cache(hit_count);

-- Create index for last accessed time
CREATE INDEX IF NOT EXISTS idx_query_cache_last_accessed ON query_cache(last_accessed_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_query_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_query_cache_updated_at
    BEFORE UPDATE ON query_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_query_cache_updated_at();
