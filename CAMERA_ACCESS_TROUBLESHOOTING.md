# Camera Access Troubleshooting Guide

## Error: "Unable to access camera"

This guide will help you fix camera access issues.

---

## 🔍 Quick Diagnosis

After restarting the frontend, you'll see a **specific error message**. Follow the solution for your error:

---

## ✅ Solution 1: Permission Denied

### **Error Message:**
```
🚫 Camera access denied. Please click the camera icon in the address bar and allow camera access, then refresh the page.
```

### **Fix (Chrome/Edge):**

**Step 1:** Click the camera icon (🎥) or lock icon (🔒) in the address bar

**Step 2:** Change camera setting from "Block" to "Allow"

**Step 3:** Refresh the page (F5)

### **Fix (Firefox):**

**Step 1:** Click the camera icon with a red line through it in the address bar

**Step 2:** Click "X" to remove the block

**Step 3:** Refresh the page - permission popup will appear

**Step 4:** Click "Allow"

### **Manual Fix (Chrome):**

1. Go to: `chrome://settings/content/camera`
2. Under "Allowed", click "Add"
3. Enter: `https://192.168.1.106:5173`
4. Click "Add"
5. Refresh your application page

---

## ✅ Solution 2: HTTPS/Security Error

### **Error Message:**
```
🔒 HTTPS required for camera access. Please ensure you are using HTTPS (https://) and not HTTP.
```

### **Problem:**
Your browser is blocking camera access because the certificate is not trusted.

### **Fix - Accept the Certificate:**

