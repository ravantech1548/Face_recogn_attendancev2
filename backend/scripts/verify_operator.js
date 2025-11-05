const pool = require('../src/config/database');

async function verifyOperator() {
  try {
    console.log('Checking operator user in database...\n');
    
    const result = await pool.query(
      'SELECT user_id, username, role, created_at FROM users WHERE username = $1',
      ['operator']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Operator user NOT FOUND in database!');
      console.log('Please run the SQL to create operator user.');
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log('✅ Operator user found in database:');
    console.log('   User ID:', user.user_id);
    console.log('   Username:', user.username);
    console.log('   Role:', user.role);
    console.log('   Created:', user.created_at);
    
    if (user.role !== 'operator') {
      console.log('\n⚠️  WARNING: Role is not "operator"!');
      console.log('   Expected: operator');
      console.log('   Found:', user.role);
    } else {
      console.log('\n✅ Role is correct!');
    }
    
    console.log('\nLogin credentials:');
    console.log('   Username: operator');
    console.log('   Password: ops123$');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyOperator();

