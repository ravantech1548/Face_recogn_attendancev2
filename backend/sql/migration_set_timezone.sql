-- Migration to set database timezone to local system timezone
-- This ensures all timestamps use the local system time instead of UTC

-- Note: Replace 'Asia/Singapore' with your actual timezone
-- Common timezones:
--   'Asia/Singapore' (UTC+8)
--   'Asia/Kolkata' (UTC+5:30)
--   'America/New_York' (UTC-5)
--   'Europe/London' (UTC+0)
--   'Asia/Tokyo' (UTC+9)
--   'Asia/Bangkok' (UTC+7)

-- Set timezone for the database (affects all sessions)
-- Replace 'Asia/Singapore' with your timezone or use environment variable
DO $$
DECLARE
    tz_name TEXT;
BEGIN
    -- Try to get timezone from environment or use default
    -- You can set DB_TIMEZONE environment variable before running migration
    tz_name := COALESCE(current_setting('app.timezone', true), 'Asia/Singapore');
    
    -- Set database timezone (may require superuser)
    BEGIN
        EXECUTE format('ALTER DATABASE face_recognition_attendance SET timezone = %L', tz_name);
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'Cannot set database timezone (requires superuser), using session timezone';
    END;
    
    -- Set session timezone
    EXECUTE format('SET timezone = %L', tz_name);
    
    RAISE NOTICE 'Timezone set to: %', tz_name;
END $$;

-- Verify timezone setting
SELECT 
    current_setting('timezone') as current_timezone,
    NOW() as current_timestamp,
    CURRENT_DATE as current_date,
    CURRENT_TIME as current_time;

