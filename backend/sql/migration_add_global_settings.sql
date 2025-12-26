-- Migration to add global_settings table
-- This table stores system-wide configuration settings

-- Create global_settings table
CREATE TABLE IF NOT EXISTS global_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(50) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_global_settings_key ON global_settings(setting_key);

-- Insert default settings for leave date ranges (in months)
INSERT INTO global_settings (setting_key, setting_value, setting_type, description) 
VALUES 
    ('leave_max_past_months', '6', 'number', 'Maximum number of months in the past allowed for leave entry'),
    ('leave_max_future_months', '6', 'number', 'Maximum number of months in the future allowed for leave entry')
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE global_settings IS 'Stores global system configuration settings';
COMMENT ON COLUMN global_settings.setting_key IS 'Unique identifier for the setting';
COMMENT ON COLUMN global_settings.setting_value IS 'Value of the setting (stored as text, interpreted based on setting_type)';
COMMENT ON COLUMN global_settings.setting_type IS 'Type of the setting: string, number, boolean, or json';

