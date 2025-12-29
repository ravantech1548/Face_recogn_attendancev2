# Environment Variable Timezone Configuration

## Overview

All timestamps and date/time operations now use the timezone configured in the `.env` file. The default timezone is set to **Asia/Singapore**.

## Configuration

### 1. Create/Update `.env` File

Create a `.env` file in the `backend` directory with the following configuration:

```env
# Database Configuration
DB_USER=faceapp_user
DB_HOST=127.0.0.1
DB_NAME=face_recognition_attendance
DB_PASSWORD=qautomation
DB_PORT=5432

# Timezone Configuration
# Set to your local timezone (e.g., Asia/Singapore, America/New_York, Europe/London)
# Default: Asia/Singapore
DB_TIMEZONE=Asia/Singapore

# Server Configuration
PORT=5000

# JWT Secret
JWT_SECRET=your-secret-key
```

### 2. Available Timezones

Common timezone values you can use:

- `Asia/Singapore` (UTC+8) - Default
- `Asia/Kolkata` (UTC+5:30)
- `Asia/Tokyo` (UTC+9)
- `Asia/Bangkok` (UTC+7)
- `America/New_York` (UTC-5)
- `America/Los_Angeles` (UTC-8)
- `Europe/London` (UTC+0)
- `Europe/Paris` (UTC+1)
- `UTC` (UTC+0)

For a complete list, see: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

## How It Works

### 1. Centralized Configuration

All timezone access goes through `backend/src/config/timezone.js`:

```javascript
const { getDBTimezone, formatDateTime, getTimestamp } = require('../config/timezone');

// Get timezone for database queries
const timezone = getDBTimezone(); // Returns 'Asia/Singapore' from .env

// Format date/time with configured timezone
const timestamp = formatDateTime(); // Returns formatted date/time in Singapore timezone
```

### 2. Database Queries

All database queries that use `NOW()` or timestamps now use the timezone from `.env`:

```javascript
// Before (hardcoded)
await pool.query(`SELECT NOW() AT TIME ZONE current_setting('timezone')`);

// After (from .env)
const timezone = getDBTimezone();
await pool.query(`SELECT NOW() AT TIME ZONE $1`, [timezone]);
```

### 3. Logging

All console logs use the timezone from `.env`:

```javascript
// All logs automatically use Singapore timezone
console.log('Server started'); // [12/28/2025, 10:30:45] Server started
```

### 4. Date Calculations

All date calculations (current month, last month, etc.) use the timezone from `.env`:

```javascript
// Month calculations use Singapore timezone
const monthQuery = await pool.query(`
  SELECT DATE_TRUNC('month', (NOW() AT TIME ZONE $1))::date as first_day
`, [getDBTimezone()]);
```

## Files Updated

### Configuration Files
- ✅ `backend/src/config/timezone.js` - Centralized timezone configuration
- ✅ `backend/src/config/database.js` - Uses timezone from .env
- ✅ `backend/server.js` - Logging uses timezone from .env

### Route Files
- ✅ `backend/src/routes/attendance.js` - All date/time queries use .env timezone
- ✅ `backend/src/routes/settings.js` - Timestamp updates use .env timezone
- ✅ `backend/src/routes/calendar.js` - Timestamp updates use .env timezone
- ✅ `backend/src/routes/staff.js` - Timestamp updates use .env timezone

### Setup Files
- ✅ `backend/src/setup/initDb.js` - Database initialization uses .env timezone

### Scripts
- ✅ `backend/scripts/run_all_migration.js` - Migration script uses .env timezone
- ✅ `backend/scripts/verify_timezone.js` - Verification script uses .env timezone

## Usage Examples

### Getting Current Time in Configured Timezone

```javascript
const { getDBTimezone, formatDateTime, getCurrentDate } = require('../config/timezone');

// Get timezone name
const tz = getDBTimezone(); // 'Asia/Singapore'

// Get formatted date/time string
const timestamp = formatDateTime(); // '12/28/2025, 10:30:45'

// Get Date object in configured timezone
const currentDate = getCurrentDate();
```

### Database Query with Timezone

```javascript
const { getDBTimezone } = require('../config/timezone');
const timezone = getDBTimezone();

// Query using timezone from .env
const result = await pool.query(`
  SELECT NOW() AT TIME ZONE $1 AS local_time
`, [timezone]);
```

## Verification

To verify the timezone is set correctly:

```bash
cd backend
node scripts/verify_timezone.js
```

This will show:
- Current timezone from .env
- Database timezone setting
- System time vs Database time
- Any time differences

## Changing Timezone

To change the timezone:

1. **Edit `.env` file:**
   ```env
   DB_TIMEZONE=America/New_York
   ```

2. **Restart the backend server:**
   ```bash
   # Stop the server (Ctrl+C)
   # Start again
   npm start
   ```

3. **Verify the change:**
   ```bash
   node scripts/verify_timezone.js
   ```

## Benefits

✅ **Centralized Configuration** - All timezone settings in one place (`.env`)  
✅ **Easy to Change** - Just update `.env` and restart  
✅ **Consistent** - All parts of the application use the same timezone  
✅ **No Hardcoding** - No timezone values hardcoded in the code  
✅ **Environment-Specific** - Different timezones for dev/staging/production  

## Notes

- The timezone is set per database connection automatically
- All new records will use the timezone from `.env`
- Existing records keep their original timestamps
- The timezone setting applies to:
  - Database queries (`NOW()`, `CURRENT_DATE`, `CURRENT_TIMESTAMP`)
  - Application logging
  - Date calculations
  - Attendance timestamps


