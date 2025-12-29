-- Migration to add calendar-related settings to global_settings
-- This allows configuration of non-working days and calendar behavior

-- Insert default calendar settings
INSERT INTO global_settings (setting_key, setting_value, setting_type, description) 
VALUES 
    ('sunday_as_non_working_day', 'true', 'boolean', 'Enable Sunday as a non-working day (weekend)'),
    ('saturday_as_non_working_day', 'false', 'boolean', 'Enable Saturday as a non-working day (weekend)')
ON CONFLICT (setting_key) DO NOTHING;


