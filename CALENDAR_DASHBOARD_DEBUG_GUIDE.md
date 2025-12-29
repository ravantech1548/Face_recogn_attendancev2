# Calendar Dashboard Debug Guide

## Issue
Calendar dashboard is not showing attendance and leave data.

## Debugging Steps

### Step 1: Run the Test Script

I've created a test script to verify the query works:

```bash
cd backend
node scripts/test_calendar_query.js
```

This will:
- Check if the calendar table exists
- Verify attendance records exist
- Test the query for a sample date
- Check date format matching
- Show sample results

### Step 2: Check Backend Logs

When you access the calendar dashboard, check the backend console logs. You should see:

```
=== Calendar View Debug ===
Date Range: { startDate: '2025-01-01', endDate: '2025-01-31' }
Params: [ '2025-01-01', '2025-01-31' ]
Attendance Records Found: X
Sample Attendance: [...]
Summary Result Count: 31
Sample Summary: [...]
Days with data: X
```

### Step 3: Use the Debug Endpoint

Access the debug endpoint directly:

```bash
# In browser or Postman
GET /api/attendance/calendar-view/debug?year=2025&month=1
```

This returns:
- Calendar days count
- Active staff count
- All attendance records grouped by date and status
- Status breakdown
- Sample records

### Step 4: Check Browser Console

Open browser DevTools (F12) and check the Console tab. You should see:

```
Calendar Data Received: { summaryCount: 31, sampleDays: [...], debug: {...} }
Calendar query success: { totalDays: 31, daysWithData: X, sampleData: [...] }
```

### Step 5: Verify Data Exists

Run these SQL queries directly in your database:

```sql
-- Check if you have attendance records
SELECT date, status, COUNT(*) 
FROM attendance 
WHERE date >= '2025-01-01' AND date <= '2025-01-31'
GROUP BY date, status
ORDER BY date;

-- Check if dates match calendar table
SELECT 
  a.date as attendance_date,
  c.calendar_date,
  a.date = c.calendar_date as dates_match
FROM attendance a
JOIN dim_calendar c ON a.date = c.calendar_date
WHERE a.date >= '2025-01-01' AND a.date <= '2025-01-31'
LIMIT 5;

-- Check status values
SELECT DISTINCT status FROM attendance;
```

## Common Issues and Fixes

### Issue 1: No Data Showing
**Possible Causes:**
- No attendance records exist for the selected month
- Date format mismatch
- Status values don't match expected values

**Fix:**
- Check if attendance records exist using the SQL queries above
- Verify status values are exactly: `'present'`, `'casual_leave'`, `'medical_leave'`, `'unpaid_leave'`, `'hospitalised_leave'`

### Issue 2: Calendar Table Missing
**Error:** "Calendar table not found"

**Fix:**
```bash
cd backend
node scripts/run_all_migration.js
```

### Issue 3: Date Format Mismatch
**Symptom:** Records exist but don't show in calendar

**Fix:**
- Both `attendance.date` and `dim_calendar.calendar_date` should be DATE type
- Verify they match exactly: `SELECT a.date, c.calendar_date FROM attendance a, dim_calendar c WHERE a.date = c.calendar_date LIMIT 1;`

### Issue 4: Status Values Don't Match
**Symptom:** Records exist but counts are 0

**Fix:**
- Check actual status values: `SELECT DISTINCT status FROM attendance;`
- Ensure they match exactly (case-sensitive): `'present'`, not `'Present'` or `'PRESENT'`

## Query Explanation

The calendar query now uses:
1. **CROSS JOIN** - Creates all combinations of dates and active staff
2. **LEFT JOIN** - Finds matching attendance records
3. **COUNT(DISTINCT CASE ...)** - Counts by status type
4. **GROUP BY** - Groups by date to get daily summaries

This approach ensures:
- All dates in the month are included
- All active staff are considered
- Present, leave, and absent are counted correctly
- Weekends and holidays are properly identified

## Testing the Fix

After making changes:

1. **Restart the backend server**
2. **Clear browser cache** (Ctrl+Shift+R)
3. **Access the calendar dashboard**
4. **Check browser console** for debug logs
5. **Check backend console** for query logs
6. **Use the debug endpoint** to verify data

## Expected Results

When working correctly, you should see:
- Calendar grid with all dates
- Green background for days with present attendance
- Orange background for days with leave
- Red background for days with absent staff (on working days)
- Numbers showing P: X, L: X, A: X in each day cell
- OT badges on days with overtime

## Next Steps

If data still doesn't appear:
1. Run the test script and share the output
2. Check backend logs and share the debug output
3. Verify attendance records exist for the month you're viewing
4. Check that status values match exactly


