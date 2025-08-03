-- Add security and compliance features to Market Intelligence
-- Migration V31: Security and Compliance Features

-- Add encryption status and security fields to competitor_suggestions
ALTER TABLE competitor_suggestions 
ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS data_classification VARCHAR(20) DEFAULT 'INTERNAL',
ADD COLUMN IF NOT EXISTS retention_date DATE,
ADD COLUMN IF NOT EXISTS anonymized BOOLEAN DEFAULT FALSE;

-- Add security fields to audit_logs
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS data_classification VARCHAR(20) DEFAULT 'INTERNAL',
ADD COLUMN IF NOT EXISTS retention_date DATE;

-- Create data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id BIGSERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,
    retention_days INTEGER NOT NULL,
    auto_cleanup BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_type)
);

-- Insert default retention policies
INSERT INTO data_retention_policies (data_type, retention_days, auto_cleanup) VALUES
('audit_logs', 365, TRUE),
('competitor_data', 730, FALSE),
('cost_data', 1095, FALSE),
('suggestion_data', 365, TRUE)
ON CONFLICT (data_type) DO NOTHING;

-- Create privacy requests table for GDPR compliance
CREATE TABLE IF NOT EXISTS privacy_requests (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id),
    request_type VARCHAR(20) NOT NULL, -- 'EXPORT', 'DELETE', 'ANONYMIZE'
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    request_details JSONB,
    processing_log TEXT,
    created_by VARCHAR(100),
    ip_address INET
);

-- Create data access log table for compliance tracking
CREATE TABLE IF NOT EXISTS data_access_logs (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id),
    user_identifier VARCHAR(100),
    access_type VARCHAR(50) NOT NULL, -- 'READ', 'WRITE', 'DELETE', 'EXPORT'
    data_type VARCHAR(50) NOT NULL, -- 'COMPETITOR_DATA', 'AUDIT_LOGS', 'COST_DATA'
    resource_id VARCHAR(100),
    access_reason VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Create security incidents table
CREATE TABLE IF NOT EXISTS security_incidents (
    id BIGSERIAL PRIMARY KEY,
    incident_type VARCHAR(50) NOT NULL, -- 'RATE_LIMIT_EXCEEDED', 'INVALID_INPUT', 'UNAUTHORIZED_ACCESS'
    severity VARCHAR(20) DEFAULT 'LOW', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    shop_id BIGINT REFERENCES shops(id),
    ip_address INET,
    user_agent TEXT,
    request_path VARCHAR(500),
    incident_details JSONB,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'OPEN' -- 'OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_encrypted ON competitor_suggestions(encrypted);
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_retention_date ON competitor_suggestions(retention_date);
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_anonymized ON competitor_suggestions(anonymized);

CREATE INDEX IF NOT EXISTS idx_audit_logs_retention_date ON audit_logs(retention_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_data_classification ON audit_logs(data_classification);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_shop_status ON privacy_requests(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_type_status ON privacy_requests(request_type, status);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_requested_at ON privacy_requests(requested_at);

CREATE INDEX IF NOT EXISTS idx_data_access_logs_shop_accessed_at ON data_access_logs(shop_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_access_type ON data_access_logs(access_type);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_data_type ON data_access_logs(data_type);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_ip_address ON data_access_logs(ip_address);

CREATE INDEX IF NOT EXISTS idx_security_incidents_severity_status ON security_incidents(severity, status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_detected_at ON security_incidents(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_incidents_shop_id ON security_incidents(shop_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_ip_address ON security_incidents(ip_address);

-- Add comments for documentation
COMMENT ON TABLE data_retention_policies IS 'Defines data retention policies for different data types';
COMMENT ON TABLE privacy_requests IS 'Tracks GDPR and privacy-related requests (export, delete, anonymize)';
COMMENT ON TABLE data_access_logs IS 'Logs all access to sensitive data for compliance auditing';
COMMENT ON TABLE security_incidents IS 'Tracks security incidents and potential threats';

COMMENT ON COLUMN competitor_suggestions.encrypted IS 'Indicates if the suggestion data is encrypted';
COMMENT ON COLUMN competitor_suggestions.data_classification IS 'Data classification level (PUBLIC, INTERNAL, CONFIDENTIAL)';
COMMENT ON COLUMN competitor_suggestions.retention_date IS 'Date when this data should be reviewed for retention';
COMMENT ON COLUMN competitor_suggestions.anonymized IS 'Indicates if the data has been anonymized';

-- Update existing data with retention dates based on creation dates
UPDATE competitor_suggestions 
SET retention_date = (created_at::date + INTERVAL '365 days')::date
WHERE retention_date IS NULL AND created_at IS NOT NULL;

UPDATE audit_logs 
SET retention_date = (created_at::date + INTERVAL '365 days')::date
WHERE retention_date IS NULL AND created_at IS NOT NULL;

-- Create function to automatically set retention dates
CREATE OR REPLACE FUNCTION set_retention_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Set retention date based on data type policies
    IF TG_TABLE_NAME = 'competitor_suggestions' THEN
        NEW.retention_date := (NEW.created_at::date + INTERVAL '365 days')::date;
    ELSIF TG_TABLE_NAME = 'audit_logs' THEN
        NEW.retention_date := (NEW.created_at::date + INTERVAL '365 days')::date;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically set retention dates
DROP TRIGGER IF EXISTS set_competitor_suggestions_retention_date ON competitor_suggestions;
CREATE TRIGGER set_competitor_suggestions_retention_date
    BEFORE INSERT ON competitor_suggestions
    FOR EACH ROW
    EXECUTE FUNCTION set_retention_date();

DROP TRIGGER IF EXISTS set_audit_logs_retention_date ON audit_logs;
CREATE TRIGGER set_audit_logs_retention_date
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_retention_date();