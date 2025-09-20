-- Migration to add new work-related fields to staff table
-- Run this migration to add the new staff work fields

-- Add new columns to staff table
DO $$ 
BEGIN
    -- Work Status (dropdown: Full-time, Part-time, Contract)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'work_status') THEN
        ALTER TABLE staff ADD COLUMN work_status VARCHAR(20) DEFAULT 'Full-time';
    END IF;
    
    -- Manager (free text field)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'manager') THEN
        ALTER TABLE staff ADD COLUMN manager VARCHAR(100);
    END IF;
    
    -- Work From Home (enable/disable)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'work_from_home_enabled') THEN
        ALTER TABLE staff ADD COLUMN work_from_home_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Working Hours (start time)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'work_start_time') THEN
        ALTER TABLE staff ADD COLUMN work_start_time TIME DEFAULT '09:15:00';
    END IF;
    
    -- Working Hours (end time)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'work_end_time') THEN
        ALTER TABLE staff ADD COLUMN work_end_time TIME DEFAULT '17:45:00';
    END IF;
    
    -- Break Time in minutes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'break_time_minutes') THEN
        ALTER TABLE staff ADD COLUMN break_time_minutes INTEGER DEFAULT 30;
    END IF;
    
    -- Supervisor Name (if different from manager)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'supervisor_name') THEN
        ALTER TABLE staff ADD COLUMN supervisor_name VARCHAR(100);
    END IF;
    
    -- Project Code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'project_code') THEN
        ALTER TABLE staff ADD COLUMN project_code VARCHAR(50);
    END IF;
END $$;

-- Update work_status constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_staff_work_status') THEN
        ALTER TABLE staff ADD CONSTRAINT check_staff_work_status 
        CHECK (work_status IN ('Full-time', 'Part-time', 'Contract'));
    END IF;
END $$;

-- Update work_from_home_enabled constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_staff_wfh_enabled') THEN
        ALTER TABLE staff ADD CONSTRAINT check_staff_wfh_enabled 
        CHECK (work_from_home_enabled IN (TRUE, FALSE));
    END IF;
END $$;

-- Update break_time_minutes constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_staff_break_time') THEN
        ALTER TABLE staff ADD CONSTRAINT check_staff_break_time 
        CHECK (break_time_minutes >= 0 AND break_time_minutes <= 120);
    END IF;
END $$;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_staff_work_status ON staff(work_status);
CREATE INDEX IF NOT EXISTS idx_staff_manager ON staff(manager);
CREATE INDEX IF NOT EXISTS idx_staff_wfh ON staff(work_from_home_enabled);
CREATE INDEX IF NOT EXISTS idx_staff_work_hours ON staff(work_start_time, work_end_time);

-- Update existing staff records with default values
UPDATE staff SET work_status = 'Full-time' WHERE work_status IS NULL;
UPDATE staff SET work_from_home_enabled = FALSE WHERE work_from_home_enabled IS NULL;
UPDATE staff SET work_start_time = '09:15:00' WHERE work_start_time IS NULL;
UPDATE staff SET work_end_time = '17:45:00' WHERE work_end_time IS NULL;
UPDATE staff SET break_time_minutes = 30 WHERE break_time_minutes IS NULL;
UPDATE staff SET manager = 'TBD' WHERE manager IS NULL;
UPDATE staff SET supervisor_name = 'TBD' WHERE supervisor_name IS NULL;
UPDATE staff SET project_code = department WHERE project_code IS NULL;
