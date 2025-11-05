const bcrypt = require('bcrypt');

async function generateOperatorSQL() {
  try {
    console.log('Generating SQL for operator user...\n');
    
    // Hash the password 'ops123$'
    const hashedPassword = await bcrypt.hash('ops123$', 10);
    
    // Generate SQL statement
    const sql = `
-- Create operator user
INSERT INTO users (username, password, role) 
VALUES ('operator', '${hashedPassword}', 'operator') 
ON CONFLICT (username) 
DO UPDATE SET password = '${hashedPassword}', role = 'operator';
`;
    
    console.log('✅ SQL Generated! Copy and run this in your PostgreSQL database:\n');
    console.log('==========================================');
    console.log(sql);
    console.log('==========================================\n');
    
    console.log('Operator Login Credentials:');
    console.log('  Username: operator');
    console.log('  Password: ops123$\n');
    
    console.log('How to run this SQL:');
    console.log('  1. Open pgAdmin or psql');
    console.log('  2. Connect to "face_recognition_attendance" database');
    console.log('  3. Run the SQL statement above');
    console.log('  4. Restart your backend server');
    console.log('  5. Login with operator credentials');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateOperatorSQL();

