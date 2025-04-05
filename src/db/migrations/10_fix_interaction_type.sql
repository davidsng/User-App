-- Make interaction_type nullable
ALTER TABLE user_prompt_logs ALTER COLUMN interaction_type DROP NOT NULL; 