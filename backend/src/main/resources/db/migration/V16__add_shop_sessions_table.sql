-- Create shop_sessions table to track multiple active sessions per shop
CREATE TABLE IF NOT EXISTS shop_sessions (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    access_token VARCHAR(500) NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT fk_shop_sessions_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shop_sessions_shop_id ON shop_sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_sessions_session_id ON shop_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_shop_sessions_active ON shop_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_shop_sessions_last_accessed ON shop_sessions(last_accessed_at);

-- Create trigger for updated_at
CREATE TRIGGER update_shop_sessions_updated_at
    BEFORE UPDATE ON shop_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE shop_sessions IS 'Tracks multiple active sessions per shop to support concurrent logins';
COMMENT ON COLUMN shop_sessions.session_id IS 'Unique identifier for the browser/device session';
COMMENT ON COLUMN shop_sessions.access_token IS 'Shopify access token for this specific session';
COMMENT ON COLUMN shop_sessions.expires_at IS 'When this session expires (optional)';
COMMENT ON COLUMN shop_sessions.is_active IS 'Whether this session is currently active'; 