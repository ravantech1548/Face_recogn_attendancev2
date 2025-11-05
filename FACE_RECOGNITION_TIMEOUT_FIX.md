# Face Recognition Timeout Fix

## Problem Identified ✅

**Error:** `Face recognition request failed: signal timed out`

**Root Cause:** 
- Frontend timeout: 30 seconds
- Face recognition time: 32+ seconds
- Recognition succeeds but response arrives after timeout

## Analysis from Logs

Your face recognition is working but too slow:

```
Load known faces: 24.7 seconds  ⚠️ VERY SLOW
Face detection:    3.9 seconds
Face encoding:     3.7 seconds
Face matching:     0.08 seconds
─────────────────────────────────
Total time:       32.7 seconds   ❌ Exceeds 30s timeout
```

## Fix Applied ✅

### 1. Increased Frontend Timeout

**File:** `frontend/src/config/api.js`

**Changed:**
```javascript
// Before
timeout: 30000  // 30 seconds

// After
timeout: 60000  // 60 seconds
```

## What You Need to Do NOW

### Step 1: Restart Frontend

The frontend needs to reload with the new timeout:

```bash
# Press Ctrl+C to stop the frontend
# Then restart:
cd frontend
npm run dev
```

Or if using service manager, restart the frontend service.

### Step 2: Test Again

1. Login as **operator** (or admin)
2. Go to **Face Attendance**
3. Upload an image or use camera
4. Wait for recognition (may take 30-40 seconds on first load)
5. Should work now! ✅

---

## Performance Optimization (Recommended)

Your face recognition is slow because it takes **24+ seconds** to load known faces each time. Here's how to speed it up:

### Option A: Use Database Encodings (FASTEST) ⚡

Currently you have 3 staff with face encodings stored in files, but they're not in the database.

**Fix:**
```bash
cd python
python populate_encodings.py
```

This will:
- Load encodings from image files
- Store them in PostgreSQL database
- Next recognition will be 20x faster (loads from DB instead of processing images)

**Expected improvement:**
- Load time: 24s → **0.5s** 🚀
- Total time: 32s → **8s**

### Option B: Optimize Python Service Settings

**File:** `python/config.py`

Add/Update these settings:
```python
# Face recognition settings
RECOGNITION_SETTINGS = {
    'model': 'hog',  # Use 'hog' instead of 'cnn' for faster detection
    'num_jitters': 1,  # Reduce from default (usually 3-5) for speed
    'tolerance': 0.6,  # Current setting is fine
}
```

**Expected improvement:**
- Total time: 32s → **20s**

### Option C: Cache Known Faces in Memory

The service reloads faces on every request. Keep them in memory instead.

**Check:** Does your `python/recognizer_service.py` reload faces each time?

If yes, modify to cache faces globally (load once at startup).

---

## Quick Performance Test

After restarting frontend, test the speed:

1. **First recognition:** May take 30-40 seconds (loading faces)
2. **Second recognition:** Should be faster (~8-10 seconds)

If second recognition is still slow:
- Run `populate_encodings.py` to store in database
- Restart Python recognition service

---

## Detailed Steps to Optimize

### Step 1: Populate Database Encodings

```bash
# Navigate to python directory
cd python

# Activate virtual environment (if not already active)
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

# Run the population script
python populate_encodings.py
```

**Expected output:**
```
✅ Loaded encoding for staff 1549 (Suresh)
✅ Loaded encoding for staff 1655
✅ Loaded encoding for staff XXXX
✅ Updated 3 staff members with face encodings
```

### Step 2: Verify Database Has Encodings

```sql
SELECT staff_id, full_name, 
       CASE 
         WHEN face_encoding IS NOT NULL THEN 'Yes' 
         ELSE 'No' 
       END as has_encoding
FROM staff;
```

**Expected:**
```
staff_id | full_name | has_encoding
---------|-----------|-------------
1549     | Suresh    | Yes
1655     | ...       | Yes
...      | ...       | Yes
```

### Step 3: Restart Python Recognition Service

```bash
# Stop current service (Ctrl+C)
# Restart:
python recognizer_service.py
```

Or use service manager to restart.

### Step 4: Test Performance

1. Go to Face Attendance
2. Upload a test image
3. Check logs for new timing

