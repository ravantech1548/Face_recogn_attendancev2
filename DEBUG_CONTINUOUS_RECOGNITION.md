# Debug Continuous Face Recognition

## ✅ Debugging Tools Added

I've added comprehensive logging to help diagnose the face recognition flow.

---

## 🔍 How to Debug

### **Step 1: Restart Frontend**

```bash
cd frontend
# Press Ctrl+C
npm run dev
```

### **Step 2: Open Browser Console**

1. Open your application
2. Press **F12** (Developer Tools)
3. Go to **Console** tab
4. Keep it open while testing

### **Step 3: Login as Operator**

- Username: `operator`
- Password: `ops123$`

### **Step 4: Watch the Logs**

You should see logs in this order:

```
[CONTINUOUS] Starting continuous face recognition mode
[CONTINUOUS] Will scan for faces every 3 seconds
[CONTINUOUS] Continuous mode activated successfully
```

Then every 3 seconds:

```
[CONTINUOUS] Interval triggered - isRecognizing: false streaming: true
[AUTO-CAPTURE] ========== SCAN #1 ==========
[AUTO-CAPTURE] Starting automatic capture at 5:00:01 PM
[AUTO-CAPTURE] Video ready state: 4 Video dimensions: 640 x 480
[AUTO-CAPTURE] Frame captured from video, creating blob...
[AUTO-CAPTURE] ✅ Blob created successfully! Size: 45234 bytes
[AUTO-CAPTURE] 📤 Sending to Python recognition service...
[RECOGNIZE] Starting recognition for: auto-capture-1.jpg Blob size: 45234 bytes
[RECOGNIZE] Sending to Python service: https://192.168.1.106:8001/recognize-simple
[RECOGNIZE] Timeout configured: 60000 ms
... (waiting for Python service)
[RECOGNIZE] Response received in 8234 ms
[RECOGNIZE] Response status: 200 OK
[RECOGNIZE] Parsed response: {...}
[RECOGNIZE] Best match: {...}
[AUTO-CAPTURE] ========== END SCAN #1 ==========
```

---

## 📊 What to Check in Console

### **Check 1: Is Continuous Mode Starting?**

**Look for:**
```
[CONTINUOUS] Starting continuous face recognition mode
```

**If NOT found:**
- ❌ Auto-start didn't trigger
- Check if logged in as operator
- Check if on Face Attendance page

**If found:**
- ✅ Continuous mode is active

---

### **Check 2: Is Interval Running?**

**Look for (every 3 seconds):**
```
[CONTINUOUS] Interval triggered - isRecognizing: false streaming: true
```

**If NOT found:**
- ❌ Interval not running
- Camera might not be streaming
- Check video feed is showing

**If found:**
- ✅ Interval is triggering correctly

---

### **Check 3: Is Frame Being Captured?**

**Look for:**
```
[AUTO-CAPTURE] ========== SCAN #X ==========
[AUTO-CAPTURE] ✅ Blob created successfully! Size: XXXXX bytes
```

**If NOT found:**
- ❌ Video not ready or dimensions are 0
- Look for: "Video not ready yet, skipping this cycle"
- Wait a few more seconds for camera to initialize

**If found:**
- ✅ Frames are being captured

---

### **Check 4: Is Request Sent to Python?**

**Look for:**
```
[RECOGNIZE] Sending to Python service: https://192.168.1.106:8001/recognize-simple
[RECOGNIZE] Response received in XXXX ms
```

**If NOT found:**
- ❌ Request not reaching Python service
- Network issue or Python service down

**If found:**
- ✅ Python service is receiving and responding

---

### **Check 5: Is Face Being Matched?**

**Look for:**
```
[RECOGNIZE] Best match: { staffId: "1549", ... }
[RECOGNIZE] Match found! Staff: 1549 Confidence: 0.9052
```

**If shows "No matching face found":**
- ❌ Face not recognized in database
- Person not in system
- Face angle/lighting issue
- Low confidence score

**If found:**
- ✅ Face matched successfully

---

### **Check 6: Is Attendance Being Marked?**

**Look for:**
```
[RECOGNIZE] Sending attendance to backend: https://192.168.1.106:5000/api/attendance/face-event
[RECOGNIZE] Attendance marked successfully: {...}
```

**If NOT found:**
- ❌ Attendance API call failed
- Backend permission issue
- Check backend logs

**If found:**
- ✅ Full flow working!

---

## 🎯 Visual Indicators on Screen

You should also see:

