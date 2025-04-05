-- Migration to fix default timestamps for deals table
ALTER TABLE deals ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE deals ALTER COLUMN updated_at SET DEFAULT NOW(); 