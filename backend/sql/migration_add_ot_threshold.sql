-- Migration to add overtime threshold/grace period field to staff table
-- This field controls the grace period after work_end_time before overtime starts
-- Example: If work_end_time is 17:45 and ot_threshold_minutes is 30, OT starts at 18:15

DO $$ 
BEGIN
    -- Overtime Threshold/Grace Period (in minutes)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'ot_threshold_minutes') THEN
        ALTER TABLE staff ADD COLUMN ot_threshold_minutes INTEGER DEFAULT 30;
    END IF;
END $$;

-- Add constraint for ot_threshold_minutes (0-120 minutes)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_staff_ot_threshold') THEN
        ALTER TABLE staff ADD CONSTRAINT check_staff_ot_threshold 
        CHECK (ot_threshold_minutes >= 0 AND ot_threshold_minutes <= 120);
    END IF;
END $$;

-- Add index for ot_threshold_minutes field
CREATE INDEX IF NOT EXISTS idx_staff_ot_threshold ON staff(ot_threshold_minutes);

-- Update existing staff records with default value (30 minutes grace period)
UPDATE staff SET ot_threshold_minutes = 30 WHERE ot_threshold_minutes IS NULL;

-- Add comment to the column
COMMENT ON COLUMN staff.ot_threshold_minutes IS 'Grace period in minutes after work_end_time before overtime starts. OT calculation only applies if overtime_enabled is TRUE.';

