# 2-Minute Cooldown Feature for Continuous Face Recognition

## Overview

Prevents the same person from having their attendance marked multiple times within 2 minutes. This avoids duplicate entries when someone stays in front of the camera or walks by multiple times.

---

## ✅ Feature Implemented

### **How It Works:**

1. **First Recognition:**
   - Staff member stands in front of camera
   - Face is recognized (e.g., Saravanan - Staff 1548)
   - Attendance is marked (Check-in or Check-out)
   - ✅ Success notification appears
   - 🕐 **2-minute cooldown starts** for this staff member

2. **Within 2 Minutes:**
   - Same staff member appears in camera again
   - Face is recognized again
   - ⏸️ **Attendance NOT marked** (cooldown active)
   - ℹ️ Info notification: "Already marked Xs ago. Cooldown: Ys remaining"
   - System continues scanning for other staff

3. **After 2 Minutes:**
   - Cooldown expires
   - If staff appears again, attendance can be marked
   - New cooldown starts

---

## 🎯 Why This Feature?

### **Without Cooldown:**
```
Person stands in front of camera
00:00 - ✅ Check-in marked
00:03 - ✅ Check-in marked again (duplicate!)
00:06 - ✅ Check-in marked again (duplicate!)
00:09 - ✅ Check-in marked again (duplicate!)
... (every 3 seconds while person is visible)
```

### **With Cooldown:**
```
Person stands in front of camera
00:00 - ✅ Check-in marked
00:03 - ⏸️ Skipped (cooldown: 117s remaining)
00:06 - ⏸️ Skipped (cooldown: 114s remaining)
00:09 - ⏸️ Skipped (cooldown: 111s remaining)
...
02:00 - ✅ Can be marked again (if needed)
```

---

## 📊 Visual Indicators

### **On Screen Display:**

**When attendance is marked:**
```
✅ Check-in recorded for Saravanan (1548)

⏱️ Recently Marked (2-min cooldown):
   [1548 (120s)] [1655 (45s)] [1672 (98s)]
```

**Cooldown chips show:**
- Staff ID
- Countdown timer (updates every second)
- Orange/warning color
- Auto-removes when cooldown expires

---

## 🔧 Technical Details

### **Cooldown Period:**
- **Duration:** 2 minutes (120 seconds)
- **Tracked in:** Browser memory (resets on page refresh)
- **Per staff member:** Each person has independent cooldown

### **Implementation:**

```javascript
// Track recent marks: staffId -> timestamp
const recentAttendanceMarks = useRef(new Map())

// Before marking attendance:
const lastMarkTime = recentAttendanceMarks.current.get(staffId)
const cooldownPeriod = 2 * 60 * 1000 // 2 minutes

if (lastMarkTime && (now - lastMarkTime) < cooldownPeriod) {
  // Skip - still in cooldown
  return
}

// Mark attendance
recentAttendanceMarks.current.set(staffId, now)
```

### **Auto Cleanup:**
Cooldown entries older than 3 minutes are automatically removed to prevent memory buildup.

---

## 🎮 User Experience

### **For Operators:**

**Scenario 1: Normal Flow**
```
1. Staff approaches camera
2. ✅ Attendance marked
3. [1548 (120s)] chip appears
4. Staff walks away
5. Next staff approaches
6. ✅ Their attendance marked
7. [1655 (120s)] chip appears
```

**Scenario 2: Same Person Stays**
```
1. Staff stands in camera view
2. ✅ Attendance marked at 09:00:00
3. Person doesn't move
4. Every 3 seconds: System scans but skips (cooldown)
5. ℹ️ Notification: "Already marked 15s ago. Cooldown: 105s"
6. Person walks away
7. After 2 minutes, if they return: ✅ Can mark again
```

**Scenario 3: Multiple Staff**
```
09:00:00 - Saravanan approaches → ✅ Marked
09:00:15 - John approaches → ✅ Marked
09:00:30 - Mary approaches → ✅ Marked
09:00:45 - Saravanan passes by again → ⏸️ Skipped (cooldown: 75s)
09:01:00 - John still visible → ⏸️ Skipped (cooldown: 60s)
09:02:15 - Saravanan returns → ✅ Marked again (cooldown expired)
```

