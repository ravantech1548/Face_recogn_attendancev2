-- Migration: Add face capture fields to attendance table
-- This allows storing check-in and check-out face images for audit purposes

-- Add new columns to attendance table
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS check_in_face_image_path VARCHAR(255),
ADD COLUMN IF NOT EXISTS check_out_face_image_path VARCHAR(255),
ADD COLUMN IF NOT EXISTS check_in_confidence_score DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS check_out_confidence_score DECIMAL(5,4);

-- Add comments for documentation
COMMENT ON COLUMN attendance.check_in_face_image_path IS 'Path to face image captured during check-in';
COMMENT ON COLUMN attendance.check_out_face_image_path IS 'Path to face image captured during check-out';
COMMENT ON COLUMN attendance.check_in_confidence_score IS 'Confidence score of face recognition during check-in (0.0-1.0)';
COMMENT ON COLUMN attendance.check_out_confidence_score IS 'Confidence score of face recognition during check-out (0.0-1.0)';

-- Create index for face image paths (for faster queries)
CREATE INDEX IF NOT EXISTS idx_attendance_check_in_face ON attendance(check_in_face_image_path);
CREATE INDEX IF NOT EXISTS idx_attendance_check_out_face ON attendance(check_out_face_image_path);