**Method 1: Type Magic Phrase**
1. Click anywhere on the page
2. Type: `thisisunsafe` (no spaces, it won't show while typing)
3. Page will reload
4. Camera should work

**Method 2: Proceed Manually**
1. Click "Not secure" in address bar
2. Click "Certificate is not valid"
3. Click "Proceed" or "Advanced" → "Proceed to 192.168.1.106 (unsafe)"
4. Refresh page

**Method 3: Add Exception (Firefox)**
1. Click lock icon
2. Click "Connection not secure"
3. Click "More information"
4. Click "Add Exception"
5. Click "Confirm Security Exception"

---

## ✅ Solution 3: No Camera Found

### **Error Message:**
```
📹 No camera found. Please connect a webcam and refresh the page.
```

### **Fix:**

**Check 1: Is camera connected?**
- USB webcam: Check cable is plugged in
- Laptop: Built-in camera should be present
- Try unplugging and replugging USB webcam

**Check 2: Test camera in other apps**
- Windows: Open "Camera" app
- Check if camera works there
- If not, it's a hardware/driver issue

**Check 3: Enable camera in Device Manager (Windows)**
1. Press `Windows + X`
2. Click "Device Manager"
3. Expand "Cameras" or "Imaging devices"
4. Right-click your camera
5. Click "Enable device" if disabled
6. Refresh browser

---

## ✅ Solution 4: Camera In Use

### **Error Message:**
```
⚠️ Camera is being used by another application. Please close other apps using the camera and try again.
```

### **Fix:**

**Close these apps if open:**
- Zoom, Teams, Skype, Google Meet
- Camera app (Windows)
- OBS, Streamlabs
- Any other video conferencing software

**Windows - Force Close Camera Apps:**
1. Press `Ctrl + Shift + Esc` (Task Manager)
2. Look for:
   - Camera
   - Zoom
   - Teams
   - Skype
3. Right-click → "End task"
4. Refresh browser

---

## ✅ Solution 5: Browser Not Supported

### **Error Message:**
```
❌ Camera not supported in this browser. Please use Chrome, Firefox, or Edge.
```

### **Fix:**
Use one of these browsers:
- ✅ Google Chrome (recommended)
- ✅ Microsoft Edge
- ✅ Mozilla Firefox
- ❌ Internet Explorer (not supported)

---

## 🔧 Advanced Troubleshooting

### **Check Camera Permissions Manually:**

**Chrome:**
1. Go to: `chrome://settings/content/camera`
2. Check "Default behavior" is "Sites can ask to use your camera"
3. Check if your site is in "Block" list - remove it
4. Add to "Allow" list: `https://192.168.1.106:5173`

**Firefox:**
1. Go to: `about:preferences#privacy`
2. Scroll to "Permissions"
3. Find "Camera" → Click "Settings"
4. Find your site and set to "Allow"

**Edge:**
1. Go to: `edge://settings/content/camera`
2. Same as Chrome above

---

### **Test Camera Access:**

**Quick Test Page:**
1. Open new tab
2. Go to: `https://webcamtests.com/`
3. Click "Test my cam"
4. If camera works here but not in app → Permission issue
5. If camera doesn't work here → Hardware/driver issue

---

### **Browser Console Debugging:**

**View detailed error:**
1. Press `F12` (Developer Tools)
2. Go to "Console" tab
3. Refresh page and try to access camera
4. Look for red error messages
5. Share the error name (e.g., "NotAllowedError")

Common error names:
- `NotAllowedError` → Permission denied
- `NotFoundError` → No camera
- `NotReadableError` → Camera in use
- `SecurityError` → HTTPS issue
- `OverconstrainedError` → Camera doesn't meet requirements

---

## 🖥️ Windows-Specific Fixes

### **Camera Privacy Settings:**

**Windows 10/11:**
1. Press `Windows + I` (Settings)
2. Go to "Privacy & Security"
3. Click "Camera"
4. Turn ON:
   - "Camera access"
   - "Let apps access your camera"
   - "Let desktop apps access your camera"
5. Restart browser

### **Camera Drivers:**

**Update Camera Driver:**
1. Press `Windows + X` → Device Manager
2. Expand "Cameras" or "Imaging devices"
3. Right-click camera
4. Click "Update driver"
5. Choose "Search automatically"
6. Restart computer if updated

---

## 📱 Mobile/Tablet Issues

### **Mobile Browsers:**

Camera should work on:
- ✅ Chrome (Android)
- ✅ Safari (iOS)
- ✅ Firefox (Android)

**Fix:**
1. Ensure HTTPS (not HTTP)
2. Grant camera permission when prompted
3. If denied, go to browser settings:
   - Settings → Site settings → Camera
   - Allow for your site

---

## 🔄 Complete Reset Procedure

If nothing works, try this:

### **Step 1: Clear Browser Data**
```
Chrome: Ctrl + Shift + Delete
Firefox: Ctrl + Shift + Delete
Edge: Ctrl + Shift + Delete

Select:
✅ Cookies and site data
✅ Cached images and files
✅ Site permissions

Time range: All time
```

### **Step 2: Restart Browser Completely**
```
1. Close ALL browser windows
2. Open Task Manager (Ctrl + Shift + Esc)
3. Find browser processes
4. End all of them
5. Restart browser
```

### **Step 3: Fresh Start**
```
1. Open browser
2. Go to: https://192.168.1.106:5173
3. Accept certificate warning
4. Login as operator
5. Grant camera permission when prompted
6. Should work now!
```

---

## ✅ Checklist

Run through this checklist:

**Browser:**
- [ ] Using Chrome, Firefox, or Edge (not IE)
- [ ] Browser is up to date
- [ ] No other tabs using camera

**URL:**
- [ ] Using HTTPS (https://)
- [ ] Certificate accepted/trusted
- [ ] Not showing "Not secure" warning (or accepted anyway)

**Camera:**
- [ ] Webcam is connected
- [ ] Camera works in other apps
- [ ] Camera shows in Device Manager
- [ ] Camera is enabled (not disabled)

**Permissions:**
- [ ] Camera permission granted in browser
- [ ] Windows camera privacy enabled
- [ ] Site not in "Block" list
- [ ] Site added to "Allow" list (optional)

**Application:**
- [ ] Frontend restarted (npm run dev)
- [ ] Logged in as operator
- [ ] On Face Attendance page

---

## 🆘 Still Not Working?

### **Try This:**

**Test 1: Use Admin Login**
- Login as admin instead of operator
- Manually click "Start Camera"
- If works → Operator auto-start issue
- If doesn't work → General camera issue

**Test 2: Different Computer**
- Try on different computer/laptop
- If works there → Problem with first computer
- If doesn't work → Network/server issue

**Test 3: Different Browser**
- Chrome not working? Try Firefox
- Firefox not working? Try Edge
- If works in one → Browser-specific issue

---

## 📊 After Fixing

Once camera works:

**For Operators:**
1. Login → Camera auto-starts
2. Grant permission (first time only)
3. See live video feed
4. Blue "Ready" badge appears
5. System starts scanning automatically

**Permission is remembered:**
- Next login won't ask again
- Permission persists for the domain
- Only asks if you clear browser data

---

## 🎯 Most Common Solutions

**90% of issues are fixed by:**

1. **Click camera icon in address bar → Allow** (50%)
2. **Accept HTTPS certificate** (30%)
3. **Close other apps using camera** (10%)

---

## 📞 Need More Help?

**Information to provide:**
1. Browser name and version
2. Operating system (Windows 10/11)
3. Exact error message shown
4. Browser console error (F12 → Console)
5. Does camera work in other apps?

---

**Good luck!** 🎉

Most camera issues are just permission problems and are easy to fix.

