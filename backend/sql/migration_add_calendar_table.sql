-- Migration to add dim_calendar table
-- This table maintains a public calendar with Sunday as non-working day
-- and allows marking public holidays for attendance reporting

-- Create dim_calendar table
CREATE TABLE IF NOT EXISTS dim_calendar (
    calendar_date DATE PRIMARY KEY,
    day_name VARCHAR(10),              -- e.g., 'Monday', 'Sunday'
    is_weekend BOOLEAN DEFAULT FALSE, -- TRUE if Sunday
    is_public_holiday BOOLEAN DEFAULT FALSE,
    holiday_name VARCHAR(100),        -- e.g., 'New Year''s Day'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_calendar_date ON dim_calendar(calendar_date);
CREATE INDEX IF NOT EXISTS idx_calendar_weekend ON dim_calendar(is_weekend);
CREATE INDEX IF NOT EXISTS idx_calendar_holiday ON dim_calendar(is_public_holiday);
CREATE INDEX IF NOT EXISTS idx_calendar_working_day ON dim_calendar(calendar_date) 
    WHERE is_weekend = FALSE AND is_public_holiday = FALSE;

-- Populate calendar with dates from 2024-01-01 to 2030-12-31
-- This will insert all dates and flag weekends based on global settings
-- Default: Sunday is weekend (DOW = 0), Saturday is weekend (DOW = 6)
-- The is_weekend flag will be updated based on global_settings after initial insert
INSERT INTO dim_calendar (calendar_date, day_name, is_weekend)
SELECT 
    datum::DATE,
    TRIM(TO_CHAR(datum, 'Day')),
    CASE 
        WHEN EXTRACT(DOW FROM datum) = 0 THEN TRUE  -- Sunday (default weekend)
        WHEN EXTRACT(DOW FROM datum) = 6 THEN FALSE -- Saturday (default working day, can be changed via settings)
        ELSE FALSE
    END
FROM generate_series(
    '2024-01-01'::DATE, 
    '2030-12-31'::DATE, 
    '1 day'::INTERVAL
) AS datum
ON CONFLICT (calendar_date) DO NOTHING;

-- Update weekend flags based on global settings
-- This function will be called after settings are configured
DO $$
DECLARE
    sunday_enabled BOOLEAN;
    saturday_enabled BOOLEAN;
BEGIN
    -- Get settings (default to true for Sunday, false for Saturday if not set)
    SELECT COALESCE(
        (SELECT setting_value::boolean FROM global_settings WHERE setting_key = 'sunday_as_non_working_day'),
        true
    ) INTO sunday_enabled;
    
    SELECT COALESCE(
        (SELECT setting_value::boolean FROM global_settings WHERE setting_key = 'saturday_as_non_working_day'),
        false
    ) INTO saturday_enabled;
    
    -- Update Sunday weekends
    IF sunday_enabled THEN
        UPDATE dim_calendar 
        SET is_weekend = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE EXTRACT(DOW FROM calendar_date) = 0;
    ELSE
        UPDATE dim_calendar 
        SET is_weekend = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE EXTRACT(DOW FROM calendar_date) = 0;
    END IF;
    
    -- Update Saturday weekends
    IF saturday_enabled THEN
        UPDATE dim_calendar 
        SET is_weekend = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE EXTRACT(DOW FROM calendar_date) = 6;
    ELSE
        UPDATE dim_calendar 
        SET is_weekend = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE EXTRACT(DOW FROM calendar_date) = 6;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE dim_calendar IS 'Calendar dimension table for tracking working days, weekends, and public holidays';
COMMENT ON COLUMN dim_calendar.calendar_date IS 'The calendar date (primary key)';
COMMENT ON COLUMN dim_calendar.day_name IS 'Name of the day (e.g., Monday, Sunday)';
COMMENT ON COLUMN dim_calendar.is_weekend IS 'TRUE if the day is a weekend (Sunday)';
COMMENT ON COLUMN dim_calendar.is_public_holiday IS 'TRUE if the day is a public holiday';
COMMENT ON COLUMN dim_calendar.holiday_name IS 'Name of the public holiday if applicable';

