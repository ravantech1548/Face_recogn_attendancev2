const bcrypt = require('bcrypt');
const pool = require('../src/config/database');

async function createOperatorUser() {
  try {
    console.log('Creating operator user...');
    
    // Hash the password 'ops123$'
    const hashedPassword = await bcrypt.hash('ops123$', 10);
    
    // Insert the operator user
    const result = await pool.query(
      `INSERT INTO users (username, password, role) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (username) 
       DO UPDATE SET password = $2, role = $3
       RETURNING user_id, username, role`,
      ['operator', hashedPassword, 'operator']
    );
    
    console.log('✅ Operator user created successfully:');
    console.log('   Username:', result.rows[0].username);
    console.log('   Role:', result.rows[0].role);
    console.log('   Password: ops123$');
    console.log('\nYou can now login with:');
    console.log('   Username: operator');
    console.log('   Password: ops123$');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating operator user:', error);
    process.exit(1);
  }
}

createOperatorUser();