---

## 📱 Console Logs

### **When Attendance Marked:**
```
[RECOGNIZE] Match found! Staff: 1548 Confidence: 0.9052
[RECOGNIZE] ✅ Cooldown check passed, proceeding to mark attendance
[RECOGNIZE] Attendance marked successfully
[RECOGNIZE] 🕐 Cooldown started for Staff 1548 - 2 minutes
```

### **When Cooldown Active:**
```
[RECOGNIZE] Match found! Staff: 1548 Confidence: 0.9052
[RECOGNIZE] ⏸️ Cooldown active for Staff 1548. Wait 87 more seconds.
[RECOGNIZE] Skipping attendance mark for Saravanan - marked 33s ago
```

### **Auto Cleanup:**
```
[RECOGNIZE] 🧹 Cleaned up old cooldown for Staff 1672
```

---

## ⚙️ Configuration

### **Change Cooldown Duration:**

In `AdminFaceAttendance.jsx`, modify the cooldown period:

```javascript
// Currently: 2 minutes
const cooldownPeriod = 2 * 60 * 1000

// Options:
const cooldownPeriod = 1 * 60 * 1000   // 1 minute
const cooldownPeriod = 3 * 60 * 1000   // 3 minutes
const cooldownPeriod = 5 * 60 * 1000   // 5 minutes
const cooldownPeriod = 30 * 1000       // 30 seconds (testing)
```

**Recommended:** 2-3 minutes for normal operation

### **Disable Cooldown:**

To disable cooldown completely:

```javascript
// Comment out the cooldown check:
// if (lastMarkTime && (now - lastMarkTime) < cooldownPeriod) {
//   ... return
// }

// Or set cooldown to 0:
const cooldownPeriod = 0
```

---

## 🎯 Benefits

### **Prevents:**
- ❌ Duplicate attendance marks
- ❌ Database spam
- ❌ Server overload from same person
- ❌ Multiple entries for one event

### **Allows:**
- ✅ Multiple staff to be marked quickly
- ✅ Same person to be marked after cooldown
- ✅ Natural flow at entrances/exits
- ✅ Efficient queue processing

---

## 📋 Visual Display Elements

### **1. Cooldown Chips**
```
⏱️ Recently Marked (2-min cooldown):
[1548 (120s)] [1655 (95s)] [1672 (43s)]
     ↑             ↑            ↑
  Staff ID    Countdown    Countdown
              (2 min)      (43 sec)
```

### **2. Info Notifications**
```
ℹ️ Saravanan already marked 33s ago. Cooldown: 87s remaining.
```
- Blue background (info color)
- Auto-closes after 2 seconds
- Doesn't interrupt workflow
- Shows exact timing

### **3. Success Notifications**
```
✅ Check-in recorded for Saravanan (1548)
```
- Green background
- Auto-closes after 3 seconds
- Confirms attendance marked

---

## 🔍 Behavior Examples

### **Example 1: Quick Succession**
```
Person A: Check-in at 09:00:00 → ✅ Marked
Person B: Check-in at 09:00:03 → ✅ Marked
Person C: Check-in at 09:00:06 → ✅ Marked
Person A: Returns at 09:00:09 → ⏸️ Skipped (111s remaining)
Person B: Returns at 09:00:12 → ⏸️ Skipped (108s remaining)
Person D: Check-in at 09:00:15 → ✅ Marked (not in cooldown)
```

### **Example 2: Check-in and Check-out**
```
Morning:
09:00:00 - Saravanan check-in → ✅ Marked
09:00:03 - Still visible → ⏸️ Skipped (117s remaining)

Evening:
18:00:00 - Saravanan check-out → ✅ Marked (cooldown from morning expired)
18:00:03 - Still visible → ⏸️ Skipped (117s remaining)
```

