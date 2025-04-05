-- Add is_primary field to contacts table to identify the primary contact
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

-- Add index for faster queries by primary contacts
CREATE INDEX IF NOT EXISTS idx_contacts_is_primary ON contacts(is_primary);

-- Add comment for documentation
COMMENT ON COLUMN contacts.is_primary IS 'Indicates if this is the primary contact for the company';

-- If a company has a primary_contact field set, mark that contact as primary
UPDATE contacts c
SET is_primary = TRUE
FROM companies comp
WHERE c.company_id = comp.id 
AND comp.primary_contact IS NOT NULL
AND comp.primary_contact <> ''
AND c.name = comp.primary_contact
AND c.is_primary IS NULL; 