# Calendar Dashboard Error Fix

## Issue
Getting "Failed to load calendar data: Server error" when accessing the Calendar Dashboard.

## Root Cause
The `dim_calendar` table doesn't exist in the database. This table is created by the database migrations.

## Solution

### Step 1: Run Database Migrations

Run the migration script to create the calendar table and settings:

```bash
cd backend
node scripts/run_all_migration.js
```

This will:
- Create the `dim_calendar` table
- Populate it with dates from 2024-2030
- Add calendar settings to `global_settings` table
- Mark Sundays as weekends by default

### Step 2: Verify the Table Exists

You can verify the table was created by running this SQL query in your PostgreSQL database:

```sql
SELECT COUNT(*) FROM dim_calendar;
```

You should see a count of dates (approximately 2,555 dates from 2024-2030).

### Step 3: Check Backend Logs

If the error persists after running migrations, check the backend server logs for the actual SQL error. The error message should now be more descriptive.

## Error Handling Improvements

The calendar dashboard endpoints now include:
1. **Table existence check** - Checks if `dim_calendar` table exists before querying
2. **Better error messages** - Returns a helpful message if the table is missing
3. **Migration hint** - Suggests running migrations if the table is not found

## Testing

After running migrations, try accessing the Calendar Dashboard again:
1. Navigate to `/attendance/calendar` in the application
2. Select a month and year
3. The calendar grid should display with all dates

## Common Issues

### Issue: "Calendar table not found"
**Solution**: Run the migrations as described in Step 1.

### Issue: "relation dim_calendar does not exist"
**Solution**: This is the same as above - the table hasn't been created yet.

### Issue: Empty calendar or no data showing
**Solution**: 
- Check if there are active staff members in the database
- Verify that the date range is correct (2024-2030)
- Check backend logs for any SQL errors

## API Endpoints

The calendar dashboard uses these endpoints:
- `GET /api/attendance/calendar-view?year=2025&month=1` - Get month summary
- `GET /api/attendance/calendar-view/:date` - Get detailed staff attendance for a date
- `GET /api/attendance/calendar-view/export?year=2025&month=1&format=excel` - Export report

All endpoints now include proper error handling for missing tables.


