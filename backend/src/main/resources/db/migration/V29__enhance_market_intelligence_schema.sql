-- Enhanced Market Intelligence Schema - Add missing fields for production optimization

-- Add enhanced fields to competitor_suggestions table
ALTER TABLE competitor_suggestions 
ADD COLUMN IF NOT EXISTS relevance_score DECIMAL(3,2) DEFAULT 0.00 CHECK (relevance_score >= 0.00 AND relevance_score <= 1.00),
ADD COLUMN IF NOT EXISTS search_keywords TEXT;

-- Add comment for relevance_score
COMMENT ON COLUMN competitor_suggestions.relevance_score IS 'Relevance score from 0.00 to 1.00 indicating how relevant the suggestion is';
COMMENT ON COLUMN competitor_suggestions.search_keywords IS 'Comma-separated keywords used to discover this competitor';

-- Add processed_at column for tracking when suggestions were processed
ALTER TABLE competitor_suggestions 
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Update existing competitor_suggestions with default relevance scores based on source
UPDATE competitor_suggestions 
SET relevance_score = CASE 
    WHEN source = 'GOOGLE_SHOPPING' THEN 0.85
    WHEN source = 'SERPER' THEN 0.80
    WHEN source = 'SCRAPINGDOG' THEN 0.75
    ELSE 0.50
END
WHERE relevance_score IS NULL OR relevance_score = 0.00;

-- Add index for relevance_score for efficient sorting
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_relevance_score ON competitor_suggestions (shop_id, relevance_score DESC);

-- Add index for search_keywords for text search
CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_search_keywords ON competitor_suggestions USING gin(to_tsvector('english', search_keywords));

-- Ensure competitor_urls has shop_id for proper data isolation
ALTER TABLE competitor_urls 
ADD COLUMN IF NOT EXISTS shop_id BIGINT;

-- Update competitor_urls with shop_id from products table where missing
UPDATE competitor_urls 
SET shop_id = p.shop_id 
FROM products p 
WHERE competitor_urls.product_id = p.id 
AND competitor_urls.shop_id IS NULL;

-- Add foreign key constraint for shop_id in competitor_urls
ALTER TABLE competitor_urls 
ADD CONSTRAINT fk_competitor_urls_shop_id 
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

-- Add index for shop_id in competitor_urls
CREATE INDEX IF NOT EXISTS idx_competitor_urls_shop_id ON competitor_urls (shop_id);

-- Add cache_hit_rate column to market_intelligence_costs for performance tracking
ALTER TABLE market_intelligence_costs 
ADD COLUMN IF NOT EXISTS cache_hit_rate DECIMAL(5,2) DEFAULT 0.00 CHECK (cache_hit_rate >= 0.00 AND cache_hit_rate <= 100.00);

COMMENT ON COLUMN market_intelligence_costs.cache_hit_rate IS 'Cache hit rate percentage for the day (0.00 to 100.00)';

-- Add currency column to price_snapshots for multi-currency support
ALTER TABLE price_snapshots 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';

-- Add index for currency in price_snapshots
CREATE INDEX IF NOT EXISTS idx_price_snapshots_currency ON price_snapshots (currency);

-- Update trigger for competitor_suggestions updated_at if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_competitor_suggestions_updated_at') THEN
        CREATE TRIGGER update_competitor_suggestions_updated_at
            BEFORE UPDATE ON competitor_suggestions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;