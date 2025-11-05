# Operator Role - Quick Start Guide

## What is the Operator Role?

A limited-access user who can **ONLY** use the Face Attendance module. Perfect for having a dedicated person running face recognition without giving them full admin access.

## Quick Setup (5 Minutes)

### Step 1: Create Operator User

```bash
cd backend
node scripts/create_operator_user.js
```

Expected output:
```
✅ Operator user created successfully:
   Username: operator
   Password: ops123$
```

### Step 2: Restart Backend

```bash
# Restart your backend server
cd backend
npm start
```

### Step 3: Login as Operator

1. Open your application
2. Login with:
   - **Username:** `operator`
   - **Password:** `ops123$`
3. You'll be taken directly to Face Attendance page

## What Operator Can Do

✅ **Face Attendance**
- Use webcam to recognize faces
- Upload images for recognition
- Mark attendance via face recognition

✅ **View Reports**
- See attendance records (read-only)
- Export reports to Excel/CSV

## What Operator CANNOT Do

❌ Add/Edit/Delete staff  
❌ Manual attendance entry (no backdating)  
❌ Access admin features  
❌ Change system settings  

## Login Credentials

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Admin | admin | (your admin password) | Full system access |
| Operator | operator | ops123$ | Face attendance only |

## Comparison: Admin vs Operator

### Admin View
```
Navbar: [Staff] [Face Attendance] [Attendance Report] [Logout (admin)]
Home page: Staff Management
Can: Everything
```

### Operator View
```
Navbar: [Face Attendance] [View Reports] [Logout (operator)]
Home page: Face Attendance (camera/upload)
Can: Only face recognition
```

## Common Tasks

### Task: Mark Attendance Using Face Recognition

**As Operator:**
1. Login with operator credentials
2. Already on Face Attendance page
3. Click "Start Camera" or "Upload Image"
4. Capture/Select face image
5. System recognizes staff and marks attendance
6. Done! ✅

### Task: View Today's Attendance

**As Operator:**
1. Click "View Reports" in navbar
2. Set filter to "Current Month" or custom dates
3. View attendance table
4. Can export to Excel if needed

### Task: Change Operator Password

**As Admin, run:**
```javascript
// backend/scripts/change_operator_password.js
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function changePassword() {
  const newPassword = 'YourNewSecurePassword123!';
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE users SET password = $1 WHERE username = $2',
    [hashedPassword, 'operator']
  );
  console.log('✅ Password changed!');
  process.exit(0);
}

changePassword();
```

Then run: `node scripts/change_operator_password.js`

## Troubleshooting

### "Invalid credentials" when logging in as operator

**Solution:**
```bash
# Verify operator user exists
psql -d face_recognition_attendance -c "SELECT username, role FROM users WHERE username='operator';"

# If not found, create it
node scripts/create_operator_user.js
```

### Operator sees admin features

**Solution:**
1. Logout and clear browser cookies
2. Check backend was restarted after changes
3. Re-login with operator credentials

### Face attendance not working for operator

**Solution:**
1. Check backend logs for errors
2. Verify camera permissions in browser
3. Test with admin account first
4. Check Python recognition service is running

## Security Best Practices

1. **Change default password immediately:**
   ```
   ops123$ → YourStrongPassword123!
   ```

2. **Use different passwords for each operator**

3. **Regularly review operator access logs**

4. **Disable operator accounts when not needed**

## Testing Your Setup

Run through this checklist:

**As Operator:**
- [ ] Can login with operator credentials
- [ ] Redirected to face attendance page
- [ ] Can use camera for face recognition
- [ ] Can mark attendance successfully
- [ ] Can view attendance reports
- [ ] CANNOT access staff management
- [ ] CANNOT see manual attendance actions
- [ ] Can logout successfully

**As Admin:**
- [ ] Still has full access to all features
- [ ] Can still use face attendance
- [ ] Can still manage staff

## Need More Features?

The operator role is intentionally limited. If you need more features:

1. **Option A:** Use admin account for those tasks
2. **Option B:** Modify permissions (requires code changes)
3. **Option C:** Create additional custom roles

See `OPERATOR_ROLE_SETUP.md` for detailed implementation guide.

## Quick Reference: API Endpoints

| Endpoint | Admin | Operator | Public |
|----------|-------|----------|--------|
| POST /api/attendance/face-event | ✅ | ✅ | ❌ |
| POST /api/attendance/check-in | ✅ | ❌ | ❌ |
| POST /api/attendance/check-out | ✅ | ❌ | ❌ |
| GET /api/attendance | ✅ | ✅ | ❌ |
| GET /api/attendance/export | ✅ | ✅ | ❌ |
| GET /api/staff | ✅ | ✅ | ❌ |
| POST /api/staff | ✅ | ❌ | ❌ |
| PUT /api/staff/:id | ✅ | ❌ | ❌ |
| DELETE /api/staff/:id | ✅ | ❌ | ❌ |

---

**Ready to use!** 🎉

Create your operator user and start using the face attendance module with limited-access login.