### **Example 3: Persistent Person**
```
Person stands in view for 3 minutes:
00:00 - ✅ Marked
00:03 - ⏸️ Skipped (117s)
00:06 - ⏸️ Skipped (114s)
... (continues skipping for 2 minutes)
02:00 - ⏸️ Skipped (3s remaining)
02:03 - ✅ Marked again (cooldown expired)
02:06 - ⏸️ Skipped (114s)
```

---

## 📊 Performance Impact

### **Before Cooldown:**
- Same person detected 40 times in 2 minutes
- 40 database write operations
- 40 attendance records (duplicates)
- Server overload risk

### **After Cooldown:**
- Same person detected 40 times in 2 minutes
- 1 database write operation ✅
- 1 attendance record (correct) ✅
- 39 skipped operations (logged only)

**Efficiency improvement: 97.5%** 🚀

---

## 🐛 Edge Cases Handled

### **1. Multiple People With Same Name**
- Cooldown tracks by Staff ID (not name)
- Each person has separate cooldown
- No conflicts

### **2. Browser Refresh**
- Cooldown resets on page refresh
- Fresh start for operator
- Acceptable trade-off for simplicity

### **3. Staff Leaves and Returns**
- Within 2 minutes → ⏸️ Skipped
- After 2 minutes → ✅ Marked again
- Natural behavior

### **4. Check-in Then Check-out**
- Check-in at 09:00 → ✅ Marked
- Check-out at 18:00 → ✅ Marked (cooldown long expired)
- Works perfectly for normal workflow

---

## 🔧 Customization Options

### **Adjust Cooldown Time:**

**Shorter (1 minute)** - For high-traffic areas:
```javascript
const cooldownPeriod = 1 * 60 * 1000
```

**Longer (5 minutes)** - For low-traffic areas:
```javascript
const cooldownPeriod = 5 * 60 * 1000
```

**Testing (30 seconds):**
```javascript
const cooldownPeriod = 30 * 1000
```

### **Different Cooldown for Check-in vs Check-out:**

```javascript
// In recognizeBlobSimple, before marking:
const isMorning = new Date().getHours() < 12
const cooldownPeriod = isMorning ? 
  2 * 60 * 1000 :  // 2 min for check-in
  1 * 60 * 1000    // 1 min for check-out
```

### **Hide Cooldown Display:**

Remove or comment out the cooldown display component:
```javascript
{/* Cooldown Period Display */}
{/* Comment out or delete this entire section */}
```

---

## 📖 Documentation

### **Console Log Prefixes:**

- `[RECOGNIZE]` - Face recognition process
- `🕐` - Cooldown started
- `⏸️` - Cooldown active (skipped)
- `✅` - Cooldown check passed
- `🧹` - Old cooldown cleaned up

### **Staff ID Format:**

Cooldown uses Staff ID from database:
- Format: String (e.g., "1548", "1655", "EMP001")
- Case-sensitive
- Must match database exactly

---

## ✅ Testing Checklist

After restart, verify:

- [ ] Login as operator
- [ ] Mark attendance for one person
- [ ] See their chip appear in cooldown section
- [ ] Countdown timer decreases (120, 119, 118...)
- [ ] Same person detected again → Info notification
- [ ] Different person → Attendance marked normally
- [ ] After 2 minutes → Original person can be marked again
- [ ] Chip disappears after cooldown expires

---

## 🎯 Summary

**Feature:** 2-minute cooldown per staff member  
**Purpose:** Prevent duplicate attendance marks  
**Display:** Real-time countdown chips  
**Notification:** Info toast when skipped  
**Cleanup:** Auto-removes expired cooldowns  

**Status:** ✅ **Ready to Use**

---

## 🚀 To See It in Action

### **Restart Frontend:**
```bash
cd frontend
npm run dev
```

### **Test:**
1. Login as operator
2. Camera auto-starts
3. Stand in front of camera
4. Watch attendance get marked
5. See cooldown chip appear: `[YOUR_ID (120s)]`
6. Watch countdown decrease
7. Stay in view → System skips marking again
8. Blue info notification appears briefly
9. After 2 minutes → Can mark again

---

**The system now intelligently prevents duplicate marks while still allowing continuous monitoring!** 🎉

**Last Updated:** November 5, 2025