**On video feed (top-right corner):**
- 🔵 **"✓ Ready"** - System ready to scan
- 🟢 **"Scanning for faces..."** - Currently processing (when green badge shows)

**Below video:**
- 🟢 **"Continuous Recognition Active"**
- **"Total scans: X"** - Increments every 3 seconds
- **"Last scan: HH:MM:SS"** - Updates with each scan

**If these numbers are NOT updating:**
- ❌ Continuous mode not working
- Check console for errors

---

## 🐛 Common Issues and Solutions

### **Issue 1: No Scans Happening**

**Console shows:**
```
[CONTINUOUS] Skipping - not streaming
```

**Solution:**
- Camera stream didn't start properly
- Check video feed is visible
- Look for camera errors earlier in console
- Try refreshing page

---

### **Issue 2: Video Not Ready**

**Console shows:**
```
[AUTO-CAPTURE] Video not ready yet, skipping this cycle
```

**Solution:**
- Camera initializing, wait 10-15 seconds
- If persists after 30 seconds, refresh page
- Check video element is visible on screen

---

### **Issue 3: Python Service Not Responding**

**Console shows:**
```
[RECOGNIZE] Sending to Python service: https://...
(then timeout or error)
```

**Solution:**

**Check Python service is running:**
```bash
# Look at Python service logs
# Should show "GET /health HTTP/1.1" 200 every 30 seconds
```

**Verify service URL:**
```javascript
// In browser console, type:
console.log(getRecognitionUrl('recognizeSimple'))
// Should show: https://192.168.1.106:8001/recognize-simple
```

**Test service manually:**
- Open new tab
- Go to: `https://192.168.1.106:8001/health`
- Should see: `{"status": "healthy"}`
- If error → Python service is down

---

### **Issue 4: No Face Detected**

**Console shows:**
```
[RECOGNIZE] No matching face found
```

**Possible causes:**
1. **No face in frame** - Position yourself in camera view
2. **Face not in database** - Add face to system first
3. **Poor lighting** - Improve lighting
4. **Face angle** - Face camera directly
5. **Low confidence** - Face partially obscured

**Solution:**
- Ensure face is clearly visible in video
- Face camera directly
- Improve lighting
- Check staff face is registered in system

---

### **Issue 5: Attendance Not Marked**

**Console shows:**
```
[RECOGNIZE] Match found! Staff: 1549
[RECOGNIZE] Attendance response status: 400 or 403
[RECOGNIZE] Attendance marking failed: ...
```

**Solution:**

**Check backend logs** for detailed error

**Common causes:**
- Already checked in today
- Backend permission issue (should be fixed with requireAdminOrOperator)
- Token expired - logout and login again

---

## 📋 Complete Diagnostic Checklist

Run through this with console open (F12):

### **Phase 1: Initialization**
- [ ] Login as operator successful
- [ ] Redirected to Face Attendance page
- [ ] Console shows: `[CONTINUOUS] Starting continuous face recognition mode`
- [ ] Console shows: `[CONTINUOUS] Continuous mode activated successfully`

### **Phase 2: Camera Stream**
- [ ] Video feed visible on screen
- [ ] Video shows live camera feed (not black screen)
- [ ] Console shows video ready state: 4
- [ ] Console shows video dimensions: 640 x 480 (or similar)

### **Phase 3: Continuous Scanning**
- [ ] Every 3 seconds, console shows: `[CONTINUOUS] Interval triggered`
- [ ] Console shows: `[AUTO-CAPTURE] ========== SCAN #X ==========`
- [ ] Scan count increments on screen
- [ ] Last scan time updates on screen
- [ ] Green "Scanning..." badge appears on video

### **Phase 4: Frame Capture**
- [ ] Console shows: `[AUTO-CAPTURE] ✅ Blob created successfully`
- [ ] Blob size is reasonable (20,000 - 100,000 bytes)
- [ ] Console shows: `[AUTO-CAPTURE] 📤 Sending to Python recognition service`

### **Phase 5: Python Service Communication**
- [ ] Console shows: `[RECOGNIZE] Sending to Python service: https://...`
- [ ] Console shows: `[RECOGNIZE] Response received in XXXX ms`
- [ ] Response time is reasonable (< 60 seconds)
- [ ] Response status: 200 OK

### **Phase 6: Recognition Result**
- [ ] Console shows: `[RECOGNIZE] Parsed response: {...}`
- [ ] Console shows: `[RECOGNIZE] Best match: {...}`
- [ ] If face recognized: `[RECOGNIZE] Match found! Staff: XXXX`

