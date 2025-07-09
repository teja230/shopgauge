-- Create admin audit logs table for tracking admin authentication events
CREATE TABLE admin_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event VARCHAR(100) NOT NULL,
    username VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_admin_audit_logs_username ON admin_audit_logs(username);
CREATE INDEX idx_admin_audit_logs_event ON admin_audit_logs(event);
CREATE INDEX idx_admin_audit_logs_ip_address ON admin_audit_logs(ip_address);
CREATE INDEX idx_admin_audit_logs_timestamp ON admin_audit_logs(timestamp);
CREATE INDEX idx_admin_audit_logs_username_timestamp ON admin_audit_logs(username, timestamp DESC);

-- Add comments for documentation
COMMENT ON TABLE admin_audit_logs IS 'Audit log for admin authentication and authorization events';
COMMENT ON COLUMN admin_audit_logs.event IS 'Type of audit event (LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, etc.)';
COMMENT ON COLUMN admin_audit_logs.username IS 'Admin username associated with the event';
COMMENT ON COLUMN admin_audit_logs.details IS 'Additional details about the event';
COMMENT ON COLUMN admin_audit_logs.ip_address IS 'IP address of the client';
COMMENT ON COLUMN admin_audit_logs.timestamp IS 'When the event occurred';
COMMENT ON COLUMN admin_audit_logs.created_at IS 'When the record was created'; 