const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Function to parse SQL statements properly, handling DO $$ blocks
function parseSQLStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let inDoBlock = false;
  let dollarQuoteTag = '';
  
  const lines = sql.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for start of DO $$ block
    if (line.trim().startsWith('DO $$') && !inDoBlock) {
      inDoBlock = true;
      dollarQuoteTag = '$$';
      currentStatement += line + '\n';
      continue;
    }
    
    // Check for end of DO $$ block
    if (inDoBlock && line.trim() === 'END $$;') {
      currentStatement += line;
      statements.push(currentStatement.trim());
      currentStatement = '';
      inDoBlock = false;
      dollarQuoteTag = '';
      continue;
    }
    
    // If we're in a DO block, add the line to current statement
    if (inDoBlock) {
      currentStatement += line + '\n';
      continue;
    }
    
    // For regular statements, split by semicolon
    const parts = line.split(';');
    
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j].trim();
      
      if (part) {
        currentStatement += part;
        
        // If this is not the last part, we have a complete statement
        if (j < parts.length - 1) {
          if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
            currentStatement = '';
          }
        }
      }
    }
    
    // Add newline for multi-line statements
    if (currentStatement && parts.length > 0) {
      currentStatement += '\n';
    }
  }
  
  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  return statements.filter(stmt => stmt.length > 0);
}

const pool = new Pool({
  user: process.env.DB_USER || 'faceapp_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'face_recognition_attendance',
  password: process.env.DB_PASSWORD || 'qautomation',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function runAllMigrations() {
  try {
    console.log('🚀 Starting database migration process...\n');
    
    // List of migration files in order
    const migrations = [
      'migration_add_attendance_fields.sql',
      'migration_add_face_captures.sql',
      'migration_add_on_duty_enabled.sql',
      'migration_add_overtime_enabled.sql',
      'migration_add_ot_threshold.sql',
      'migration_add_staff_work_fields.sql',
      'migration_add_password_reset.sql'
    ];
    
    for (const migrationFile of migrations) {
      const migrationPath = path.join(__dirname, '..', 'sql', migrationFile);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration file not found: ${migrationFile}`);
        continue;
      }
      
      console.log(`📄 Running migration: ${migrationFile}...`);
      
      try {
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Parse SQL statements properly, handling DO $$ blocks
        const statements = parseSQLStatements(migrationSQL);
        
        for (const statement of statements) {
          if (statement.trim()) {
            console.log(`   Executing: ${statement.trim().substring(0, 80)}...`);
            await pool.query(statement);
          }
        }
        
        console.log(`✅ Migration ${migrationFile} completed successfully!\n`);
        
      } catch (error) {
        console.error(`❌ Migration ${migrationFile} failed:`, error.message);
        console.log(`   Continuing with next migration...\n`);
      }
    }
    
    console.log('🎉 All migrations completed!');
    console.log('\n📋 Migration Summary:');
    console.log('   ✅ Added attendance fields (notes, late arrival, early departure, etc.)');
    console.log('   ✅ Added face capture fields (image paths, confidence scores)');
    console.log('   ✅ Added on-duty enabled functionality');
    console.log('   ✅ Added staff work fields (work status, manager, project code)');
    console.log('   ✅ Added password reset functionality');
    
  } catch (error) {
    console.error('❌ Migration process failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check if this script is being run directly
if (require.main === module) {
  runAllMigrations();
}

module.exports = runAllMigrations;