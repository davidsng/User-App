-- Add company_name and product_name columns to deals table for easier reporting

-- Add columns if they don't exist
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);

-- Update existing deals with company names
UPDATE deals d
SET company_name = c.name
FROM companies c
WHERE d.company_id = c.id
AND d.company_name IS NULL;

-- Update existing deals with product names
UPDATE deals d
SET product_name = p.name
FROM products p
WHERE d.product_id = p.id
AND d.product_name IS NULL;

-- Add a comment to explain the purpose
COMMENT ON COLUMN deals.company_name IS 'Denormalized company name for easier querying and reporting';
COMMENT ON COLUMN deals.product_name IS 'Denormalized product name for easier querying and reporting'; 