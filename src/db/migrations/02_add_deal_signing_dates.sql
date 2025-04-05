-- Add new deal signing date fields
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_expected_signing_date DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_signing_date DATE;

-- Create indexes for efficient queries on these fields
CREATE INDEX IF NOT EXISTS idx_deals_expected_signing_date ON deals(deal_expected_signing_date);
CREATE INDEX IF NOT EXISTS idx_deals_signing_date ON deals(deal_signing_date);

-- Add a comment explaining the purpose of these fields
COMMENT ON COLUMN deals.deal_expected_signing_date IS 'Expected date when the deal will be signed';
COMMENT ON COLUMN deals.deal_signing_date IS 'Actual date when the deal was signed'; 