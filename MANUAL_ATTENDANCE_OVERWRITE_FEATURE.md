# Manual Attendance Overwrite Feature

## Overview
This feature allows administrators to manually overwrite existing check-in and checkout times in the attendance system. This is particularly useful for correcting attendance records when face recognition captures incorrect times.

## Problem Solved
Previously, when a user had issues with check-in (e.g., face detection failure) and the system captured their 6 PM checkout as a check-in time instead, there was no way to manually correct these times. The system would reject manual check-in/checkout attempts with the error "Already checked in on [date]".

## Solution Implemented

### Backend Changes (backend/src/routes/attendance.js)

#### 1. Check-In Endpoint Enhancement
- Added `overwrite` parameter support
- When `overwrite: true` is provided:
  - Updates existing check-in time instead of creating new record
  - Validates that new check-in time is before existing checkout time
  - Updates attendance notes and work_from_home flag
  - Returns success message indicating overwrite occurred

#### 2. Check-Out Endpoint Enhancement
- Added `overwrite` parameter support
- When `overwrite: true` is provided:
  - Updates existing checkout time even if already set
  - Allows updating checkout time even if validation fails (with overwrite flag)
  - Returns success message indicating overwrite occurred

### Frontend Changes (frontend/src/components/AttendanceReport.jsx)

#### 1. New State Variable
- Added `allowOverwrite` state to control overwrite mode

#### 2. UI Enhancements
- Added toggle switch labeled "Allow overwrite of existing check-in/checkout times"
- Switch uses warning color to indicate caution required
- Added warning info box when overwrite mode is enabled
- Info box explains when and why to use this feature

#### 3. Mutation Updates
- Updated `checkIn` mutation to include `overwrite` parameter
- Updated `checkOut` mutation to include `overwrite` parameter
- Enhanced success messages to indicate when overwrite occurred
- Auto-reset overwrite flag after successful operation

## Usage Instructions

### Scenario: Correcting Incorrectly Captured Times

**Problem:** 
- Staff member had check-in issue (face detection failed)
- At 6 PM during checkout, system captured this as check-in
- Need to manually set correct check-in (e.g., 9 AM) and checkout (6 PM) times

**Solution:**

1. **Navigate to Attendance Report** (Admin only)

2. **Enable Required Modes:**
   - Toggle ON "Use custom date/time for backdating attendance"
   - Toggle ON "Allow overwrite of existing check-in/checkout times"

3. **Correct the Check-In Time:**
   - Select the staff member
   - Set custom date to the correct date
   - Set custom time to the actual check-in time (e.g., 09:00)
   - Select appropriate manual entry reason
   - Click "Check In"
   - System will UPDATE the existing record instead of creating new one

4. **Set the Correct Checkout Time:**
   - Keep the same staff member selected
   - Set custom time to the actual checkout time (e.g., 18:00)
   - Click "Check Out"
   - System will UPDATE the checkout time

5. **Result:**
   - Attendance record now shows correct check-in: 9:00 AM
   - Attendance record now shows correct checkout: 6:00 PM
   - Total hours calculated correctly

## Safety Features

### Validations in Place:
1. **Check-In Validation:**
   - New check-in time must be before existing checkout time
   - Cannot set future dates/times
   - Cannot set dates older than 60 days

2. **Check-Out Validation:**
   - Warns if checkout time is before check-in time (unless overwrite is enabled)
   - Cannot set future dates/times
   - Cannot set dates older than 60 days

3. **User Feedback:**
   - Warning-colored toggle switch indicates caution
   - Info box explains the purpose and use case
   - Success messages indicate when overwrite occurred
   - Error messages guide proper usage

4. **Auto-Reset:**
   - Overwrite flag automatically resets after successful operation
   - Prevents accidental overwrites on next operation

## API Changes

### POST /api/attendance/check-in
**New Optional Parameter:**
- `overwrite` (boolean): Set to `true` to update existing check-in record

**Response Enhancement:**
- Returns `overwritten: true` when existing record was updated
- Returns `overwritten: false` or undefined when new record was created

**Example Request:**
```json
{
  "staffId": "EMP001",
  "customDateTime": "2025-11-05T09:00:00",
  "attendanceNotes": "Face detection failure - manual correction",
  "manualReason": "face_detection_failure",
  "overwrite": true
}
```

**Example Success Response:**
```json
{
  "message": "Check-in time updated for 2025-11-05 to 9:00:00 AM (manual overwrite)",
  "attendance": { ... },
  "overwritten": true
}
```

### POST /api/attendance/check-out
**New Optional Parameter:**
- `overwrite` (boolean): Set to `true` to update existing checkout record

**Response Enhancement:**
- Returns `overwritten: true` when existing checkout was updated
- Returns `overwritten: false` when first checkout was recorded

**Example Request:**
```json
{
  "staffId": "EMP001",
  "customDateTime": "2025-11-05T18:00:00",
  "overwrite": true
}
```

**Example Success Response:**
```json
{
  "message": "Check-out recorded for 2025-11-05 at 6:00:00 PM (manual overwrite)",
  "attendance": { ... },
  "overwritten": true
}
```

## Important Notes

1. **Admin Only:** This feature is only available to administrators
2. **Use Sparingly:** Only use overwrite mode when correcting genuinely incorrect records
3. **Audit Trail:** All overwrites are logged with the updated timestamps in the database
4. **Manual Reason Required:** Check-in overwrites still require a manual entry reason
5. **Automatic Reset:** Overwrite mode automatically disables after each operation to prevent accidents

## Testing Recommendations

1. Test overwriting check-in when checkout already exists
2. Test overwriting checkout when already set
3. Test validation errors (e.g., check-in after checkout)
4. Verify auto-reset of overwrite flag after successful operation
5. Verify proper success/error messages
6. Test with various manual entry reasons

## Future Enhancements

Potential improvements for future versions:
- Add audit log showing who made overwrites and when
- Add confirmation dialog before overwrite
- Allow bulk corrections for multiple staff members
- Add ability to delete incorrect records entirely
- Implement version history for attendance records

