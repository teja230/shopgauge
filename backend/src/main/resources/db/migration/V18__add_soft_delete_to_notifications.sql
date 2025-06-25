-- Add soft delete fields to notifications table
ALTER TABLE notifications 
ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN deleted_at TIMESTAMP NULL;
 
-- Create index for cleanup queries
CREATE INDEX idx_notifications_deleted_created_at ON notifications(deleted, created_at);
CREATE INDEX idx_notifications_shop_read_deleted ON notifications(shop, read, deleted); 