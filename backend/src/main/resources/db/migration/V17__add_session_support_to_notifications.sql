-- Add session support to notifications table
-- This allows notifications to be session-specific for better privacy and user experience

-- Add session_id column to link notifications to specific sessions
ALTER TABLE notifications ADD COLUMN session_id VARCHAR(255);

-- Add category column for better organization
ALTER TABLE notifications ADD COLUMN category VARCHAR(100);

-- Create index for better query performance on session-based lookups
CREATE INDEX idx_notifications_session_id ON notifications(session_id);
CREATE INDEX idx_notifications_shop_session ON notifications(shop, session_id);
CREATE INDEX idx_notifications_category ON notifications(category);

-- Add comments for documentation
COMMENT ON COLUMN notifications.session_id IS 'Links notification to specific user session - null means shop-wide notification';
COMMENT ON COLUMN notifications.category IS 'Categorizes notifications for better organization (Authentication, Connection, etc.)';

-- Update existing notifications to be shop-wide (session_id = null) for backward compatibility
-- This ensures existing notifications remain visible to all sessions of the same shop
UPDATE notifications SET session_id = NULL WHERE session_id IS NULL; 