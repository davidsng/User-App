-- Add company_name column to contacts table for easier reporting
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

-- Add index for faster reporting queries that filter or join by company name
CREATE INDEX IF NOT EXISTS idx_contacts_company_name ON contacts(company_name);

-- Add comment for documentation
COMMENT ON COLUMN contacts.company_name IS 'Name of the company this contact belongs to, denormalized for reporting';

-- Update existing records to populate the company_name from the companies table
UPDATE contacts c
SET company_name = comp.name
FROM companies comp
WHERE c.company_id = comp.id 
AND c.company_name IS NULL; 