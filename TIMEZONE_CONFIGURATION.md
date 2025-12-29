# Timezone Configuration Guide

## Overview

All timestamps in the database and logs now use the **local system timezone** instead of UTC. This ensures that:
- All attendance records use local time
- All logs show local timestamps
- Date calculations use local dates
- No timezone conversion issues

## Configuration

### 1. Database Timezone

The database connection automatically sets the timezone to 'local' for each connection. This means:
- `NOW()` returns local time
- `CURRENT_DATE` returns local date
- `CURRENT_TIMESTAMP` returns local timestamp
- All timestamp columns use local time

### 2. Application Logs

All console logs now include local timestamps in the format:
```
[MM/DD/YYYY, HH:MM:SS] [LEVEL] Message
```

### 3. Timestamp Queries

All queries that use `NOW()` or `CURRENT_TIMESTAMP` have been updated to explicitly use local timezone:
```sql
NOW() AT TIME ZONE current_setting('timezone')
```

## Verification

To verify the timezone is set correctly, run:

```bash
cd backend
node scripts/verify_timezone.js
```

This will show:
- Current database timezone setting
- Database time vs System time
- Any time differences

## Migration

The timezone migration is automatically run when you execute:

```bash
cd backend
node scripts/run_all_migration.js
```

This will:
1. Set the database timezone to 'local'
2. Set session timezone for all connections
3. Verify the timezone is working

## Manual Timezone Setting

If you need to set a specific timezone (instead of 'local'), you can:

1. **Set environment variable:**
   ```bash
   export DB_TIMEZONE='Asia/Singapore'
   ```

2. **Or modify the database directly:**
   ```sql
   ALTER DATABASE face_recognition_attendance SET timezone = 'Asia/Singapore';
   ```

Common timezones:
- `'Asia/Singapore'` (UTC+8)
- `'Asia/Kolkata'` (UTC+5:30)
- `'America/New_York'` (UTC-5)
- `'Europe/London'` (UTC+0)
- `'local'` (uses system timezone)

## What Changed

### Database Queries
- All `NOW()` calls now use local timezone
- All `CURRENT_TIMESTAMP` uses local timezone
- All `CURRENT_DATE` uses local date

### Logging
- Console.log includes local timestamps
- Console.error includes local timestamps
- Console.warn includes local timestamps

### Files Updated
- `backend/src/config/database.js` - Sets timezone on connection
- `backend/src/setup/initDb.js` - Sets timezone on initialization
- `backend/server.js` - Custom logging with timestamps
- `backend/src/routes/attendance.js` - Updated timestamp queries
- `backend/src/routes/settings.js` - Updated timestamp queries
- `backend/src/routes/calendar.js` - Updated timestamp queries
- `backend/src/routes/staff.js` - Updated timestamp queries

## Testing

After configuration, test with:

1. **Create an attendance record** - Check that the timestamp matches your local time
2. **Check logs** - Verify timestamps are in local time
3. **Query database** - Run `SELECT NOW(), CURRENT_DATE;` and verify it matches system time

## Troubleshooting

### Issue: Times still showing in UTC

**Solution:**
1. Restart the backend server
2. Run the timezone migration: `node scripts/run_all_migration.js`
3. Verify with: `node scripts/verify_timezone.js`

### Issue: Database timezone setting fails

**Solution:**
- The session timezone will still be set (which is sufficient)
- Database-level timezone requires superuser privileges
- Session timezone is enough for all operations

### Issue: Logs show wrong timezone

**Solution:**
- Restart the backend server
- The logging override happens at server startup
- Check that `server.js` is using the updated logging code

## Notes

- The timezone is set per-connection, so each new database connection automatically uses local timezone
- Existing records in the database are not affected (they keep their original timestamps)
- New records will use local timezone
- The `'local'` timezone setting uses the PostgreSQL server's system timezone, which should match your application server's timezone


