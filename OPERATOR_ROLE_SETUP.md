# Operator Role Setup Guide

## Overview
This guide explains the new **Operator** role that provides limited access to only the Face Attendance module. This is perfect for having a dedicated operator who only handles face recognition attendance without access to other admin features.

## Operator vs Admin Access

### Admin Access (Full System)
- ✅ Staff Management (Add/Edit/Delete staff)
- ✅ Face Attendance Module
- ✅ Manual Attendance Entry (Check-in/Check-out with custom times)
- ✅ Attendance Reports & Export
- ✅ All system configurations

### Operator Access (Face Attendance Only)
- ✅ Face Attendance Module (Camera & Image Upload)
- ✅ View Attendance Reports (Read-only)
- ❌ NO Staff Management
- ❌ NO Manual Attendance Entry
- ❌ NO Staff Creation/Editing
- ❌ NO System Configuration

## Default Operator Credentials

```
Username: operator
Password: ops123$
```

⚠️ **Security Note:** Change this password after first login for production use!

## Setup Instructions

### Step 1: Create the Operator User

Run the setup script to create the operator user in the database:

```bash
# Navigate to backend directory
cd backend

# Run the operator user creation script
node scripts/create_operator_user.js
```

You should see:
```
✅ Operator user created successfully:
   Username: operator
   Role: operator
   Password: ops123$

You can now login with:
   Username: operator
   Password: ops123$
```

### Step 2: Restart Backend Server

Restart your backend server to load the new middleware:

```bash
# If running with npm
cd backend
npm start

# If using service manager
# Restart the backend service
```

### Step 3: Restart Frontend (if needed)

If your frontend is running, restart it:

```bash
cd frontend
npm run dev
```

### Step 4: Test Operator Login

1. Open your application in a browser
2. Click **Login**
3. Enter credentials:
   - Username: `operator`
   - Password: `ops123$`
4. Click **Login**

You should be redirected to the Face Attendance page with limited navigation options.

## What Operators Can Do

### 1. Face Attendance Recognition
- Access the Face Attendance module at `/attendance/face`
- Use webcam to capture and recognize faces
- Upload face images for recognition
- Record check-in/check-out via face recognition
- View liveness detection results (if enabled)

### 2. View Attendance Reports
- Access read-only attendance reports at `/attendance`
- View all attendance records
- Filter by date ranges
- View staff attendance details
- Export reports to Excel/CSV

### 3. View Staff List
- Can see staff information through attendance records
- Cannot add, edit, or delete staff members

## What Operators CANNOT Do

### ❌ Staff Management
- Cannot access `/staff` page
- Cannot add new staff members
- Cannot edit staff information
- Cannot delete staff members
- Cannot upload staff face images

### ❌ Manual Attendance Entry
- Cannot manually check-in staff
- Cannot manually check-out staff
- Cannot use custom date/time for backdating
- Cannot overwrite existing attendance records

### ❌ System Configuration
- Cannot change system settings
- Cannot manage other users
- Cannot access admin-only features

## Technical Implementation

### Backend Changes

#### 1. New Middleware: `requireAdminOrOperator.js`
- Allows both admin and operator roles to access certain routes
- Used for face attendance endpoint

#### 2. Updated Routes (`attendance.js`)
- `/api/attendance/face-event` - Now accessible by both admin and operator
- `/api/attendance/check-in` - Restricted to admin only
- `/api/attendance/check-out` - Restricted to admin only
- `/api/attendance` (GET) - Accessible by all authenticated users
- `/api/attendance/export` - Accessible by all authenticated users

### Frontend Changes

#### 1. New Component: `OperatorRoute.jsx`
- Route guard that allows both admin and operator roles
- Used for face attendance page

#### 2. Updated Components

**Navbar.jsx**
- Shows different navigation based on role
- Admin sees: Staff, Face Attendance, Attendance Report
- Operator sees: Face Attendance, View Reports
- Shows username in logout button

**HomeRedirect.jsx**
- Admin redirects to `/staff`
- Operator redirects to `/attendance/face`
- Other users redirect to `/attendance`

**App.jsx**
- Face attendance route now uses `OperatorRoute` instead of `AdminRoute`
- Allows both admin and operator access

**AttendanceReport.jsx**
- Manual attendance actions already restricted to admin role
- Operators see read-only view of reports

## User Management

### Adding More Operator Users

You can add more operator users by running SQL directly:

```sql
-- Replace 'ops2' with desired username
-- Password will be 'password123' (change as needed)
INSERT INTO users (username, password, role) 
VALUES (
    'ops2', 
    '$2b$10$[bcrypt-hashed-password]',  -- Use bcrypt to hash password
    'operator'
);
```

Or create a new script:

