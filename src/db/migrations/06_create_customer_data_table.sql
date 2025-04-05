-- Create customer_data table for storing customer interactions
CREATE TABLE IF NOT EXISTS customer_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    contact_id UUID REFERENCES contacts(id),
    deal_id UUID REFERENCES deals(id),
    interaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    interaction_type VARCHAR(50),
    interaction_data JSONB,
    raw_input TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_data_company_id ON customer_data(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_data_contact_id ON customer_data(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_data_deal_id ON customer_data(deal_id);
CREATE INDEX IF NOT EXISTS idx_customer_data_interaction_date ON customer_data(interaction_date);

-- Add comments for documentation
COMMENT ON TABLE customer_data IS 'Stores customer interaction data and history';
COMMENT ON COLUMN customer_data.company_id IS 'Reference to the company';
COMMENT ON COLUMN customer_data.contact_id IS 'Reference to the contact person';
COMMENT ON COLUMN customer_data.deal_id IS 'Reference to the associated deal';
COMMENT ON COLUMN customer_data.interaction_type IS 'Type of interaction (e.g., call, email, meeting)';
COMMENT ON COLUMN customer_data.interaction_data IS 'JSON data containing the details of the interaction';
COMMENT ON COLUMN customer_data.raw_input IS 'Original raw text input describing the interaction'; 