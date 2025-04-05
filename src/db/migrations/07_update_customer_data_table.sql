-- Add missing columns to customer_data table
ALTER TABLE customer_data ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
ALTER TABLE customer_data ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id);
ALTER TABLE customer_data ADD COLUMN IF NOT EXISTS raw_input TEXT;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_customer_data_contact_id ON customer_data(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_data_deal_id ON customer_data(deal_id);

-- Add comments for documentation
COMMENT ON COLUMN customer_data.contact_id IS 'Reference to the contact person';
COMMENT ON COLUMN customer_data.deal_id IS 'Reference to the associated deal';
COMMENT ON COLUMN customer_data.raw_input IS 'Original raw text input describing the interaction'; 