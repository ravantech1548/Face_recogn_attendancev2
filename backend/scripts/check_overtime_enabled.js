const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'faceapp_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'face_recognition_attendance',
  password: process.env.DB_PASSWORD || 'qautomation',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function checkColumn() {
  try {
    // Check if column exists
    const columnCheck = await pool.query(
      `SELECT column_name, data_type, column_default 
       FROM information_schema.columns 
       WHERE table_name = 'staff' AND column_name = 'overtime_enabled'`
    );
    
    if (columnCheck.rows.length === 0) {
      console.log('❌ Column overtime_enabled does NOT exist in staff table');
      console.log('   Please run the migration: node scripts/run_all_migration.js');
      return;
    }
    
    console.log('✅ Column overtime_enabled EXISTS in staff table');
    console.log('   Details:', columnCheck.rows[0]);
    
    // Check sample data
    const sampleData = await pool.query(
      `SELECT staff_id, full_name, overtime_enabled FROM staff LIMIT 5`
    );
    
    console.log('\n📊 Sample staff data:');
    sampleData.rows.forEach(row => {
      console.log(`   ${row.staff_id} - ${row.full_name}: overtime_enabled = ${row.overtime_enabled}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumn();

