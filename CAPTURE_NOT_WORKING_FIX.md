# Camera Feed Not Capturing Frames - Diagnostic Guide

## Problem
Camera video is showing, but frames are not being captured for face recognition.

---

## 🔍 Immediate Diagnostic Steps

### **Step 1: Restart Frontend**
```bash
cd frontend
npm run dev
```

### **Step 2: Open Console (F12)**
Keep browser console open while testing.

### **Step 3: Login as Operator**
Watch what appears on screen and in console.

---

## 📊 Status Indicators on Screen

Below the video feed, you'll see a status banner:

```
Total scans: X | Streaming: Yes/No | Recognizing: Yes/No
```

### **What This Means:**

**Total scans: 0** (not increasing)
- ❌ Continuous mode not working
- Frames not being captured

**Total scans: 1, 2, 3...** (increasing every 3 seconds)
- ✅ Frames ARE being captured
- System is working

**Streaming: No**
- ❌ Camera stream not active
- Even though video shows, state is wrong

**Streaming: Yes**
- ✅ Camera stream is active

**Recognizing: Yes** (alternates with No)
- ✅ Recognition is happening

---

## 🧪 Manual Test Buttons

I've added test buttons for debugging:

### **Button 1: "Start Continuous Scanning"**
- Shows if continuous mode didn't auto-start
- Click it to manually start scanning
- Should start capturing every 3 seconds

### **Button 2: "Test Single Capture"**
- Triggers ONE manual capture
- Good for testing if capture works at all
- Watch console for detailed logs

---

## 🔍 Console Commands to Run

Open Console (F12) and run these commands:

### **Check Video Ready State:**
```javascript
document.querySelector('video').readyState
```
**Expected:** `4` (fully loaded)  
**If 0-3:** Video not fully ready yet

### **Check Video Dimensions:**
```javascript
document.querySelector('video').videoWidth
document.querySelector('video').videoHeight
```
**Expected:** `640` and `480` (or similar)  
**If 0:** Video metadata not loaded

### **Check Video Element Exists:**
```javascript
document.querySelector('video')
```
**Expected:** Shows `<video>` element  
**If null:** Video element not in DOM

### **Check Canvas Element:**
```javascript
document.querySelector('canvas')
```
**Expected:** Shows `<canvas>` element  
**If null:** Canvas missing

### **Force a Capture (Advanced):**
```javascript
// Get video and canvas elements
const video = document.querySelector('video')
const canvas = document.querySelector('canvas')

// Set canvas size
canvas.width = video.videoWidth
canvas.height = video.videoHeight

// Draw video frame to canvas
const ctx = canvas.getContext('2d')
ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

// Convert to blob
canvas.toBlob((blob) => {
  console.log('Manual capture blob size:', blob.size, 'bytes')
}, 'image/jpeg', 0.85)
```

If this creates a blob with size > 0, then basic capture works!

---

## 🎯 Expected Console Output

When working properly, you should see:

```
[INIT] Operator detected - starting auto-mode
[INIT] Starting camera stream...
[INIT] Camera stream started, waiting 2 seconds...
[STATE] Streaming state changed to: true
[INIT] Starting continuous recognition...
[CONTINUOUS] Starting continuous face recognition mode
[CONTINUOUS] Will scan for faces every 3 seconds
[CONTINUOUS] Continuous mode activated successfully
[STATE] Continuous mode changed to: true

(Wait 3 seconds...)

[CONTINUOUS] Interval triggered - isRecognizing: false streaming: true
[AUTO-CAPTURE] ========== SCAN #1 ==========
[AUTO-CAPTURE] Starting automatic capture at 5:00:15 PM
[AUTO-CAPTURE] Video ready state: 4 Video dimensions: 640 x 480
[AUTO-CAPTURE] Frame captured from video, creating blob...
[AUTO-CAPTURE] ✅ Blob created successfully! Size: 52341 bytes
[AUTO-CAPTURE] 📤 Sending to Python recognition service...
[RECOGNIZE] Starting recognition for: auto-capture-1.jpg
[RECOGNIZE] Sending to Python service: https://192.168.1.106:8001/recognize-simple
... (continues)
```

---

## ❌ Problem Scenarios

### **Scenario A: No Scans at All**

**Console shows:**
```
[INIT] Operator detected
[INIT] Starting camera stream...
[STATE] Streaming state changed to: true
(then nothing more)
```

**Problem:** Continuous mode didn't start  
**Fix:** Click "Start Continuous Scanning" button manually

---

### **Scenario B: Scans Trigger But Skip**

**Console shows:**
```
[CONTINUOUS] Interval triggered
[AUTO-CAPTURE] Video not ready yet, skipping this cycle
```

**Problem:** Video metadata not loaded  
**Fix:** Wait 10-15 seconds for video to fully initialize

---

### **Scenario C: Video Dimensions are 0**

**Console shows:**
```
[AUTO-CAPTURE] Video dimensions: 0 x 0
```

**Problem:** Video element not displaying properly  
**Fix:** Refresh page, wait for video to load

---

### **Scenario D: Blob Creation Fails**

**Console shows:**
```
[AUTO-CAPTURE] Frame captured from video, creating blob...
[AUTO-CAPTURE] Failed to create blob
```

**Problem:** Canvas drawing issue  
**Fix:** Check browser compatibility, try different browser

---

## 🔧 Quick Fixes

### **Fix 1: Manual Start**
If auto-start doesn't work:
1. Look for the button: "Start Continuous Scanning"
2. Click it
3. System should start scanning

### **Fix 2: Wait Longer**
Sometimes video needs time to initialize:
1. Wait 10-15 seconds after camera starts
2. Check if scans start happening
3. Look at scan counter

### **Fix 3: Use Test Button**
To test if capture works at all:
1. Click "Test Single Capture"
2. Watch console for logs
3. See if it creates a blob and sends to Python

### **Fix 4: Refresh and Retry**
1. Press F5 to refresh page
2. Wait for camera to start
3. Watch console and scan counter

---

## 📸 What You Should See

### **Screen:**
```
┌─────────────────────────────────┐
│ [Live video feed from camera]  │
│ [Blue "Ready" badge in corner] │
│                                 │
│ 🟢 Continuous Recognition Active│
│    Total scans: 5               │ ← Increases
│    Streaming: Yes               │ ← Must be Yes
│    Recognizing: No              │ ← Alternates
│                                 │
│ [Test Single Capture]           │
└─────────────────────────────────┘
```

### **Console (every 3 seconds):**
```
[CONTINUOUS] Interval triggered
[AUTO-CAPTURE] SCAN #1, #2, #3...
[AUTO-CAPTURE] ✅ Blob created
[RECOGNIZE] Sending to Python...
```

---

## ✅ Action Items

**Right now, please:**

1. ✅ Restart frontend
2. ✅ Open Console (F12)
3. ✅ Login as operator
4. ✅ Check status line: "Streaming: Yes/No?"
5. ✅ Check scan counter: Is it increasing?
6. ✅ Click "Test Single Capture" button
7. ✅ Copy all console logs
8. ✅ Tell me what you see

---

**The status indicators and test buttons will help us pinpoint exactly where the issue is!** 🔍

Share what you see in:
- Status line (Streaming: ? | Total scans: ?)
- Console logs (copy the text)
- What happens when you click "Test Single Capture"

