-- First check which table exists and rename accordingly
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'customer_data') THEN
        ALTER TABLE customer_data RENAME TO user_prompt_logs;
    ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'interaction_logs') THEN
        ALTER TABLE interaction_logs RENAME TO user_prompt_logs;
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE user_prompt_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id),
            contact_id UUID REFERENCES contacts(id),
            deal_id UUID REFERENCES deals(id),
            interaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            interaction_type VARCHAR(50),
            interaction_data JSONB,
            raw_input TEXT,
            employee_id UUID,
            employee_name VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Add employee tracking columns if they don't exist yet
ALTER TABLE user_prompt_logs ADD COLUMN IF NOT EXISTS employee_id UUID;
ALTER TABLE user_prompt_logs ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255);

-- Add missing columns if they don't exist yet
ALTER TABLE user_prompt_logs ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
ALTER TABLE user_prompt_logs ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id);
ALTER TABLE user_prompt_logs ADD COLUMN IF NOT EXISTS raw_input TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_prompt_logs_company_id ON user_prompt_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_user_prompt_logs_interaction_date ON user_prompt_logs(interaction_date);
CREATE INDEX IF NOT EXISTS idx_user_prompt_logs_employee_id ON user_prompt_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_user_prompt_logs_contact_id ON user_prompt_logs(contact_id); 
CREATE INDEX IF NOT EXISTS idx_user_prompt_logs_deal_id ON user_prompt_logs(deal_id);

-- Add comments for documentation
COMMENT ON TABLE user_prompt_logs IS 'Stores logs of all raw user input and conversations';
COMMENT ON COLUMN user_prompt_logs.employee_id IS 'ID of the employee who recorded this input';
COMMENT ON COLUMN user_prompt_logs.employee_name IS 'Name of the employee who recorded this input';
COMMENT ON COLUMN user_prompt_logs.raw_input IS 'Original raw text input from the user'; 