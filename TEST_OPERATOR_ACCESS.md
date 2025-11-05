# Testing Operator Access - Troubleshooting Guide

## Most Common Errors & Solutions

### 1. "Cannot read properties of undefined" or "Staff list not loading"

**Error in console:**
```
GET https://localhost:5000/api/staff 403 (Forbidden)
```

**Cause:** Backend server wasn't restarted after adding middleware.

**Solution:**
1. Stop backend (Ctrl+C in the terminal where backend is running)
2. Restart: `npm start`
3. Refresh browser
4. Login again

---

### 2. "Face-event endpoint not found" or "404 Not Found"

**Error in console:**
```
POST https://localhost:5000/api/attendance/face-event 404 (Not Found)
```

**Cause:** The module.exports was in wrong place (we already fixed this).

**Solution:**
- Backend must be restarted
- File: `backend/src/routes/attendance.js` should have `module.exports = router;` at the END (line 814)

---

### 3. "Admin access required" or "403 Forbidden" on face-event

**Error in console:**
```
POST https://localhost:5000/api/attendance/face-event 403 (Forbidden)
Response: {"message": "Admin access required"}
```

**Cause:** The face-event endpoint is still using `requireAdmin` instead of `requireAdminOrOperator`.

**Solution:** Verify line 388 in `backend/src/routes/attendance.js` says:
```javascript
router.post('/face-event', [auth, requireAdminOrOperator, upload.single('faceImage'), body('staffId').notEmpty()], ...
```

NOT:
```javascript
router.post('/face-event', [auth, requireAdmin, upload.single('faceImage'), body('staffId').notEmpty()], ...
```

---

### 4. "Invalid token" or "No token provided"

**Error:** Redirected to login page immediately after logging in.

**Cause:** Token not being stored or sent properly.

**Solution:**
1. Clear browser cookies and cache
2. Try incognito/private window
3. Login again

---

### 5. Operator user doesn't exist

**Error:** "Invalid credentials" when trying to login.

**Cause:** The SQL to create operator user wasn't run yet.

**Solution:** Run this SQL in pgAdmin:

```sql
INSERT INTO users (username, password, role)
VALUES ('operator', '$2b$10$UrdyIN.Qln8XtcrBEH/.x.qFycx80TVd1u/jcDO3SlNxhIqhBw57S', 'operator')
ON CONFLICT (username)
DO UPDATE SET password = '$2b$10$UrdyIN.Qln8XtcrBEH/.x.qFycx80TVd1u/jcDO3SlNxhIqhBw57S', role = 'operator';
```

---

## Step-by-Step Debugging

### Check 1: Is Operator User Created?

Run in pgAdmin or psql:
```sql
SELECT username, role FROM users WHERE username = 'operator';
```

**Expected result:**
```
username  | role
----------|----------
operator  | operator
```

If empty, run the INSERT SQL above.

---

### Check 2: Can You Login?

1. Go to login page
2. Username: `operator`
3. Password: `ops123$`
4. Click Login

**Expected:** Redirect to Face Attendance page

**If fails:** Operator user doesn't exist - run the SQL.

---

### Check 3: Open Browser Console (F12)

After logging in as operator and going to Face Attendance:

1. Press `F12`
2. Go to **Console** tab
3. Look for errors

**Common errors you might see:**

#### Error A:
```
GET https://localhost:5000/api/staff 403
```
**Fix:** Backend needs restart

#### Error B:
```
POST https://localhost:5000/api/attendance/face-event 403
{"message": "Admin access required"}
```
**Fix:** Line 388 still has `requireAdmin`, needs to be `requireAdminOrOperator`

#### Error C:
```
Uncaught TypeError: Cannot read property 'map' of undefined
```
**Fix:** Staff list not loading - backend issue, restart needed

---

### Check 4: Test With Admin First

1. Logout
2. Login as **admin**
3. Go to Face Attendance
4. Does it work?

**If YES:** The problem is operator-specific (permissions)
**If NO:** The problem is general (backend/service issue)

---

## Quick Fix Checklist

Run through this checklist:

- [ ] Did you run the SQL to create operator user?
- [ ] Did you restart the backend after making changes?
- [ ] Is the backend running? (Check terminal shows "HTTPS Server running on port 5000")
- [ ] Is Python recognition service running? (Check service manager logs)
- [ ] Can you login as operator successfully?
- [ ] When you login, are you redirected to Face Attendance page?
- [ ] What error appears in browser console (F12)?

---

## How to Share Error With Me

To help you better, please share:

1. **Browser Console Error** (F12 → Console tab):
   - Take screenshot or copy the red error messages

2. **Network Tab** (F12 → Network tab):
   - Refresh the page
   - Find any red/failed requests
   - Click on it
   - Share the URL and Response

3. **What you see on screen:**
   - Error message popup?
   - Blank page?
   - Page loads but camera doesn't work?

---

## Expected Behavior (When Working)

### As Operator:

1. **Login Page:**
   - Enter: operator / ops123$
   - Click Login

2. **After Login:**
   - Immediately redirected to `/attendance/face`
   - See Face Attendance page with camera controls

3. **Navbar Shows:**
   - Face Attendance (button)
   - View Reports (button)
   - Logout (operator) (button)
   - Does NOT show Staff button

4. **Face Attendance Page:**
   - Can click "Start Camera"
   - Can upload image
   - Can recognize faces
   - Can mark attendance

5. **Attendance Report:**
   - Can view all attendance records
   - Can filter by date
   - Can export
   - CANNOT see "Attendance Actions" section
   - CANNOT do manual check-in/out

---

## Emergency: Reset Everything

If nothing works, try this:

1. **Stop all services**
2. **Run SQL to create operator:**
```sql
DELETE FROM users WHERE username = 'operator';

INSERT INTO users (username, password, role)
VALUES ('operator', '$2b$10$UrdyIN.Qln8XtcrBEH/.x.qFycx80TVd1u/jcDO3SlNxhIqhBw57S', 'operator');
```

3. **Restart backend:**
```bash
cd backend
npm start
```

4. **Clear browser completely:**
   - Press Ctrl+Shift+Delete
   - Clear all cookies and cache
   - Close browser
   - Reopen

5. **Try login again**

---

## Contact

If still having issues, please share:
- Screenshot of browser console error (F12)
- Screenshot of what you see on screen
- Copy of any error message

I'll help you fix it! 🚀

