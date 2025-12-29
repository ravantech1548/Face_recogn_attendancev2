# Calendar and Holiday Management System

This document describes the calendar and public holiday management system that has been added to the Face Recognition Attendance System.

## Overview

The system now includes:
1. **Calendar Table (`dim_calendar`)**: A dimension table that stores all dates from 2024-2030 with weekend and holiday flags
2. **Configurable Weekend Settings**: Sunday (and optionally Saturday) can be configured as non-working days via global settings
3. **Public Holiday Management**: API endpoints to add, update, and delete public holidays
4. **Automatic Weekend Updates**: When weekend settings change, the calendar table is automatically updated

## Database Schema

### Calendar Table (`dim_calendar`)
```sql
CREATE TABLE dim_calendar (
    calendar_date DATE PRIMARY KEY,
    day_name VARCHAR(10),              -- e.g., 'Monday', 'Sunday'
    is_weekend BOOLEAN DEFAULT FALSE, -- TRUE if Sunday (or Saturday if configured)
    is_public_holiday BOOLEAN DEFAULT FALSE,
    holiday_name VARCHAR(100),        -- e.g., 'New Year''s Day'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Global Settings
- `sunday_as_non_working_day` (boolean, default: `true`) - Enable/disable Sunday as weekend
- `saturday_as_non_working_day` (boolean, default: `false`) - Enable/disable Saturday as weekend

## API Endpoints

### Calendar Endpoints

#### 1. Get Public Holidays
```
GET /api/calendar/holidays
Query Parameters:
  - startDate (optional): Start date filter (YYYY-MM-DD)
  - endDate (optional): End date filter (YYYY-MM-DD)
  - year (optional): Filter by year (e.g., 2025)
```

**Example:**
```bash
GET /api/calendar/holidays?year=2025
```

#### 2. Get Calendar Information
```
GET /api/calendar/calendar
Query Parameters:
  - startDate (required): Start date (YYYY-MM-DD)
  - endDate (required): End date (YYYY-MM-DD)
```

**Example:**
```bash
GET /api/calendar/calendar?startDate=2025-01-01&endDate=2025-01-31
```

#### 3. Get Working Days Count
```
GET /api/calendar/working-days
Query Parameters:
  - startDate (required): Start date (YYYY-MM-DD)
  - endDate (required): End date (YYYY-MM-DD)
```

**Example:**
```bash
GET /api/calendar/working-days?startDate=2025-01-01&endDate=2025-01-31
```

### Holiday Management Endpoints (Admin Only)

#### 4. Add/Update Single Holiday
```
POST /api/calendar/holidays
Headers:
  Authorization: Bearer <token>
Body:
  {
    "date": "2025-01-01",
    "holidayName": "New Year's Day"
  }
```

#### 5. Bulk Upload/Update Holidays
```
POST /api/calendar/holidays/bulk
Headers:
  Authorization: Bearer <token>
Body:
  {
    "holidays": [
      {
        "date": "2025-01-01",
        "holidayName": "New Year's Day"
      },
      {
        "date": "2025-12-25",
        "holidayName": "Christmas Day"
      }
    ]
  }
```

**Response:**
```json
{
  "message": "Bulk holiday update completed: 2 created, 0 updated, 0 errors",
  "results": {
    "created": [...],
    "updated": [...],
    "errors": []
  }
}
```

#### 6. Update Holiday Name
```
PUT /api/calendar/holidays/:date
Headers:
  Authorization: Bearer <token>
Body:
  {
    "holidayName": "Updated Holiday Name"
  }
```

#### 7. Delete Holiday
```
DELETE /api/calendar/holidays/:date
Headers:
  Authorization: Bearer <token>
```

#### 8. Refresh Weekend Configuration
```
POST /api/calendar/weekend-config/refresh
Headers:
  Authorization: Bearer <token>
```

This endpoint manually refreshes the weekend flags in the calendar table based on current global settings.

## Configuration via Global Settings

### Enable/Disable Sunday as Non-Working Day

```bash
PUT /api/settings/sunday_as_non_working_day
Headers:
  Authorization: Bearer <token>
Body:
  {
    "value": true  // or false
  }
```

When this setting is updated, the calendar table is automatically refreshed to reflect the change.

### Enable/Disable Saturday as Non-Working Day

```bash
PUT /api/settings/saturday_as_non_working_day
Headers:
  Authorization: Bearer <token>
Body:
  {
    "value": true  // or false
  }
```

## Usage Examples

### Example 1: Add a Single Holiday
```javascript
const response = await fetch('/api/calendar/holidays', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    date: '2025-01-01',
    holidayName: "New Year's Day"
  })
});
```

### Example 2: Bulk Upload Holidays for 2025
```javascript
const holidays = [
  { date: '2025-01-01', holidayName: "New Year's Day" },
  { date: '2025-12-25', holidayName: 'Christmas Day' },
  { date: '2025-12-26', holidayName: 'Boxing Day' }
];

const response = await fetch('/api/calendar/holidays/bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ holidays })
});
```

### Example 3: Get All Holidays for a Year
```javascript
const response = await fetch('/api/calendar/holidays?year=2025', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const holidays = await response.json();
```

### Example 4: Get Working Days Count for January 2025
```javascript
const response = await fetch('/api/calendar/working-days?startDate=2025-01-01&endDate=2025-01-31', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { workingDays } = await response.json();
console.log(`Working days in January 2025: ${workingDays}`);
```

## Integration with Attendance Reports

The calendar table can be used in attendance queries to:
- Identify non-working days (weekends and holidays)
- Calculate working days in a date range
- Filter attendance records to exclude non-working days
- Flag holiday pay scenarios

### Example Query: Attendance Report with Calendar
```sql
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
```

## Migration

To set up the calendar system, run the migrations:

```bash
cd backend
node scripts/run_all_migration.js
```

This will:
1. Create the `dim_calendar` table
2. Populate it with dates from 2024-2030
3. Mark Sundays as weekends (by default)
4. Add calendar settings to `global_settings` table

## Notes

- The calendar table is pre-populated with dates from 2024-01-01 to 2030-12-31
- Weekend flags are automatically updated when global settings change
- Public holidays can be added individually or in bulk
- The system supports both Sunday-only and Saturday-Sunday weekend configurations
- All holiday management endpoints require admin authentication


