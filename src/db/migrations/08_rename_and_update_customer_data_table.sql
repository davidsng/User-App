-- Rename the table to better reflect its purpose as a log
ALTER TABLE customer_data RENAME TO interaction_logs;

-- Add employee tracking columns
ALTER TABLE interaction_logs ADD COLUMN IF NOT EXISTS employee_id UUID;
ALTER TABLE interaction_logs ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255);

-- Add index for employee_id
CREATE INDEX IF NOT EXISTS idx_interaction_logs_employee_id ON interaction_logs(employee_id);

-- Add comments for documentation
COMMENT ON TABLE interaction_logs IS 'Stores logs of all customer interactions and conversations';
COMMENT ON COLUMN interaction_logs.employee_id IS 'ID of the employee who recorded this interaction';
COMMENT ON COLUMN interaction_logs.employee_name IS 'Name of the employee who recorded this interaction'; 