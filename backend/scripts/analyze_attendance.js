const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'faceapp_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'face_recognition_attendance',
  password: process.env.DB_PASSWORD || 'qautomation',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function analyzeAttendance() {
  try {
    console.log('Analyzing attendance records for Senthilkumar SS (1013)...\n');
    
    // Get all records for this staff member
    const records = await pool.query(`
      SELECT attendance_id, staff_id, date, check_in_time, check_out_time, 
             EXTRACT(EPOCH FROM (check_out_time - check_in_time)) as time_diff_seconds,
             EXTRACT(HOUR FROM check_in_time) as check_in_hour,
             EXTRACT(HOUR FROM check_out_time) as check_out_hour,
             DATE(check_in_time) as check_in_date,
             DATE(check_out_time) as check_out_date
      FROM attendance 
      WHERE staff_id = '1013'
      ORDER BY date DESC, attendance_id DESC
      LIMIT 10
    `);
    
    console.log(`Found ${records.rows.length} records for staff 1013:\n`);
    
    for (const record of records.rows) {
      const timeDiffHours = Math.round(record.time_diff_seconds / 3600 * 100) / 100;
      const isOvernight = record.check_in_date !== record.check_out_date;
      
      console.log(`Record ID: ${record.attendance_id}`);
      console.log(`  Date: ${record.date}`);
      console.log(`  Check-in: ${record.check_in_time} (Hour: ${record.check_in_hour}, Date: ${record.check_in_date})`);
      console.log(`  Check-out: ${record.check_out_time} (Hour: ${record.check_out_hour}, Date: ${record.check_out_date})`);
      console.log(`  Time difference: ${timeDiffHours} hours`);
      console.log(`  Is overnight shift: ${isOvernight}`);
      console.log(`  Status: ${timeDiffHours < 0 ? 'INVALID (check-out before check-in)' : 'VALID'}`);
      console.log('---');
    }
    
    // Check for potential issues
    const invalidRecords = records.rows.filter(r => r.time_diff_seconds < 0);
    if (invalidRecords.length > 0) {
      console.log(`\n⚠️  Found ${invalidRecords.length} invalid records where check-out is before check-in!`);
    } else {
      console.log(`\n✅ All records appear to have valid time sequences.`);
    }
    
  } catch (error) {
    console.error('Error analyzing attendance:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
analyzeAttendance();
