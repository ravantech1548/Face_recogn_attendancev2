const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'faceapp_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'face_recognition_attendance',
  password: process.env.DB_PASSWORD || 'qautomation',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function fixAttendanceTimes() {
  try {
    console.log('Checking for attendance records with invalid time sequences...');
    
    // Find records where check_out_time is before check_in_time
    const problematicRecords = await pool.query(`
      SELECT attendance_id, staff_id, date, check_in_time, check_out_time, 
             EXTRACT(EPOCH FROM (check_out_time - check_in_time)) as time_diff_seconds
      FROM attendance 
      WHERE check_in_time IS NOT NULL 
        AND check_out_time IS NOT NULL 
        AND check_out_time < check_in_time
      ORDER BY date DESC, staff_id
    `);
    
    console.log(`Found ${problematicRecords.rows.length} problematic records:`);
    
    for (const record of problematicRecords.rows) {
      console.log(`\nStaff ID: ${record.staff_id}, Date: ${record.date}`);
      console.log(`  Check-in: ${record.check_in_time}`);
      console.log(`  Check-out: ${record.check_out_time}`);
      console.log(`  Time difference: ${Math.round(record.time_diff_seconds)} seconds`);
      
      // Ask for confirmation before fixing
      // For now, just log the issue - manual review recommended
    }
    
    if (problematicRecords.rows.length === 0) {
      console.log('No problematic records found. All attendance times are valid.');
    }
    
  } catch (error) {
    console.error('Error checking attendance times:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
fixAttendanceTimes();
