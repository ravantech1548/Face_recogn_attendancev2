const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function initDb() {
  const schemaPath = path.join(__dirname, '../../sql/schema.sql');
  try {
    if (!fs.existsSync(schemaPath)) {
      console.warn('[initDb] Schema file not found:', schemaPath);
      return;
    }
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    // Ensure users.staff_id column exists and FK
    await pool.query(
      "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS staff_id VARCHAR(20)"
    );
    await pool.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_staff_id_fkey') THEN ALTER TABLE users ADD CONSTRAINT users_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(staff_id); END IF; END $$;"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id)"
    );
    
    // Add password reset functionality
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT"
    );
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)"
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id UUID PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id) WHERE is_active"
    );
    
    console.log('[initDb] Database schema ensured');
  } catch (error) {
    console.error('[initDb] Failed to apply schema:', error.message);
  }
}

module.exports = initDb;


