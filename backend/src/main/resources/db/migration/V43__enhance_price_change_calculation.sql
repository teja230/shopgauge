-- V43: Enhance Price Change Calculation with Improved Accuracy
-- This migration adds essential improvements for price change calculations
-- Optimized for minimal test data scenarios

-- Create essential indexes for better price change calculations
CREATE INDEX IF NOT EXISTS idx_price_snapshots_competitor_checked 
ON price_snapshots (competitor_url_id, checked_at DESC) 
WHERE deleted_at IS NULL;

-- Create index for price change percentage queries (only if data exists)
CREATE INDEX IF NOT EXISTS idx_price_snapshots_change_percent 
ON price_snapshots (competitor_url_id, price_change_percent) 
WHERE deleted_at IS NULL AND price_change_percent IS NOT NULL;

-- Add simple function for basic price change statistics (minimal data friendly)
CREATE OR REPLACE FUNCTION get_price_change_statistics(p_competitor_id BIGINT)
RETURNS TABLE(
    total_snapshots BIGINT,
    snapshots_with_changes BIGINT,
    avg_change_percent DECIMAL(5,2),
    min_change_percent DECIMAL(5,2),
    max_change_percent DECIMAL(5,2),
    first_check TIMESTAMP,
    last_check TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_snapshots,
        COUNT(CASE WHEN price_change_percent IS NOT NULL THEN 1 END)::BIGINT as snapshots_with_changes,
        AVG(price_change_percent) as avg_change_percent,
        MIN(price_change_percent) as min_change_percent,
        MAX(price_change_percent) as max_change_percent,
        MIN(checked_at) as first_check,
        MAX(checked_at) as last_check
    FROM price_snapshots 
    WHERE competitor_url_id = p_competitor_id 
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Add simple trend analysis function (minimal data friendly)
CREATE OR REPLACE FUNCTION get_price_trend(p_competitor_id BIGINT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(
    trend VARCHAR(20),
    change_percent DECIMAL(5,2),
    confidence_level VARCHAR(20)
) AS $$
DECLARE
    price_change DECIMAL(5,2);
    trend_result VARCHAR(20);
    confidence VARCHAR(20);
BEGIN
    -- Simple trend calculation for minimal data
    SELECT 
        ROUND(((current.price - historical.price) / historical.price * 100)::numeric, 2) INTO price_change
    FROM (
        SELECT price 
        FROM price_snapshots 
        WHERE competitor_url_id = p_competitor_id 
        AND deleted_at IS NULL 
        AND price IS NOT NULL 
        AND price > 0
        ORDER BY checked_at DESC 
        LIMIT 1
    ) current
    CROSS JOIN (
        SELECT price 
        FROM price_snapshots 
        WHERE competitor_url_id = p_competitor_id 
        AND deleted_at IS NULL 
        AND price IS NOT NULL 
        AND price > 0
        AND checked_at <= CURRENT_DATE - INTERVAL '1 day' * p_days
        ORDER BY checked_at DESC 
        LIMIT 1
    ) historical
    WHERE current.price IS NOT NULL 
    AND historical.price IS NOT NULL;
    
    -- Determine trend based on change percentage
    IF price_change IS NULL THEN
        trend_result := 'insufficient_data';
        confidence := 'low';
    ELSIF price_change > 1.0 THEN
        trend_result := 'increasing';
        confidence := CASE WHEN ABS(price_change) > 5 THEN 'high' ELSE 'medium' END;
    ELSIF price_change < -1.0 THEN
        trend_result := 'decreasing';
        confidence := CASE WHEN ABS(price_change) > 5 THEN 'high' ELSE 'medium' END;
    ELSE
        trend_result := 'stable';
        confidence := 'medium';
    END IF;
    
    trend := trend_result;
    change_percent := price_change;
    confidence_level := confidence;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION get_price_change_statistics(BIGINT) IS 'Gets basic price change statistics for a competitor (minimal data friendly)';
COMMENT ON FUNCTION get_price_trend(BIGINT, INTEGER) IS 'Analyzes price trend (increasing, decreasing, stable) with confidence level (minimal data friendly)';

-- Note: No initial validation run for minimal test data
-- The PriceChangeCalculationService will handle validation on-demand when needed 