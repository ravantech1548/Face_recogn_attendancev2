-- Calendar Table Usage Examples
-- This file contains example SQL queries for working with the dim_calendar table

-- ============================================
-- 1. ADD PUBLIC HOLIDAYS
-- ============================================

-- Example: Add New Year's Day 2025
UPDATE dim_calendar 
SET is_public_holiday = TRUE, 
    holiday_name = 'New Year''s Day',
    updated_at = CURRENT_TIMESTAMP
WHERE calendar_date = '2025-01-01';

-- Example: Add multiple holidays for 2025
UPDATE dim_calendar 
SET is_public_holiday = TRUE, 
    holiday_name = CASE calendar_date
        WHEN '2025-01-01' THEN 'New Year''s Day'
        WHEN '2025-12-25' THEN 'Christmas Day'
        WHEN '2025-12-26' THEN 'Boxing Day'
        ELSE holiday_name
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE calendar_date IN ('2025-01-01', '2025-12-25', '2025-12-26');

-- Example: Add a holiday that falls on Sunday (observed on Monday)
-- Mark both Sunday and Monday
UPDATE dim_calendar 
SET is_public_holiday = TRUE, 
    holiday_name = 'Independence Day (Observed)',
    updated_at = CURRENT_TIMESTAMP
WHERE calendar_date = '2025-07-07'; -- Monday after July 4th if it falls on Sunday

-- ============================================
-- 2. QUERY WORKING DAYS
-- ============================================

-- Get all working days in a month (excluding weekends and holidays)
SELECT calendar_date, day_name
FROM dim_calendar
WHERE calendar_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND is_weekend = FALSE
  AND is_public_holiday = FALSE
ORDER BY calendar_date;

-- Get all non-working days in a month
SELECT calendar_date, day_name, 
       CASE 
           WHEN is_weekend THEN 'Weekend'
           WHEN is_public_holiday THEN holiday_name
       END AS reason
FROM dim_calendar
WHERE calendar_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND (is_weekend = TRUE OR is_public_holiday = TRUE)
ORDER BY calendar_date;

-- ============================================
-- 3. ATTENDANCE REPORT WITH CALENDAR
-- ============================================

-- Example: Get attendance status for all employees in a month
-- This shows Present, Absent, or Non-Working Day
SELECT 
    s.staff_id,
    s.full_name,
    c.calendar_date,
    c.day_name,
    CASE 
        WHEN c.is_weekend = TRUE THEN 'Weekend'
        WHEN c.is_public_holiday = TRUE THEN c.holiday_name
        WHEN a.check_in_time IS NULL THEN 'Absent'
        ELSE 'Present'
    END AS status,
    a.check_in_time,
    a.check_out_time
FROM dim_calendar c
CROSS JOIN staff s
LEFT JOIN attendance a ON c.calendar_date = DATE(a.check_in_time) 
                       AND a.staff_id = s.staff_id
WHERE c.calendar_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND s.is_active = TRUE
ORDER BY s.full_name, c.calendar_date;

-- Example: Count working days vs present days for each employee
SELECT 
    s.staff_id,
    s.full_name,
    COUNT(CASE WHEN c.is_weekend = FALSE AND c.is_public_holiday = FALSE THEN 1 END) AS total_working_days,
    COUNT(CASE WHEN a.check_in_time IS NOT NULL 
               AND c.is_weekend = FALSE 
               AND c.is_public_holiday = FALSE THEN 1 END) AS days_present,
    COUNT(CASE WHEN a.check_in_time IS NULL 
               AND c.is_weekend = FALSE 
               AND c.is_public_holiday = FALSE THEN 1 END) AS days_absent
FROM dim_calendar c
CROSS JOIN staff s
LEFT JOIN attendance a ON c.calendar_date = DATE(a.check_in_time) 
                       AND a.staff_id = s.staff_id
WHERE c.calendar_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND s.is_active = TRUE
GROUP BY s.staff_id, s.full_name
ORDER BY s.full_name;

-- ============================================
-- 4. UTILITY QUERIES
-- ============================================

-- Check if a specific date is a working day
SELECT 
    calendar_date,
    day_name,
    is_weekend,
    is_public_holiday,
    holiday_name,
    CASE 
        WHEN is_weekend = TRUE OR is_public_holiday = TRUE THEN FALSE
        ELSE TRUE
    END AS is_working_day
FROM dim_calendar
WHERE calendar_date = CURRENT_DATE;

-- Get all public holidays in a year
SELECT calendar_date, day_name, holiday_name
FROM dim_calendar
WHERE is_public_holiday = TRUE
  AND EXTRACT(YEAR FROM calendar_date) = 2025
ORDER BY calendar_date;

-- Count working days in a date range
SELECT 
    COUNT(*) AS total_working_days
FROM dim_calendar
WHERE calendar_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND is_weekend = FALSE
  AND is_public_holiday = FALSE;

-- Remove a holiday (if needed)
UPDATE dim_calendar 
SET is_public_holiday = FALSE, 
    holiday_name = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE calendar_date = '2025-01-01';