### **Phase 7: Attendance Marking**
- [ ] Console shows: `[RECOGNIZE] Sending attendance to backend`
- [ ] Console shows: `[RECOGNIZE] Attendance marked successfully`
- [ ] Toast notification appears on screen
- [ ] Success popup shows (briefly)

---

## 🎬 Expected Console Output (Full Cycle)

```javascript
// Initialization
[CONTINUOUS] Starting continuous face recognition mode
[CONTINUOUS] Will scan for faces every 3 seconds
[CONTINUOUS] Continuous mode activated successfully

// Wait 3 seconds...

// Scan #1
[CONTINUOUS] Interval triggered - isRecognizing: false streaming: true
[AUTO-CAPTURE] ========== SCAN #1 ==========
[AUTO-CAPTURE] Starting automatic capture at 5:00:15 PM
[AUTO-CAPTURE] Video ready state: 4 Video dimensions: 640 x 480
[AUTO-CAPTURE] Frame captured from video, creating blob...
[AUTO-CAPTURE] ✅ Blob created successfully! Size: 52341 bytes
[AUTO-CAPTURE] 📤 Sending to Python recognition service...
[RECOGNIZE] Starting recognition for: auto-capture-1.jpg Blob size: 52341 bytes
[RECOGNIZE] Sending to Python service: https://192.168.1.106:8001/recognize-simple
[RECOGNIZE] Timeout configured: 60000 ms
[RECOGNIZE] Response received in 8567 ms
[RECOGNIZE] Response status: 200 OK
[RECOGNIZE] Response text length: 452
[RECOGNIZE] Parsed response: {success: true, matches: [...]}
[RECOGNIZE] Best match: {staffId: "1549", fullName: "Suresh", score: 0.9052, matched: true}
[RECOGNIZE] Match found! Staff: 1549 Confidence: 0.9052
[RECOGNIZE] Sending attendance to backend: https://192.168.1.106:5000/api/attendance/face-event
[RECOGNIZE] Attendance response status: 201
[RECOGNIZE] Attendance marked successfully: {action: "checked_in", ...}
[AUTO-CAPTURE] ========== END SCAN #1 ==========

// Wait 3 seconds...

// Scan #2
[CONTINUOUS] Interval triggered - isRecognizing: false streaming: true
[AUTO-CAPTURE] ========== SCAN #2 ==========
...
```

---

## 🔧 Quick Diagnostic Commands

### **In Browser Console, type:**

**Check if continuous mode is active:**
```javascript
console.log('Continuous mode active')
```

**Check video dimensions:**
```javascript
document.querySelector('video').videoWidth
document.querySelector('video').videoHeight
```

**Check if camera stream is active:**
```javascript
document.querySelector('video').srcObject
// Should show MediaStream object
```

**Manually trigger a scan:**
```javascript
// Can't call directly, but check scan count updating on screen
```

---

## 📞 What to Share for Help

If still not working, share:

1. **Console logs** (copy all text from Console tab)
2. **What phase fails** (see checklist above)
3. **Screenshots of:**
   - Camera feed (is video showing?)
   - Green banner (scan count updating?)
   - Any error messages

---

## ✅ Working System Looks Like:

**Screen:**
```
┌─────────────────────────────────────┐
│ [Video feed showing live camera]    │
│ [Green "Scanning..." badge]  ←  Shows when active
│                                     │
│ 🟢 Continuous Recognition Active   │
│    Total scans: 5                   │  ← Increments
│    Last scan: 5:00:15 PM            │  ← Updates
│                                     │
│ [Stop Camera button]                │
└─────────────────────────────────────┘
```

**Console (every 3 seconds):**
```
[CONTINUOUS] Interval triggered
[AUTO-CAPTURE] SCAN #1, #2, #3...
[RECOGNIZE] Response received
[RECOGNIZE] Match found (if face detected)
```

---

## 🎯 Next Steps

1. ✅ **Restart frontend**
2. ✅ **Open Console (F12)**
3. ✅ **Login as operator**
4. ✅ **Watch console logs**
5. ✅ **Check on-screen scan counter**
6. ✅ **Share results**

---

**The logs will tell us exactly where the process is stopping!**

Possible outcomes:

1. **Logs stop at [CONTINUOUS]** → Auto-start issue
2. **Logs stop at [AUTO-CAPTURE]** → Frame capture issue
3. **Logs stop at [RECOGNIZE]** → Python service issue
4. **Shows "No matching face"** → Recognition working, just no match
5. **Full logs working** → Everything working! ✅

---

**Restart the frontend and check the console logs!** 📊

Share what you see and we'll fix it immediately!