```javascript
// backend/scripts/create_custom_operator.js
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function createOperator(username, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (username, password, role) 
     VALUES ($1, $2, 'operator') 
     RETURNING user_id, username, role`,
    [username, hashedPassword]
  );
  console.log('✅ Operator created:', result.rows[0]);
  process.exit(0);
}

// Usage: node scripts/create_custom_operator.js
createOperator('ops2', 'newpassword123');
```

### Changing Operator Password

```javascript
// backend/scripts/change_operator_password.js
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function changePassword(username, newPassword) {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE users SET password = $1 WHERE username = $2',
    [hashedPassword, username]
  );
  console.log('✅ Password updated for:', username);
  process.exit(0);
}

// Usage: node scripts/change_operator_password.js
changePassword('operator', 'newSecurePassword123!');
```

### Deleting Operator User

```sql
DELETE FROM users WHERE username = 'operator' AND role = 'operator';
```

## Security Considerations

### 1. Change Default Password
The default password `ops123$` should be changed in production:
- Use a strong password with mix of characters
- Minimum 12 characters recommended
- Include uppercase, lowercase, numbers, and symbols

### 2. Audit Logging
Consider implementing audit logs for operator actions:
- Track when operators login
- Track which staff attendance they mark
- Track any errors or issues

### 3. Session Management
- Operators are logged out after session expires
- Same JWT security as admin users
- Tokens expire based on JWT_SECRET configuration

### 4. Limited Access Principle
Operators only have access to what they need:
- Cannot modify staff database
- Cannot manually create fake attendance
- Can only use face recognition for attendance

## Troubleshooting

### Operator Cannot Login
1. Verify user was created: `SELECT * FROM users WHERE username = 'operator';`
2. Check role is set correctly: Role should be `'operator'`
3. Verify password hash exists
4. Check backend logs for authentication errors

### Operator Redirected to Wrong Page
1. Clear browser cache and cookies
2. Check JWT token includes correct role
3. Verify HomeRedirect.jsx has operator redirect logic
4. Check backend server was restarted after changes

### Operator Can Access Admin Features
1. Verify backend middleware is in place
2. Check routes are using `requireAdmin` for admin-only features
3. Verify frontend route guards are correct
4. Clear browser cache and re-login

### Face Attendance Not Working for Operator
1. Check `/api/attendance/face-event` uses `requireAdminOrOperator` middleware
2. Verify backend was restarted
3. Check browser console for errors
4. Test with admin account to isolate issue

## Testing Checklist

### Operator Login Testing
- [ ] Can login with operator credentials
- [ ] Redirected to face attendance page after login
- [ ] Navbar shows only operator links
- [ ] Logout works correctly

### Operator Access Testing
- [ ] Can access `/attendance/face`
- [ ] Can use webcam for face recognition
- [ ] Can upload images for recognition
- [ ] Attendance records are created successfully
- [ ] Can view attendance reports at `/attendance`
- [ ] Can export attendance data

### Operator Restriction Testing
- [ ] Cannot access `/staff` (redirected)
- [ ] Cannot access `/staff/add` (redirected)
- [ ] Cannot see manual attendance actions section
- [ ] Cannot access admin-only API endpoints
- [ ] Staff management links not visible in navbar

### Admin Access Testing (Ensure admin still works)
- [ ] Admin can still access all features
- [ ] Admin can access face attendance
- [ ] Admin can manage staff
- [ ] Admin can do manual attendance entry

## Future Enhancements

Potential improvements for the operator role:

1. **Shift Management**
   - Operators assigned to specific shifts
   - Only work during assigned hours

2. **Location Restriction**
   - Operators tied to specific office locations
   - Can only mark attendance for their location

3. **Audit Trail**
   - Detailed logging of all operator actions
   - Reports showing operator activity

4. **Advanced Permissions**
   - Granular permission system
   - Custom role creation
   - Permission templates

5. **Operator Dashboard**
   - Daily attendance summary for operator
   - Quick stats and metrics
   - Pending actions queue

## Support

If you encounter issues or need help:

1. Check the troubleshooting section above
2. Review backend and frontend logs
3. Verify all files were updated correctly
4. Ensure database migrations ran successfully
5. Test with a fresh browser session

## Files Modified

### Backend
- `backend/src/middleware/requireAdminOrOperator.js` (NEW)
- `backend/src/routes/attendance.js` (UPDATED)
- `backend/scripts/create_operator_user.js` (NEW)
- `backend/sql/migration_add_operator_role.sql` (NEW)

### Frontend
- `frontend/src/components/OperatorRoute.jsx` (NEW)
- `frontend/src/components/Navbar.jsx` (UPDATED)
- `frontend/src/components/HomeRedirect.jsx` (UPDATED)
- `frontend/src/App.jsx` (UPDATED)

---

**Last Updated:** November 5, 2025
**Version:** 1.0
**Status:** Production Ready ✅

