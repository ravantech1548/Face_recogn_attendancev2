-- Migration to add new fields to attendance table
-- Run this migration to add the new attendance fields

-- Add new columns to staff table (check if they exist first)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'work_status') THEN
        ALTER TABLE staff ADD COLUMN work_status VARCHAR(20) DEFAULT 'Full-time';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'manager_name') THEN
        ALTER TABLE staff ADD COLUMN manager_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'project_code') THEN
        ALTER TABLE staff ADD COLUMN project_code VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'supervisor_name') THEN
        ALTER TABLE staff ADD COLUMN supervisor_name VARCHAR(100);
    END IF;
END $$;

-- Add new columns to attendance table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'attendance_notes') THEN
        ALTER TABLE attendance ADD COLUMN attendance_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'late_arrival_minutes') THEN
        ALTER TABLE attendance ADD COLUMN late_arrival_minutes INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'early_departure_minutes') THEN
        ALTER TABLE attendance ADD COLUMN early_departure_minutes INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'break_time_duration') THEN
        ALTER TABLE attendance ADD COLUMN break_time_duration INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'work_from_home') THEN
        ALTER TABLE attendance ADD COLUMN work_from_home BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'check_in_face_image_path') THEN
        ALTER TABLE attendance ADD COLUMN check_in_face_image_path VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'check_out_face_image_path') THEN
        ALTER TABLE attendance ADD COLUMN check_out_face_image_path VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'check_in_confidence_score') THEN
        ALTER TABLE attendance ADD COLUMN check_in_confidence_score DECIMAL(5,4);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'check_out_confidence_score') THEN
        ALTER TABLE attendance ADD COLUMN check_out_confidence_score DECIMAL(5,4);
    END IF;
END $$;

-- Update work_status constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_work_status') THEN
        ALTER TABLE staff ADD CONSTRAINT check_work_status 
        CHECK (work_status IN ('Full-time', 'Part-time', 'Contract'));
    END IF;
END $$;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_staff_work_status ON staff(work_status);
CREATE INDEX IF NOT EXISTS idx_staff_manager ON staff(manager_name);
CREATE INDEX IF NOT EXISTS idx_attendance_wfh ON attendance(work_from_home);
CREATE INDEX IF NOT EXISTS idx_attendance_late ON attendance(late_arrival_minutes);

-- Update existing staff records with default values
UPDATE staff SET work_status = 'Full-time' WHERE work_status IS NULL;
UPDATE staff SET manager_name = 'TBD' WHERE manager_name IS NULL;
UPDATE staff SET project_code = department WHERE project_code IS NULL;
UPDATE staff SET supervisor_name = 'TBD' WHERE supervisor_name IS NULL;

-- Update existing attendance records with default values
UPDATE attendance SET late_arrival_minutes = 0 WHERE late_arrival_minutes IS NULL;
UPDATE attendance SET early_departure_minutes = 0 WHERE early_departure_minutes IS NULL;
UPDATE attendance SET break_time_duration = 0 WHERE break_time_duration IS NULL;
UPDATE attendance SET work_from_home = FALSE WHERE work_from_home IS NULL;
