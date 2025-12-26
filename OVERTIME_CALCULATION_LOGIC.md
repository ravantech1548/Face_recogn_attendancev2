# Overtime Calculation Logic - Step-Function Implementation

## Overview

This document describes the step-function overtime calculation logic implemented for payroll accuracy. The system uses configurable thresholds to determine when overtime starts.

## Key Components

### 1. Database Fields

**Staff Table Fields:**
- `overtime_enabled` (BOOLEAN): Whether staff member is eligible for overtime tracking
- `work_end_time` (TIME): Standard work end time (e.g., 17:45)
- `ot_threshold_minutes` (INTEGER): Grace period in minutes after work_end_time before OT starts (default: 30)

### 2. Core Logic

The overtime calculation uses a **step-function** approach:

**Formula:**
```
OT Eligibility Start Time = work_end_time + ot_threshold_minutes

If checkout_time > OT Eligibility Start Time:
    OT Hours = checkout_time - work_end_time
Else:
    OT Hours = 0
```

**Example (work_end_time = 17:45, threshold = 30 minutes):**
- OT Eligibility Start Time = 18:15
- If checkout at 18:10 → OT = 0 (within grace period)
- If checkout at 18:30 → OT = 0:45 (45 minutes from 17:45)

### 3. Important Rules

1. **Only applies to OT-enabled staff**: Overtime is only calculated if `overtime_enabled = TRUE`
2. **Step-function threshold**: If checkout is before the threshold, no OT is earned (even if past work_end_time)
3. **OT calculated from work_end_time**: Once threshold is exceeded, OT is calculated from `work_end_time`, not from check-in time or 8-hour mark
4. **Configurable per staff**: Each staff member can have different `work_end_time` and `ot_threshold_minutes`

## Implementation Details

### SQL Calculation (in attendance.js)

```sql
CASE 
  WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL 
       AND s.overtime_enabled = TRUE THEN
    -- Step-function OT logic: OT only starts after work_end_time + threshold
    CASE 
      WHEN a.check_out_time::time > (
        (COALESCE(s.work_end_time, '17:45:00')::time + 
         INTERVAL '1 minute' * COALESCE(s.ot_threshold_minutes, 30))
      ) THEN
        -- Calculate OT from work_end_time (not from check-in or 8 hours)
        TO_CHAR(a.check_out_time::time - COALESCE(s.work_end_time, '17:45:00')::time, 'HH24:MI')
      ELSE '00:00'
    END
  ELSE '00:00'
END as overtime_hours
```

### Configuration

**Default Values:**
- `work_end_time`: 17:45
- `ot_threshold_minutes`: 30 minutes
- `overtime_enabled`: FALSE (must be explicitly enabled)

**Setting OT Threshold:**
1. Go to Staff Management → Edit Staff
2. Enable "Overtime Enabled" toggle
3. Set "Work End Time" (e.g., 17:45)
4. Set "OT Threshold (Minutes)" (e.g., 30)
5. Save

### Example Scenarios

#### Scenario A: Early Exit (No OT)
- **Work End Time**: 17:45
- **OT Threshold**: 30 minutes
- **OT Eligibility Start**: 18:15
- **Checkout Time**: 17:45
- **Result**: OT = 0:00

#### Scenario B: Within Buffer (No OT)
- **Work End Time**: 17:45
- **OT Threshold**: 30 minutes
- **OT Eligibility Start**: 18:15
- **Checkout Time**: 18:10
- **Result**: OT = 0:00 (within grace period)

#### Scenario C: OT Triggered
- **Work End Time**: 17:45
- **OT Threshold**: 30 minutes
- **OT Eligibility Start**: 18:15
- **Checkout Time**: 18:30
- **Result**: OT = 0:45 (calculated from 17:45)

#### Scenario D: Extended OT
- **Work End Time**: 17:45
- **OT Threshold**: 30 minutes
- **OT Eligibility Start**: 18:15
- **Checkout Time**: 19:45
- **Result**: OT = 2:00 (2 hours from 17:45)

## Migration

To apply the database changes:

```bash
cd backend
node scripts/run_all_migration.js
```

This will:
1. Add `ot_threshold_minutes` column to staff table
2. Set default value of 30 minutes for all staff
3. Add constraints and indexes

## Frontend Configuration

The OT Threshold field is available in the Staff Management form:

- **Location**: Staff Management → Add/Edit Staff
- **Field**: "OT Threshold (Minutes)"
- **Options**: 0, 15, 30, 45, 60 minutes
- **Disabled**: When "Overtime Enabled" is OFF
- **Default**: 30 minutes

## Benefits

1. **Payroll Accuracy**: Clear rules for when OT starts
2. **Flexibility**: Configurable per staff member
3. **Fairness**: Grace period prevents minor overtime from being counted
4. **Compliance**: Step-function logic ensures consistent calculation
5. **Transparency**: Clear threshold makes OT calculation predictable

## Notes

- The threshold is **inclusive** of the grace period
- OT is always calculated from `work_end_time`, never from check-in time
- The system only calculates OT for staff with `overtime_enabled = TRUE`
- All times use the database timezone

