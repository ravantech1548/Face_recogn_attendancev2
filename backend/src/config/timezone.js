require('dotenv').config();

/**
 * Timezone Configuration
 * Reads timezone from .env file or defaults to Asia/Singapore
 */
const getTimezone = () => {
  // Priority: DB_TIMEZONE env var > TZ env var > default to Singapore
  return process.env.DB_TIMEZONE || process.env.TZ || 'Asia/Singapore';
};

/**
 * Get timezone for database queries
 */
const getDBTimezone = () => {
  return getTimezone();
};

/**
 * Get timezone for JavaScript Date operations
 */
const getJSTimezone = () => {
  return getTimezone();
};

/**
 * Format date/time with configured timezone
 */
const formatDateTime = (date = new Date()) => {
  const timezone = getJSTimezone();
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

/**
 * Get current date in configured timezone
 */
const getCurrentDate = () => {
  const timezone = getJSTimezone();
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: timezone }));
};

/**
 * Get current timestamp string for logging
 */
const getTimestamp = () => {
  return formatDateTime();
};

module.exports = {
  getTimezone,
  getDBTimezone,
  getJSTimezone,
  formatDateTime,
  getCurrentDate,
  getTimestamp
};


