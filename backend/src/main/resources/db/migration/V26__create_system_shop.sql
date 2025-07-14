-- Flyway Migration: Create system shop for admin actions and cleanup null shop_id audit logs

-- Create system shop for admin/system actions
INSERT INTO shops (shopify_domain, access_token, created_at, updated_at, is_active) 
VALUES ('system', 'system-token-for-admin-actions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true)
ON CONFLICT (shopify_domain) DO NOTHING;

-- Update existing null shop_id audit logs to use system shop
UPDATE audit_logs 
SET shop_id = (SELECT id FROM shops WHERE shopify_domain = 'system')
WHERE shop_id IS NULL;

-- Add comment for documentation
COMMENT ON TABLE shops IS 'Shops table - includes system shop for admin actions';
COMMENT ON COLUMN shops.shopify_domain IS 'Shop domain - use "system" for admin/system actions'; 