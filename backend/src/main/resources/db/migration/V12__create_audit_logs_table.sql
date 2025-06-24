-- Flyway Migration: Create audit logs table

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    user_agent VARCHAR(500),
    ip_address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying by shop and date
CREATE INDEX idx_audit_logs_shop_date ON audit_logs(shop_id, created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Partition by month for better performance on large datasets
-- (Optional: Uncomment for high-volume audit logging)
-- CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01'); 