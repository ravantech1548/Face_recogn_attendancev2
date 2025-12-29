# Overtime Enabled Not Showing in Attendance Report - Troubleshooting Guide

## Issue
The `overtime_enabled` field is not appearing in the attendance report table.

## Solution Steps

### Step 1: Verify Database Column Exists

Run the migration if you haven't already:

```bash
cd backend
node scripts/run_all_migration.js
```

Or check if the column exists using this SQL query:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'staff' AND column_name = 'overtime_enabled';
```

If the column doesn't exist, run the migration script above.

### Step 2: Restart Backend Server

**IMPORTANT**: After making code changes, you MUST restart the backend server for changes to take effect.

**Windows:**
```powershell
# Stop the backend (if running)
# Then restart:
cd backend
npm start
```

**Or use the service manager:**
```powershell
python run_service_manager.py
```

### Step 3: Clear Browser Cache

1. Hard refresh the browser:
   - **Windows**: `Ctrl + Shift + R` or `Ctrl + F5`
   - **Mac**: `Cmd + Shift + R`

2. Or clear browser cache completely:
   - Open Developer Tools (F12)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"

### Step 4: Verify Backend is Returning Data

Check the backend console logs when loading the attendance report. You should see debug output like:

```
Sample attendance record (first row): {
  staff_id: '...',
  full_name: '...',
  overtime_enabled: true/false,
  has_overtime_enabled: true
}
```

If `has_overtime_enabled` is `false`, the column might not exist in the database or the query isn't selecting it correctly.

### Step 5: Check Browser Console

Open browser Developer Tools (F12) and check:
1. **Console tab** - Look for any JavaScript errors
2. **Network tab** - Check the `/api/attendance` request response
   - Click on the request
   - Check the "Response" tab
   - Verify that `overtime_enabled` field exists in the JSON response

### Step 6: Verify Staff Records Have overtime_enabled Set

Check if staff records actually have the `overtime_enabled` value set:

```sql
SELECT staff_id, full_name, overtime_enabled 
FROM staff 
LIMIT 10;
```

If all values are `NULL` or `false`, you may need to update them in the Staff Management interface.

### Step 7: Update Staff Records

1. Go to Staff Management
2. Edit a staff member
3. Toggle "Overtime Enabled" switch
4. Save the changes
5. Check the attendance report again

## Verification Checklist

- [ ] Database migration has been run (`migration_add_overtime_enabled.sql`)
- [ ] Backend server has been restarted after code changes
- [ ] Browser cache has been cleared
- [ ] Backend console shows `overtime_enabled` in debug logs
- [ ] Browser Network tab shows `overtime_enabled` in API response
- [ ] Staff records have `overtime_enabled` values set (not all NULL/false)
- [ ] Frontend code is displaying the field (check browser console for errors)

## Code Changes Made

### Backend (`backend/src/routes/attendance.js`)
- Added `s.overtime_enabled` to the SELECT query (line 326)
- Added `s.overtime_enabled` to export query (line 520)
- Added "Overtime Enabled" to export mappings (lines 639, 774)
- Added debug logging to verify data is returned

### Frontend (`frontend/src/components/AttendanceReport.jsx`)
- Added "Overtime Enabled" column header (after "WFH" column)
- Added table cell with Chip component to display Yes/No
- Updated colSpan from 17 to 18 for loading/empty states
- Added null/undefined handling for the field

## Still Not Working?

If the issue persists after following all steps:

1. **Check Database Connection**: Verify the backend can connect to the database
2. **Check Server Logs**: Look for any error messages in the backend console
3. **Verify Column Data Type**: Ensure the column is BOOLEAN type in the database
4. **Check SQL Query**: Manually run the attendance query to see if `overtime_enabled` is returned

## Quick Test

To quickly test if the field is working:

1. Restart backend server
2. Open browser DevTools (F12)
3. Go to Network tab
4. Load attendance report page
5. Find the `/api/attendance` request
6. Check Response - you should see `overtime_enabled: true/false` in each record

If you see the field in the API response but not in the UI, it's a frontend rendering issue.
If you don't see the field in the API response, it's a backend/database issue.

