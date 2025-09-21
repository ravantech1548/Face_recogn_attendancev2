-- Migration to add on_duty_enabled field to staff table
-- This field controls whether a staff member can use "On Duty" manual attendance reason

DO $$ 
BEGIN
    -- On Duty (enable/disable)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'on_duty_enabled') THEN
        ALTER TABLE staff ADD COLUMN on_duty_enabled BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Add constraint for on_duty_enabled
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_staff_on_duty_enabled') THEN
        ALTER TABLE staff ADD CONSTRAINT check_staff_on_duty_enabled 
        CHECK (on_duty_enabled IN (TRUE, FALSE));
    END IF;
END $$;

-- Add index for on_duty_enabled field
CREATE INDEX IF NOT EXISTS idx_staff_on_duty ON staff(on_duty_enabled);

-- Update existing staff records with default value (TRUE - most staff should be able to use "On Duty")
UPDATE staff SET on_duty_enabled = TRUE WHERE on_duty_enabled IS NULL;

-- Add comment to the column
COMMENT ON COLUMN staff.on_duty_enabled IS 'Whether staff member can use "On Duty" manual attendance reason';
