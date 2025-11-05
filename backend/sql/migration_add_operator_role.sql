-- Migration: Add operator role and create operator user
-- This creates an operator user who only has access to face attendance module

-- Create operator user with hashed password for 'ops123$'
-- Password hash generated using bcrypt with 10 rounds
INSERT INTO users (username, password, role) 
VALUES (
    'operator', 
    '$2b$10$YourHashedPasswordWillBeHere',  -- This will be replaced by the init script
    'operator'
) 
ON CONFLICT (username) DO NOTHING;

-- Note: The actual password hash will be generated properly by the initialization script
-- Password: ops123$
-- Role: operator

