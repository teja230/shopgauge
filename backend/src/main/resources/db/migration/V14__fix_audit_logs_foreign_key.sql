-- Flyway Migration: Fix audit logs foreign key constraint

-- Drop the existing foreign key constraint
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_shop_id_fkey;

-- Re-add the foreign key constraint with CASCADE delete
ALTER TABLE audit_logs 
ADD CONSTRAINT audit_logs_shop_id_fkey 
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE; 