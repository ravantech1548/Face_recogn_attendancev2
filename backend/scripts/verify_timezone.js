require('dotenv').config();
const { Pool } = require('pg');
const { getDBTimezone } = require('../src/config/timezone');

const pool = new Pool({
  user: process.env.DB_USER || 'faceapp_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'face_recognition_attendance',
  password: process.env.DB_PASSWORD || 'qautomation',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function verifyTimezone() {
  try {
    // Get timezone from .env configuration
    const timezone = getDBTimezone();
    
    // Escape single quotes in timezone name for safety
    const escapedTimezone = timezone.replace(/'/g, "''");
    
    // Set timezone (SET command doesn't support parameterized queries)
    await pool.query(`SET timezone = '${escapedTimezone}'`);
    
    // Get timezone information
    const result = await pool.query(`
      SELECT 
        current_setting('timezone') as current_timezone,
        NOW() as database_now,
        NOW() AT TIME ZONE current_setting('timezone') as local_now,
        CURRENT_DATE as current_date,
        CURRENT_TIME as current_time,
        CURRENT_TIMESTAMP as current_timestamp,
        (NOW() AT TIME ZONE current_setting('timezone'))::text as local_timestamp_text
    `);
    
    const row = result.rows[0];
    
    console.log('=== Timezone Verification ===\n');
    console.log('Database Timezone Setting:', row.current_timezone);
    console.log('Database NOW():', row.database_now);
    console.log('Local NOW():', row.local_now);
    console.log('Current Date:', row.current_date);
    console.log('Current Time:', row.current_time);
    console.log('Current Timestamp:', row.current_timestamp);
    console.log('Local Timestamp (text):', row.local_timestamp_text);
    
    console.log('\n=== System Time ===');
    const systemTime = new Date();
    console.log('System Date/Time:', systemTime.toLocaleString());
    console.log('System Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('System UTC Offset:', -systemTime.getTimezoneOffset() / 60, 'hours');
    
    console.log('\n=== Comparison ===');
    const dbTime = new Date(row.local_now);
    const timeDiff = Math.abs(systemTime - dbTime);
    console.log('Time Difference:', timeDiff, 'ms');
    
    if (timeDiff < 5000) {
      console.log('✅ Database timezone matches system timezone!');
    } else {
      console.log('⚠️  Database timezone may not match system timezone');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyTimezone();

