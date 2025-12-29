# Debug Detailed Summary Export

This guide helps you debug the "Failed to export detailed summary" error.

## Test Scripts

### 1. Database Test Script (`debug_detailed_summary.js`)

This script tests the database queries and Excel generation logic directly, without going through the HTTP API.

**Usage:**
```bash
cd backend
node scripts/debug_detailed_summary.js
```

**What it does:**
- Tests all database queries (staff, calendar, attendance)
- Processes the data the same way as the endpoint
- Generates an Excel file locally
- Shows detailed error messages at each step

**Expected output:**
- ✅ Success messages for each step
- Generated Excel file: `detailed_summary_test_2025_12.xlsx`
- If errors occur, it will show exactly which step failed

### 2. API Test Script (`test_detailed_summary_api.js`)

This script tests the actual HTTP endpoint to see what error the server returns.

**Setup:**
1. Get your authentication token from the browser:
   - Open browser DevTools (F12)
   - Go to Application/Storage → Local Storage
   - Find the `token` value
   - Copy it

2. Set the token as environment variable:
   ```bash
   # Windows PowerShell
   $env:TEST_TOKEN="your_token_here"
   
   # Windows CMD
   set TEST_TOKEN=your_token_here
   
   # Linux/Mac
   export TEST_TOKEN="your_token_here"
   ```

   Or edit the script and set `TOKEN` directly (not recommended for production).

**Usage:**
```bash
cd backend
node scripts/test_detailed_summary_api.js
```

**What it does:**
- Makes an HTTP request to the detailed summary endpoint
- Tests both Excel and JSON formats
- Shows the exact error response from the server
- Identifies which step failed (if error tracking is working)

### 3. Check Server Logs

The endpoint now has detailed error logging. Check your server console/logs for:

```
=== Detailed Summary Error ===
Error step: [step_name]
Error message: [error message]
Error stack: [stack trace]
```

Common error steps:
- `initialization` - Request parsing
- `date_calculation` - Date range calculation
- `user_authorization` - User/staff ID lookup
- `table_check` - Calendar table existence check
- `fetch_staff` - Staff query execution
- `fetch_calendar` - Calendar data query
- `fetch_attendance` - Attendance records query
- `process_staff` - Data processing
- `prepare_export` - Export data preparation
- `export_format_check` - Format validation
- Excel/CSV generation errors

## Common Issues and Fixes

### Issue 1: "Calendar table not found"
**Fix:** Run database migrations
```bash
cd backend
node scripts/run_all_migration.js
```

### Issue 2: "Failed to fetch staff"
**Possible causes:**
- Database connection issue
- Invalid staff filter parameter
- SQL syntax error

**Check:**
- Database is running
- `.env` file has correct DB credentials
- Run `debug_detailed_summary.js` to see exact SQL error

### Issue 3: Excel generation fails
**Possible causes:**
- Invalid data types in export data
- Missing required fields
- XLSX library issue

**Check:**
- Run `debug_detailed_summary.js` - it will show the exact data structure
- Check if all day columns (1-31) are present
- Verify no null/undefined values in export data

### Issue 4: Parameter mismatch
**Fix:** Already fixed in the code - staff query now uses `$1` instead of `$3`

## Debugging Steps

1. **Run the database test script first:**
   ```bash
   node scripts/debug_detailed_summary.js
   ```
   This will tell you if the issue is with:
   - Database queries
   - Data processing logic
   - Excel generation

2. **If database test passes, run the API test:**
   ```bash
   node scripts/test_detailed_summary_api.js
   ```
   This will tell you if the issue is with:
   - Authentication
   - HTTP request/response
   - Server-side error handling

3. **Check server logs:**
   - Look for the error step name
   - Check the full error message and stack trace
   - Verify the error step matches what you see in the test scripts

4. **Compare with working export:**
   - Try exporting a different month
   - Try exporting with JSON format first (format=json)
   - Check if the issue is specific to certain data

## Getting Help

When reporting the issue, provide:
1. Output from `debug_detailed_summary.js`
2. Output from `test_detailed_summary_api.js` (if possible)
3. Server log error message with the error step
4. Month/year you're trying to export
5. Any staff filter being used

