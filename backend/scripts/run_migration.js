const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'faceapp_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'face_recognition_attendance',
  password: process.env.DB_PASSWORD || 'qautomation',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function runMigration() {
  try {
    console.log('Running migration: Add face capture fields to attendance table...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'sql', 'migration_add_face_captures.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.trim().substring(0, 100)}...`);
        await pool.query(statement);
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('Added columns to attendance table:');
    console.log('  - check_in_face_image_path');
    console.log('  - check_out_face_image_path');
    console.log('  - check_in_confidence_score');
    console.log('  - check_out_confidence_score');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
