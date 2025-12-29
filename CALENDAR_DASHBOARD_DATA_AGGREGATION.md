# Calendar Dashboard Data Aggregation

## Overview

The calendar dashboard now properly aggregates **all existing attendance data** from the database, including:
- Face attendance records (check-in/check-out via face recognition)
- Manual attendance entries (admin check-in/check-out)
- Leave actions (casual leave, medical leave, unpaid leave, hospitalised leave)
- Overtime calculations

## How Data is Aggregated

### Query Structure

The calendar view uses a SQL query that:
1. **Gets all dates** in the selected month from `dim_calendar` table
2. **Cross joins with all active staff** to create date-staff combinations
3. **Left joins with attendance** to find existing records
4. **Counts and aggregates** attendance by type

### Attendance Types Counted

#### 1. **Present** (`total_present`)
- Counts all attendance records where `status = 'present'`
- Includes:
  - Face attendance check-ins (from `/api/attendance/face-event`)
  - Manual check-ins (from `/api/attendance/check-in`)
  - Any attendance record with status='present'

#### 2. **Leave** (`total_leave`)
- Counts all attendance records with leave status types:
  - `casual_leave`
  - `medical_leave`
  - `unpaid_leave`
  - `hospitalised_leave`
- These are created via the leave actions endpoint (`/api/attendance/leave`)

#### 3. **Absent** (`total_absent`)
- Counts staff who have **no attendance record** for that date
- Only counts on **working days** (not weekends or holidays)
- Calculated as: `(total active staff) - (present) - (leave)` for working days

#### 4. **Overtime** (`total_ot_days`, `total_ot_hours`)
- Counts staff who:
  - Have `status = 'present'`
  - Have both `check_in_time` and `check_out_time`
  - Have `overtime_enabled = TRUE` in staff table
  - Worked past their `work_end_time + ot_threshold_minutes`
- Calculates total OT hours using the same logic as the attendance report

## Data Sources

The calendar dashboard pulls data from:

1. **`dim_calendar` table**
   - Provides all dates in the month
   - Identifies weekends and public holidays
   - Used to determine working vs non-working days

2. **`attendance` table**
   - Contains all attendance records
   - Includes face attendance, manual entries, and leave records
   - Fields used:
     - `date` - The attendance date
     - `staff_id` - Staff member
     - `status` - Attendance status (present, leave types, etc.)
     - `check_in_time` - Check-in timestamp
     - `check_out_time` - Check-out timestamp

3. **`staff` table**
   - Provides list of active staff members
   - Contains overtime configuration:
     - `overtime_enabled` - Whether staff is eligible for OT
     - `work_end_time` - Standard work end time
     - `ot_threshold_minutes` - Minutes after work_end_time before OT starts

## Example Scenarios

### Scenario 1: Face Attendance
- Staff member uses face recognition to check in at 9:00 AM
- Record created: `status='present'`, `check_in_time='2025-01-15 09:00:00'`
- **Calendar shows**: Counted in `total_present` for that date

### Scenario 2: Leave Action
- Admin creates leave entry for staff member
- Record created: `status='casual_leave'`, `check_in_time='00:00:00'`, `check_out_time='00:00:00'`
- **Calendar shows**: Counted in `total_leave` for that date

### Scenario 3: Manual Check-in
- Admin manually records check-in for staff member
- Record created: `status='present'`, `check_in_time='2025-01-15 08:30:00'`
- **Calendar shows**: Counted in `total_present` for that date

### Scenario 4: Overtime
- Staff member checks in at 9:00 AM, checks out at 7:00 PM
- Staff has `work_end_time='17:45'`, `ot_threshold_minutes=30`
- OT starts at 18:15, so 45 minutes of OT
- **Calendar shows**: 
  - Counted in `total_present`
  - Counted in `total_ot_days` (1)
  - `total_ot_hours` includes 0.75 hours

### Scenario 5: Absent
- Staff member has no attendance record for a working day
- Date is not a weekend or holiday
- **Calendar shows**: Counted in `total_absent` for that date

## Visual Representation

The calendar dashboard displays:
- **Green background**: Days with present attendance
- **Red background**: Days with absent staff (on working days)
- **Orange background**: Days with leave records
- **Light grey**: Weekends
- **Very light grey**: Public holidays
- **OT Badge**: Shows count of staff who worked overtime

## Data Accuracy

The query ensures:
- ✅ All existing attendance records are counted
- ✅ Face attendance data is included
- ✅ Leave actions are included
- ✅ Manual entries are included
- ✅ Overtime is calculated correctly
- ✅ Absent staff are only counted on working days
- ✅ Weekends and holidays are properly identified

## Performance Considerations

The query uses:
- `CROSS JOIN` to create date-staff combinations (necessary for accurate counting)
- `LEFT JOIN` to find attendance records (preserves all date-staff combinations)
- `COUNT(DISTINCT ...)` to avoid double-counting
- Proper indexing on `attendance.date` and `attendance.staff_id` for performance

## Troubleshooting

If data doesn't appear in the calendar:

1. **Check attendance records exist**:
   ```sql
   SELECT COUNT(*) FROM attendance WHERE date >= '2025-01-01' AND date <= '2025-01-31';
   ```

2. **Verify staff are active**:
   ```sql
   SELECT COUNT(*) FROM staff WHERE is_active = TRUE;
   ```

3. **Check calendar table**:
   ```sql
   SELECT COUNT(*) FROM dim_calendar WHERE calendar_date >= '2025-01-01' AND calendar_date <= '2025-01-31';
   ```

4. **Verify date format**: Ensure dates in attendance table match the format in dim_calendar (YYYY-MM-DD)


