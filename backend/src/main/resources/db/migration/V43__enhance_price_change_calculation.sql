-- V43: Enhance Price Change Calculation with Improved Accuracy
-- This migration improves the accuracy of price change calculations and adds validation functions

-- Add function to validate and fix price change calculations
CREATE OR REPLACE FUNCTION validate_price_changes()
RETURNS TABLE(
    competitor_id BIGINT,
    snapshot_id BIGINT,
    old_price_change DECIMAL(5,2),
    new_price_change DECIMAL(5,2),
    fixed BOOLEAN
) AS $$
DECLARE
    snapshot_record RECORD;
    prev_price DECIMAL(10,2);
    current_price DECIMAL(10,2);
    correct_change DECIMAL(5,2);
    stored_change DECIMAL(5,2);
BEGIN
    -- Loop through all price snapshots that have price_change_percent
    FOR snapshot_record IN 
        SELECT 
            ps.id,
            ps.competitor_url_id,
            ps.price,
            ps.price_change_percent,
            ps.checked_at
        FROM price_snapshots ps
        WHERE ps.deleted_at IS NULL
        AND ps.price IS NOT NULL
        AND ps.price > 0
        ORDER BY ps.competitor_url_id, ps.checked_at ASC
    LOOP
        -- Get the previous price for this competitor
        SELECT price INTO prev_price
        FROM price_snapshots
        WHERE competitor_url_id = snapshot_record.competitor_url_id
        AND deleted_at IS NULL
        AND price IS NOT NULL
        AND price > 0
        AND checked_at < snapshot_record.checked_at
        ORDER BY checked_at DESC
        LIMIT 1;
        
        -- If we have a previous price, calculate the correct change
        IF prev_price IS NOT NULL AND prev_price > 0 THEN
            current_price := snapshot_record.price;
            correct_change := ROUND(((current_price - prev_price) / prev_price * 100)::numeric, 2);
            stored_change := snapshot_record.price_change_percent;
            
            -- Check if the stored value is different from the calculated value
            IF stored_change IS NULL OR stored_change != correct_change THEN
                -- Update the stored value
                UPDATE price_snapshots 
                SET price_change_percent = correct_change,
                    significant_change = ABS(correct_change) > 5
                WHERE id = snapshot_record.id;
                
                -- Return the fix information
                competitor_id := snapshot_record.competitor_url_id;
                snapshot_id := snapshot_record.id;
                old_price_change := stored_change;
                new_price_change := correct_change;
                fixed := true;
                RETURN NEXT;
            END IF;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Add function to get price change statistics
CREATE OR REPLACE FUNCTION get_price_change_statistics(p_competitor_id BIGINT)
RETURNS TABLE(
    total_snapshots BIGINT,
    snapshots_with_changes BIGINT,
    avg_change_percent DECIMAL(5,2),
    min_change_percent DECIMAL(5,2),
    max_change_percent DECIMAL(5,2),
    price_increases BIGINT,
    price_decreases BIGINT,
    no_changes BIGINT,
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
        COUNT(CASE WHEN price_change_percent > 0 THEN 1 END)::BIGINT as price_increases,
        COUNT(CASE WHEN price_change_percent < 0 THEN 1 END)::BIGINT as price_decreases,
        COUNT(CASE WHEN price_change_percent = 0 THEN 1 END)::BIGINT as no_changes,
        MIN(checked_at) as first_check,
        MAX(checked_at) as last_check
    FROM price_snapshots 
    WHERE competitor_url_id = p_competitor_id 
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Add function to calculate price change over a specific period
CREATE OR REPLACE FUNCTION calculate_price_change_over_period(
    p_competitor_id BIGINT, 
    p_days INTEGER
)
RETURNS TABLE(
    current_price DECIMAL(10,2),
    historical_price DECIMAL(10,2),
    change_percent DECIMAL(5,2),
    days_ago INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        current.price as current_price,
        historical.price as historical_price,
        ROUND(((current.price - historical.price) / historical.price * 100)::numeric, 2) as change_percent,
        p_days as days_ago
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
END;
$$ LANGUAGE plpgsql;

-- Add function to get price trend analysis
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
    -- Get the price change over the specified period
    SELECT change_percent INTO price_change
    FROM calculate_price_change_over_period(p_competitor_id, p_days);
    
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

-- Create index for better price change calculations
CREATE INDEX IF NOT EXISTS idx_price_snapshots_competitor_checked 
ON price_snapshots (competitor_url_id, checked_at DESC) 
WHERE deleted_at IS NULL;

-- Create index for price change percentage queries
CREATE INDEX IF NOT EXISTS idx_price_snapshots_change_percent 
ON price_snapshots (competitor_url_id, price_change_percent) 
WHERE deleted_at IS NULL AND price_change_percent IS NOT NULL;

-- Add comments for documentation
COMMENT ON FUNCTION validate_price_changes() IS 'Validates and fixes price change calculations for all snapshots';
COMMENT ON FUNCTION get_price_change_statistics(BIGINT) IS 'Gets comprehensive price change statistics for a competitor';
COMMENT ON FUNCTION calculate_price_change_over_period(BIGINT, INTEGER) IS 'Calculates price change over a specific time period';
COMMENT ON FUNCTION get_price_trend(BIGINT, INTEGER) IS 'Analyzes price trend (increasing, decreasing, stable) with confidence level';

-- Run initial validation on existing data
SELECT validate_price_changes(); 