-- Create DPIA records table
CREATE TABLE IF NOT EXISTS dpia_records (
  id BIGSERIAL PRIMARY KEY,
  process_name VARCHAR(255) NOT NULL,
  purpose TEXT,
  pii_categories TEXT,
  risks TEXT,
  mitigations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add note: field-level encryption uses application-layer converter; no schema change needed.