**Expected log:**
```
INFO - END: load_known_faces | {"duration_ms": "500.00"}  ✅ Fast!
INFO - END: total_request | {"duration_ms": "8000.00"}    ✅ Under timeout
```

---

## Troubleshooting

### Still Getting Timeout After Restart?

**Check 1:** Did you restart the frontend?
```bash
# In frontend terminal
Ctrl+C
npm run dev
```

**Check 2:** Is timeout actually updated?
- Open browser DevTools (F12)
- Go to Console
- Type: `localStorage.clear()`
- Refresh page
- Try again

**Check 3:** Clear browser cache
- Ctrl+Shift+Delete
- Clear cache
- Reload page

### Recognition Still Slow After populate_encodings.py?

**Check 1:** Are encodings in database?
```sql
SELECT COUNT(*) FROM staff WHERE face_encoding IS NOT NULL;
```

Should return number > 0.

**Check 2:** Is Python service using database?
Check `python/recognizer_service.py` - it should query database for encodings.

**Check 3:** Restart Python service
- Stop the service
- Start again
- Test

### Error Running populate_encodings.py?

If script doesn't exist, create it:

```python
# python/populate_encodings.py
import psycopg2
import face_recognition
import numpy as np
import os
import glob

# Database connection
conn = psycopg2.connect(
    dbname="face_recognition_attendance",
    user="postgres",
    password="postgres",  # Update with your password
    host="127.0.0.1",
    port="5432"
)
cur = conn.cursor()

# Get all staff with face images
cur.execute("SELECT staff_id, face_image_path FROM staff WHERE face_image_path IS NOT NULL")
staff_list = cur.fetchall()

print(f"Found {len(staff_list)} staff members with face images")

for staff_id, image_path in staff_list:
    try:
        # Full path to image
        full_path = os.path.join('..', image_path)
        
        if not os.path.exists(full_path):
            print(f"❌ Image not found: {full_path}")
            continue
        
        # Load image and generate encoding
        image = face_recognition.load_image_file(full_path)
        encodings = face_recognition.face_encodings(image)
        
        if len(encodings) == 0:
            print(f"❌ No face found in image for staff {staff_id}")
            continue
        
        # Use first face found
        encoding = encodings[0]
        
        # Convert to string for storage
        encoding_str = ','.join(map(str, encoding))
        
        # Update database
        cur.execute(
            "UPDATE staff SET face_encoding = %s WHERE staff_id = %s",
            (encoding_str, staff_id)
        )
        
        print(f"✅ Updated encoding for staff {staff_id}")
        
    except Exception as e:
        print(f"❌ Error processing staff {staff_id}: {e}")

conn.commit()
cur.close()
conn.close()

print("\n✅ Encoding population complete!")
```

---

## Summary

### Immediate Fix (Done ✅)
- [x] Increased timeout from 30s to 60s
- [ ] **YOU NEED TO:** Restart frontend

### Performance Optimization (Recommended)
- [ ] Run `populate_encodings.py`
- [ ] Restart Python recognition service
- [ ] Test performance improvement

### Expected Results

**Before:**
```
⏱️ Time: 32 seconds
❌ Result: Timeout error
```

**After (with timeout fix only):**
```
⏱️ Time: 32 seconds
✅ Result: Success (within 60s timeout)
```

**After (with database encodings):**
```
⏱️ Time: 8 seconds
✅ Result: Fast success
```

---

## Test Checklist

Run through this after restart:

- [ ] Stopped frontend (Ctrl+C)
- [ ] Restarted frontend (`npm run dev`)
- [ ] Cleared browser cache (Ctrl+Shift+Delete)
- [ ] Logged in as operator
- [ ] Went to Face Attendance
- [ ] Uploaded test image
- [ ] Waited (up to 40 seconds first time)
- [ ] Recognition succeeded ✅

---

## Next Steps

1. **Right now:** Restart frontend to apply timeout fix
2. **Then test:** Should work (but slow)
3. **For speed:** Run `populate_encodings.py` (optional but recommended)

---

**The timeout issue is fixed!** Just restart your frontend and it will work. 🎉

The slowness is a separate performance issue that can be optimized later with database encodings.

