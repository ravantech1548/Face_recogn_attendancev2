require('dotenv').config();
const { Pool } = require('pg');
const { getDBTimezone } = require('./timezone');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'face_recognition_attendance',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

// Set timezone on each new connection using timezone from .env
pool.on('connect', async (client) => {
  try {
    // Get timezone from .env configuration
    const timezone = getDBTimezone();
    // Set timezone for this connection (SET command doesn't support parameterized queries)
    // Escape single quotes in timezone name for safety
    const escapedTimezone = timezone.replace(/'/g, "''");
    await client.query(`SET timezone = '${escapedTimezone}'`);
    console.log(`[Database] Timezone set to: ${timezone} (from .env)`);
  } catch (error) {
    console.error('[Database] Error setting timezone:', error.message);
    // Fallback to UTC if timezone setting fails
    try {
      await client.query(`SET timezone = 'UTC'`);
      console.log('[Database] Using fallback timezone: UTC');
    } catch (fallbackError) {
      console.error('[Database] Failed to set fallback timezone:', fallbackError.message);
    }
  }
});

module.exports = pool;


