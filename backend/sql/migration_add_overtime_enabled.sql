-- Migration to add overtime_enabled field to staff table
-- This field controls whether a staff member is eligible for overtime tracking

DO $$ 
BEGIN
    -- Overtime (enable/disable)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'overtime_enabled') THEN
        ALTER TABLE staff ADD COLUMN overtime_enabled BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add constraint for overtime_enabled
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_staff_overtime_enabled') THEN
        ALTER TABLE staff ADD CONSTRAINT check_staff_overtime_enabled 
        CHECK (overtime_enabled IN (TRUE, FALSE));
    END IF;
END $$;

-- Add index for overtime_enabled field
CREATE INDEX IF NOT EXISTS idx_staff_overtime ON staff(overtime_enabled);

-- Update existing staff records with default value (FALSE - overtime eligibility should be explicitly enabled)
UPDATE staff SET overtime_enabled = FALSE WHERE overtime_enabled IS NULL;

-- Add comment to the column
COMMENT ON COLUMN staff.overtime_enabled IS 'Whether staff member is eligible for overtime tracking';

