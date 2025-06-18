-- Composite index for shop_id and date on daily_metrics
CREATE INDEX IF NOT EXISTS idx_daily_metrics_shop_date ON daily_metrics (shop_id, date); 