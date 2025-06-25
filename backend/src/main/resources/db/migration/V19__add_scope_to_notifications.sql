-- Add scope field to notifications table
ALTER TABLE notifications 
ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'personal';

-- Create index for scope-based queries
CREATE INDEX idx_notifications_scope ON notifications(scope); 