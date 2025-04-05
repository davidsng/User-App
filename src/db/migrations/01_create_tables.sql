-- Drop existing tables if they exist
DROP TABLE IF EXISTS customer_data CASCADE;
DROP TABLE IF EXISTS company_state CASCADE;
DROP TABLE IF EXISTS contact_state CASCADE;
DROP TABLE IF EXISTS deal_state CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Create companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  industry_vertical VARCHAR(255),
  sub_industry VARCHAR(255),
  b2b_or_b2c VARCHAR(50),
  size VARCHAR(100),
  website_url VARCHAR(255),
  country_hq VARCHAR(100),
  other_countries TEXT[], -- Storing array of countries
  revenue DECIMAL(15, 2),
  employee_size INTEGER,
  child_companies TEXT[],
  customer_segment_label VARCHAR(100),
  primary_contact VARCHAR(255),
  account_team TEXT[],
  company_hierarchy TEXT,
  decision_country VARCHAR(100),
  company_address TEXT,
  company_legal_entity VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  -- Tracking field to store operation history as JSONB array
  change_history JSONB DEFAULT '[]'::jsonb
);

-- Create contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(100),
  title VARCHAR(255),
  influence_role VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  -- Tracking field to store previous values when contact info changes
  change_history JSONB DEFAULT '[]'::jsonb
);

-- Create deals table
CREATE TABLE deals (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  product_id UUID REFERENCES products(id),
  deal_id VARCHAR(255),
  deal_state VARCHAR(100),
  deal_amount DECIMAL(15, 2),
  deal_amount_currency VARCHAR(10) DEFAULT 'USD',
  stage VARCHAR(100),
  deal_payment_status VARCHAR(100),
  deal_start_date DATE,
  deal_end_date DATE,
  deal_policy_state VARCHAR(100),
  deal_health INTEGER,
  payment_frequency VARCHAR(100),
  acquisition_channel_source VARCHAR(255),
  acquisition_campaign_source VARCHAR(255),
  deal_activity TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  -- Tracking field to store changes in deal status/value
  change_history JSONB DEFAULT '[]'::jsonb
);

-- Create customer_data table (raw interaction logs)
CREATE TABLE customer_data (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  raw_input TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_company_name ON companies(name);
CREATE INDEX idx_company_industry ON companies(industry_vertical);
CREATE INDEX idx_company_country ON companies(country_hq);
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_deals_company_id ON deals(company_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_customer_data_company_id ON customer_data(company_id);
CREATE INDEX idx_customer_data_created_at ON customer_data(created_at); 