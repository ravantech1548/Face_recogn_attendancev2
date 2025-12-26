const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const pool = require('../config/database');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const requireAdminOrOperator = require('../middleware/requireAdminOrOperator');

const router = express.Router();

// Configure multer for face image uploads with organized folder structure
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Get current date
    const now = new Date();
    const year = now.getFullYear().toString(); // YYYY
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthFolder = `${month}${year}`; // MMYYYY
    const dateFolder = `${day}${month}${year}`; // DDMMYYYY
    
    // Create hierarchical folder structure: uploads/attendance/YYYY/MMYYYY/DDMMYYYY
    const uploadDir = path.join(__dirname, '../../uploads/attendance', year, monthFolder, dateFolder);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const staffId = req.body.staffId || 'unknown';
    const extension = path.extname(file.originalname);
    cb(null, `attendance-${staffId}-${timestamp}${extension}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Record check-in (Admin only - for manual attendance entry)
router.post(
  '/check-in',
  [auth, requireAdmin, body('staffId').notEmpty().withMessage('staffId is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { staffId, customDateTime, attendanceNotes, manualReason, overwrite } = req.body;
      
      // Use custom datetime if provided, otherwise use database timezone
      let checkInTime, dateStr;
      if (customDateTime) {
        checkInTime = new Date(customDateTime);
        dateStr = checkInTime.toISOString().slice(0, 10);
      } else {
        // Use database timezone for consistency
        const timeRes = await pool.query('SELECT NOW() AS now, CURRENT_DATE AS today');
        checkInTime = new Date(timeRes.rows[0].now);
        dateStr = timeRes.rows[0].today;
      }

      // Validate custom datetime if provided
      if (customDateTime) {
        if (isNaN(checkInTime.getTime())) {
          return res.status(400).json({ message: 'Invalid custom date/time format' });
        }
        
        // Check if custom datetime is not in the future
        const now = new Date();
        if (checkInTime > now) {
          return res.status(400).json({ message: 'Cannot record attendance for future date/time' });
        }
        
        // Check if custom datetime is not too far in the past (e.g., more than 60 days)
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
        if (checkInTime < sixtyDaysAgo) {
          return res.status(400).json({ message: 'Cannot record attendance more than 60 days in the past' });
        }
      }

      // Check if already checked-in for the specified date
      const existing = await pool.query(
        'SELECT attendance_id, check_out_time FROM attendance WHERE staff_id = $1 AND date = $2',
        [staffId, dateStr]
      );

      // Set work_from_home flag based on manual reason
      const isWorkFromHome = manualReason === 'work_from_home'
      const finalNotes = manualReason === 'others' ? attendanceNotes : attendanceNotes

      if (existing.rows.length > 0) {
        // If overwrite flag is set, allow manual update of check-in time
        if (overwrite === true || overwrite === 'true') {
          const attendanceId = existing.rows[0].attendance_id;
          const existingCheckOut = existing.rows[0].check_out_time;
          
          // If there's a checkout time, validate that new check-in is before it
          if (existingCheckOut) {
            const checkOutTime = new Date(existingCheckOut);
            if (checkInTime >= checkOutTime) {
              return res.status(400).json({ 
                message: 'Manual check-in time must be before existing check-out time',
                checkInTime: checkInTime.toLocaleString(),
                checkOutTime: checkOutTime.toLocaleString()
              });
            }
          }
          
          // Update the existing record
          const result = await pool.query(
            `UPDATE attendance 
             SET check_in_time = $2, attendance_notes = $3, work_from_home = $4
             WHERE attendance_id = $1 RETURNING *`,
            [attendanceId, checkInTime, finalNotes, isWorkFromHome]
          )
          
          const message = customDateTime ? 
            `Check-in time updated for ${dateStr} to ${checkInTime.toLocaleTimeString()} (manual overwrite)` : 
            'Check-in time updated (manual overwrite)';
            
          return res.status(200).json({ message, attendance: result.rows[0], overwritten: true });
        } else {
          return res.status(400).json({ 
            message: `Already checked in on ${dateStr}. Use 'overwrite: true' to update the check-in time.` 
          });
        }
      }

      // Create new check-in record
      const result = await pool.query(
        `INSERT INTO attendance (staff_id, check_in_time, date, status, attendance_notes, work_from_home)
         VALUES ($1, $2, $3, 'present', $4, $5) RETURNING *`,
        [staffId, checkInTime, dateStr, finalNotes, isWorkFromHome]
      );
      
      const message = customDateTime ? 
        `Check-in recorded for ${dateStr} at ${checkInTime.toLocaleTimeString()}` : 
        'Check-in recorded';
        
      res.status(201).json({ message, attendance: result.rows[0] });
    } catch (error) {
      console.error('Check-in error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Record leave entry (Admin only - separate from attendance actions)
router.post(
  '/leave',
  [auth, requireAdmin, body('staffId').notEmpty().withMessage('staffId is required'), 
   body('leaveType').isIn(['casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave']).withMessage('Valid leaveType is required'),
   body('leaveStartDate').notEmpty().withMessage('leaveStartDate is required'),
   body('leaveEndDate').notEmpty().withMessage('leaveEndDate is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { staffId, leaveType, leaveStartDate, leaveEndDate, notes, overwrite } = req.body;
      
      // Validate dates
      const startDate = new Date(leaveStartDate);
      const endDate = new Date(leaveEndDate);
      
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ message: 'Invalid leave start date format' });
      }
      
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ message: 'Invalid leave end date format' });
      }
      
      if (endDate < startDate) {
        return res.status(400).json({ message: 'Leave end date cannot be before start date' });
      }
      
      // Get date range settings from global_settings
      const settingsResult = await pool.query(
        `SELECT setting_key, setting_value FROM global_settings 
         WHERE setting_key IN ('leave_max_past_months', 'leave_max_future_months')`
      );
      
      let maxPastMonths = 6; // Default value
      let maxFutureMonths = 6; // Default value
      
      settingsResult.rows.forEach(row => {
        if (row.setting_key === 'leave_max_past_months') {
          maxPastMonths = parseInt(row.setting_value) || 6;
        } else if (row.setting_key === 'leave_max_future_months') {
          maxFutureMonths = parseInt(row.setting_value) || 6;
        }
      });
      
      // Validate date range against configured limits
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      
      // Calculate date boundaries
      const maxPastDate = new Date(now);
      maxPastDate.setMonth(maxPastDate.getMonth() - maxPastMonths);
      const maxPastDateStr = maxPastDate.toISOString().slice(0, 10);
      
      const maxFutureDate = new Date(now);
      maxFutureDate.setMonth(maxFutureDate.getMonth() + maxFutureMonths);
      const maxFutureDateStr = maxFutureDate.toISOString().slice(0, 10);
      
      const startDateStr = startDate.toISOString().slice(0, 10);
      const endDateStr = endDate.toISOString().slice(0, 10);
      
      if (startDateStr < maxPastDateStr) {
        return res.status(400).json({ 
          message: `Cannot record leave more than ${maxPastMonths} months in the past` 
        });
      }
      
      if (endDateStr > maxFutureDateStr) {
        return res.status(400).json({ 
          message: `Cannot record leave more than ${maxFutureMonths} months in the future` 
        });
      }
      
      // Generate all dates in the range
      const datesInRange = [];
      const currentDate = new Date(startDate);
      const finalEndDate = new Date(endDate);
      
      while (currentDate <= finalEndDate) {
        datesInRange.push(new Date(currentDate).toISOString().slice(0, 10));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      const attendanceNotes = notes || leaveType.replace(/_/g, ' ').toUpperCase();
      const createdRecords = [];
      const updatedRecords = [];
      const skippedRecords = [];
      
      // Process each date in the range
      for (const dateStr of datesInRange) {
        const checkInTime = new Date(dateStr + 'T00:00:00');
        const checkOutTime = new Date(dateStr + 'T00:00:00');
        
        // Check if already has attendance record for this date
        const existing = await pool.query(
          'SELECT attendance_id, status FROM attendance WHERE staff_id = $1 AND date = $2',
          [staffId, dateStr]
        );
        
        if (existing.rows.length > 0) {
          // Check if it's already a leave
          const existingStatus = existing.rows[0].status;
          const leaveTypes = ['casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave'];
          const isExistingLeave = leaveTypes.includes(existingStatus);
          
          if (!(overwrite === true || overwrite === 'true')) {
            if (isExistingLeave) {
              skippedRecords.push({ date: dateStr, reason: 'Leave already exists' });
              continue;
            } else {
              skippedRecords.push({ date: dateStr, reason: 'Attendance already exists (use overwrite to convert)' });
              continue;
            }
          }
          
          // Update existing record
          const attendanceId = existing.rows[0].attendance_id;
          const result = await pool.query(
            `UPDATE attendance 
             SET check_in_time = $2, check_out_time = $3, status = $4, attendance_notes = $5, work_from_home = FALSE
             WHERE attendance_id = $1 RETURNING *`,
            [attendanceId, checkInTime, checkOutTime, leaveType, attendanceNotes]
          );
          
          updatedRecords.push(result.rows[0]);
        } else {
          // Create new leave record
          const result = await pool.query(
            `INSERT INTO attendance (staff_id, check_in_time, check_out_time, date, status, attendance_notes, work_from_home)
             VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING *`,
            [staffId, checkInTime, checkOutTime, dateStr, leaveType, attendanceNotes]
          );
          
          createdRecords.push(result.rows[0]);
        }
      }
      
      // Build response message
      const totalDays = datesInRange.length;
      const createdCount = createdRecords.length;
      const updatedCount = updatedRecords.length;
      const skippedCount = skippedRecords.length;
      
      let message = `Leave recorded for ${totalDays} day(s) (${leaveStartDate} to ${leaveEndDate})`;
      if (createdCount > 0) message += ` - ${createdCount} created`;
      if (updatedCount > 0) message += `, ${updatedCount} updated`;
      if (skippedCount > 0) message += `, ${skippedCount} skipped`;
      
      res.status(201).json({ 
        message, 
        recordsCreated: createdCount,
        recordsUpdated: updatedCount,
        recordsSkipped: skippedCount,
        totalDays,
        attendance: [...createdRecords, ...updatedRecords]
      });
    } catch (error) {
      console.error('Leave entry error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Record check-out (Admin only - for manual attendance entry)
router.post(
  '/check-out',
  [auth, requireAdmin, body('staffId').notEmpty().withMessage('staffId is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { staffId, customDateTime, overwrite } = req.body;
      
      // Use custom datetime if provided, otherwise use database timezone
      let checkOutTime, dateStr;
      if (customDateTime) {
        checkOutTime = new Date(customDateTime);
        dateStr = checkOutTime.toISOString().slice(0, 10);
      } else {
        // Use database timezone for consistency
        const timeRes = await pool.query('SELECT NOW() AS now, CURRENT_DATE AS today');
        checkOutTime = new Date(timeRes.rows[0].now);
        dateStr = timeRes.rows[0].today;
      }

      // Validate custom datetime if provided
      if (customDateTime) {
        if (isNaN(checkOutTime.getTime())) {
          return res.status(400).json({ message: 'Invalid custom date/time format' });
        }
        
        // Check if custom datetime is not in the future
        const now = new Date();
        if (checkOutTime > now) {
          return res.status(400).json({ message: 'Cannot record attendance for future date/time' });
        }
        
        // Check if custom datetime is not too far in the past (e.g., more than 60 days)
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
        if (checkOutTime < sixtyDaysAgo) {
          return res.status(400).json({ message: 'Cannot record attendance more than 60 days in the past' });
        }
      }

      const existing = await pool.query(
        'SELECT * FROM attendance WHERE staff_id = $1 AND date = $2',
        [staffId, dateStr]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ message: `No check-in record found for ${dateStr}` });
      }

      const attId = existing.rows[0].attendance_id;
      const existingCheckOut = existing.rows[0].check_out_time;
      const existingStatus = existing.rows[0].status;
      
      // Check if this is a leave type - if so, set checkout to 00:00:00
      const leaveTypes = ['casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave']
      const isLeaveType = existingStatus && leaveTypes.includes(existingStatus)
      
      if (isLeaveType) {
        // For leave types, checkout time should be 00:00:00
        checkOutTime = new Date(dateStr + 'T00:00:00');
      } else {
        // Validate that check-out time is after check-in time (skip for leave types)
        const checkInTime = new Date(existing.rows[0].check_in_time);
        if (checkOutTime <= checkInTime) {
          // Allow overwrite to bypass this validation if explicitly requested
          if (!(overwrite === true || overwrite === 'true')) {
            return res.status(400).json({ 
              message: 'Check-out time must be after check-in time. Use \'overwrite: true\' to force update.',
              checkInTime: checkInTime.toLocaleString(),
              checkOutTime: checkOutTime.toLocaleString()
            });
          }
        }
      }

      // Check if checkout already exists and overwrite is not enabled
      if (existingCheckOut && !(overwrite === true || overwrite === 'true')) {
        return res.status(400).json({ 
          message: `Check-out already recorded for ${dateStr}. Use 'overwrite: true' to update the check-out time.`,
          existingCheckOut: new Date(existingCheckOut).toLocaleString()
        });
      }

      // For check-out, only update the check_out_time
      // Keep existing attendance_notes and work_from_home from check-in
      const result = await pool.query(
        'UPDATE attendance SET check_out_time = $2 WHERE attendance_id = $1 RETURNING *',
        [attId, checkOutTime]
      );
      
      const isOverwrite = existingCheckOut ? ' (manual overwrite)' : '';
      const message = customDateTime ? 
        `Check-out recorded for ${dateStr} at ${checkOutTime.toLocaleTimeString()}${isOverwrite}` : 
        `Check-out recorded${isOverwrite}`;
        
      res.json({ message, attendance: result.rows[0], overwritten: !!existingCheckOut });
    } catch (error) {
      console.error('Check-out error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get attendance by date range
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, dateFilter } = req.query;
    // Non-admins can only query their own records via linked staff_id
    let { staffId } = req.query;
    if (req.user?.role !== 'admin') {
      // Lookup staff_id from users
      const ures = await pool.query('SELECT staff_id FROM users WHERE user_id = $1', [req.user.userId]);
      const ownStaffId = ures.rows?.[0]?.staff_id || null;
      staffId = ownStaffId || staffId;
    }
    const params = [];
    const conditions = [];
    
    // Apply date filters based on dateFilter parameter
    if (dateFilter === 'current_month') {
      // Use database timezone for accurate month calculation
      const monthQuery = await pool.query(`
        SELECT 
          DATE_TRUNC('month', CURRENT_DATE) as first_day,
          (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day') as last_day
      `);
      const firstDay = monthQuery.rows[0].first_day;
      const lastDay = monthQuery.rows[0].last_day;
      params.push(firstDay);
      params.push(lastDay);
      conditions.push(`a.date >= $${params.length - 1} AND a.date <= $${params.length}`);
    } else if (dateFilter === 'last_month') {
      // Use database timezone for accurate month calculation
      const monthQuery = await pool.query(`
        SELECT 
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') as first_day,
          (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day') as last_day
      `);
      const firstDay = monthQuery.rows[0].first_day;
      const lastDay = monthQuery.rows[0].last_day;
      params.push(firstDay);
      params.push(lastDay);
      conditions.push(`a.date >= $${params.length - 1} AND a.date <= $${params.length}`);
    } else {
      // Use manual date filters if provided
      if (startDate) {
        params.push(startDate);
        conditions.push(`a.date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`a.date <= $${params.length}`);
      }
    }
    
    if (staffId) {
      params.push(staffId);
      conditions.push(`a.staff_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT a.attendance_id, a.staff_id, a.check_in_time, a.check_out_time, a.date, a.status,
              a.created_at, a.check_in_face_image_path, a.check_out_face_image_path,
              a.check_in_confidence_score, a.check_out_confidence_score,
              a.attendance_notes, a.late_arrival_minutes, a.early_departure_minutes,
              a.break_time_duration, a.work_from_home,
              s.full_name, s.department, s.designation, s.work_status, s.manager_name,
              s.project_code, s.supervisor_name, s.break_time_minutes, s.overtime_enabled, s.work_end_time, s.ot_threshold_minutes,
              CASE 
                -- Leave days (status is a leave type or both times are 00:00:00) should have 0 hours
                WHEN a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave') 
                     OR (a.check_in_time::time = '00:00:00'::time AND a.check_out_time::time = '00:00:00'::time) THEN
                  '00:00'
                WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
                  CASE 
                    WHEN (a.check_out_time - a.check_in_time) > INTERVAL '4 hours 30 minutes' THEN
                      TO_CHAR((a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30), 'HH24:MI')
                    ELSE
                      TO_CHAR((a.check_out_time - a.check_in_time), 'HH24:MI')
                  END
                ELSE NULL
              END as total_hours,
              CASE 
                -- Leave days should have 0 day hours
                WHEN a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave') 
                     OR (a.check_in_time::time = '00:00:00'::time AND a.check_out_time::time = '00:00:00'::time) THEN
                  '00:00'
                WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
                  CASE 
                    WHEN (a.check_out_time - a.check_in_time) > INTERVAL '4 hours 30 minutes' THEN
                      CASE 
                        WHEN (a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30) <= INTERVAL '8 hours' THEN
                          TO_CHAR((a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30), 'HH24:MI')
                        ELSE '08:00'
                      END
                    ELSE
                      CASE 
                        WHEN (a.check_out_time - a.check_in_time) <= INTERVAL '8 hours' THEN
                          TO_CHAR((a.check_out_time - a.check_in_time), 'HH24:MI')
                        ELSE '08:00'
                      END
                  END
                ELSE NULL
              END as day_hours,
              CASE 
                -- Leave days should have 0 overtime hours
                WHEN a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave') 
                     OR (a.check_in_time::time = '00:00:00'::time AND a.check_out_time::time = '00:00:00'::time) THEN
                  '00:00'
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
       FROM attendance a
       JOIN staff s ON s.staff_id = a.staff_id
       ${where}
       ORDER BY a.date DESC, a.check_in_time DESC`,
      params
    );
    
    // Debug: Log first row to check overtime_enabled field
    if (result.rows.length > 0) {
      console.log('Sample attendance record (first row):', {
        staff_id: result.rows[0].staff_id,
        full_name: result.rows[0].full_name,
        overtime_enabled: result.rows[0].overtime_enabled,
        has_overtime_enabled: 'overtime_enabled' in result.rows[0]
      });
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Face event: auto check-in/out with proper daily logic and face capture storage
// Accessible by both admin and operator roles
router.post('/face-event', [auth, requireAdminOrOperator, upload.single('faceImage'), body('staffId').notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { staffId, confidenceScore } = req.body;
    const faceImage = req.file;
    
    // Get current time and date using database timezone
    const nowUpdateRes = await pool.query('SELECT NOW() AS now, CURRENT_DATE AS today, CURRENT_TIMESTAMP AS server_timestamp');
    const now = new Date(nowUpdateRes.rows[0].now);
    const today = nowUpdateRes.rows[0].today;
    
    console.log(`Face event for staff ${staffId} on date ${today} at ${now.toISOString()}`);
    console.log(`Face image: ${faceImage ? faceImage.filename : 'none'}, Confidence: ${confidenceScore || 'N/A'}`);

    // Fetch today's attendance (latest)
    const existingRes = await pool.query(
      'SELECT * FROM attendance WHERE staff_id = $1 AND date = $2 ORDER BY attendance_id DESC LIMIT 1',
      [staffId, today]
    );

    if (existingRes.rows.length === 0) {
      // No attendance record for today - CREATE NEW CHECK-IN
      let faceImagePath = null;
      if (faceImage) {
        // Extract the relative path from the full path
        const year = now.getFullYear().toString();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const monthFolder = `${month}${year}`;
        const dateFolder = `${day}${month}${year}`;
        faceImagePath = `uploads/attendance/${year}/${monthFolder}/${dateFolder}/${faceImage.filename}`;
      }
      const confidence = confidenceScore ? parseFloat(confidenceScore) : null;
      
      const insertRes = await pool.query(
        `INSERT INTO attendance (staff_id, check_in_time, date, status, check_in_face_image_path, check_in_confidence_score)
         VALUES ($1, NOW(), $2, 'present', $3, $4) RETURNING *`,
        [staffId, today, faceImagePath, confidence]
      );
      console.log(`Created new check-in for staff ${staffId} on ${today} with face image: ${faceImagePath}`);
      return res.status(201).json({ action: 'checked_in', attendance: insertRes.rows[0] });
    }

    const att = existingRes.rows[0];
    const checkInTime = att.check_in_time ? new Date(att.check_in_time) : null;
    const checkOutTime = att.check_out_time ? new Date(att.check_out_time) : null;
    
    console.log(`Existing record - Check-in: ${checkInTime?.toISOString()}, Check-out: ${checkOutTime?.toISOString()}`);

    const fiveMinutesMs = 5 * 60 * 1000;

    if (!checkOutTime) {
      // Has check-in but no check-out yet
      if (checkInTime && now.getTime() - checkInTime.getTime() >= fiveMinutesMs) {
        // More than 5 minutes since check-in - UPDATE CHECK-OUT
        let faceImagePath = null;
        if (faceImage) {
          const year = now.getFullYear().toString();
          const day = String(now.getDate()).padStart(2, '0');
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const monthFolder = `${month}${year}`;
          const dateFolder = `${day}${month}${year}`;
          faceImagePath = `uploads/attendance/${year}/${monthFolder}/${dateFolder}/${faceImage.filename}`;
        }
        const confidence = confidenceScore ? parseFloat(confidenceScore) : null;
        
        const upd = await pool.query(
          'UPDATE attendance SET check_out_time = NOW(), check_out_face_image_path = $2, check_out_confidence_score = $3 WHERE attendance_id = $1 RETURNING *',
          [att.attendance_id, faceImagePath, confidence]
        );
        console.log(`Updated check-out for staff ${staffId} on ${today} with face image: ${faceImagePath}`);
        return res.json({ action: 'checked_out', attendance: upd.rows[0] });
      } else {
        // Less than 5 minutes since check-in - ignore
        console.log(`Ignored - less than 5 minutes since check-in`);
        return res.status(200).json({ action: 'ignored', reason: 'min_interval_not_elapsed', attendance: att });
      }
    }

    // Already has both check-in and check-out for today
    // Update check-out time to latest capture (last capture for the day)
    let faceImagePath = null;
    if (faceImage) {
      const year = now.getFullYear().toString();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const monthFolder = `${month}${year}`;
      const dateFolder = `${day}${month}${year}`;
      faceImagePath = `uploads/attendance/${year}/${monthFolder}/${dateFolder}/${faceImage.filename}`;
    }
    const confidence = confidenceScore ? parseFloat(confidenceScore) : null;
    
    const upd = await pool.query(
      'UPDATE attendance SET check_out_time = NOW(), check_out_face_image_path = $2, check_out_confidence_score = $3 WHERE attendance_id = $1 RETURNING *',
      [att.attendance_id, faceImagePath, confidence]
    );
    console.log(`Updated check-out time for staff ${staffId} on ${today} (last capture for the day) with face image: ${faceImagePath}`);
    return res.json({ action: 'checked_out_updated', attendance: upd.rows[0] });
    
  } catch (error) {
    console.error('Face event error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Export attendance data to Excel/CSV
router.get('/export', auth, async (req, res) => {
  try {
    const { startDate, endDate, staffId, dateFilter, format = 'excel' } = req.query;
    
    // Build query based on date filter
    let query = `
      SELECT a.attendance_id, a.staff_id, a.check_in_time, a.check_out_time, a.date, a.status,
             a.created_at, a.check_in_face_image_path, a.check_out_face_image_path,
             a.check_in_confidence_score, a.check_out_confidence_score,
             a.attendance_notes, a.late_arrival_minutes, a.early_departure_minutes,
             a.break_time_duration, a.work_from_home,
             s.full_name, s.department, s.designation, s.email, s.work_status,
             s.manager_name, s.project_code, s.supervisor_name, s.break_time_minutes, s.overtime_enabled,
             CASE 
               -- Leave days should have 0 hours
               WHEN a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave') 
                    OR (a.check_in_time::time = '00:00:00'::time AND a.check_out_time::time = '00:00:00'::time) THEN
                 '00:00'
               WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
                 CASE 
                   WHEN (a.check_out_time - a.check_in_time) > INTERVAL '4 hours 30 minutes' THEN
                     TO_CHAR((a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30), 'HH24:MI')
                   ELSE
                     TO_CHAR((a.check_out_time - a.check_in_time), 'HH24:MI')
                 END
               ELSE NULL
             END as total_hours,
             CASE 
               -- Leave days should have 0 day hours
               WHEN a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave') 
                    OR (a.check_in_time::time = '00:00:00'::time AND a.check_out_time::time = '00:00:00'::time) THEN
                 '00:00'
               WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
                 CASE 
                   WHEN (a.check_out_time - a.check_in_time) > INTERVAL '4 hours 30 minutes' THEN
                     CASE 
                       WHEN (a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30) <= INTERVAL '8 hours' THEN
                         TO_CHAR((a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30), 'HH24:MI')
                       ELSE '08:00'
                     END
                   ELSE
                     CASE 
                       WHEN (a.check_out_time - a.check_in_time) <= INTERVAL '8 hours' THEN
                         TO_CHAR((a.check_out_time - a.check_in_time), 'HH24:MI')
                       ELSE '08:00'
                     END
                 END
               ELSE NULL
             END as day_hours,
             CASE 
               -- Leave days should have 0 overtime hours
               WHEN a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave') 
                    OR (a.check_in_time::time = '00:00:00'::time AND a.check_out_time::time = '00:00:00'::time) THEN
                 '00:00'
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
      FROM attendance a
      JOIN staff s ON s.staff_id = a.staff_id
    `;
    
    const conditions = [];
    const params = [];
    
    // Apply date filters
    if (dateFilter === 'current_month') {
      // Use database timezone for accurate month calculation
      const monthQuery = await pool.query(`
        SELECT 
          DATE_TRUNC('month', CURRENT_DATE) as first_day,
          (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day') as last_day
      `);
      const firstDay = monthQuery.rows[0].first_day;
      const lastDay = monthQuery.rows[0].last_day;
      conditions.push(`a.date >= $${params.length + 1} AND a.date <= $${params.length + 2}`);
      params.push(firstDay);
      params.push(lastDay);
    } else if (dateFilter === 'last_month') {
      // Use database timezone for accurate month calculation
      const monthQuery = await pool.query(`
        SELECT 
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') as first_day,
          (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day') as last_day
      `);
      const firstDay = monthQuery.rows[0].first_day;
      const lastDay = monthQuery.rows[0].last_day;
      conditions.push(`a.date >= $${params.length + 1} AND a.date <= $${params.length + 2}`);
      params.push(firstDay);
      params.push(lastDay);
    } else if (startDate && endDate) {
      conditions.push(`a.date >= $${params.length + 1} AND a.date <= $${params.length + 2}`);
      params.push(startDate);
      params.push(endDate);
    }
    
    // Apply staff filter
    if (staffId) {
      conditions.push(`a.staff_id = $${params.length + 1}`);
      params.push(staffId);
    } else if (req.user?.role !== 'admin') {
      // Non-admins can only export their own data
      const userStaffRes = await pool.query('SELECT staff_id FROM users WHERE user_id = $1', [req.user.userId]);
      const userStaffId = userStaffRes.rows?.[0]?.staff_id;
      if (userStaffId) {
        conditions.push(`a.staff_id = $${params.length + 1}`);
        params.push(userStaffId);
      }
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY a.date DESC, a.check_in_time DESC`;
    
    const result = await pool.query(query, params);
    const attendanceData = result.rows;
    
    if (format === 'csv') {
      // Generate CSV
      const csvData = attendanceData.map(record => ({
        'Date': record.date,
        'Staff ID': record.staff_id,
        'Staff Name': record.full_name,
        'Department': record.department,
        'Designation': record.designation,
        'Email': record.email,
        'Work Status': record.work_status || '',
        'Manager Name': record.manager_name || '',
        'Supervisor Name': record.supervisor_name || '',
        'Project Code': record.project_code || '',
        'Check In Time': record.check_in_time ? new Date(record.check_in_time).toLocaleString() : '',
        'Check Out Time': record.check_out_time ? new Date(record.check_out_time).toLocaleString() : '',
        'Total Hours': record.total_hours || '',
        'Day Hours': record.day_hours || '',
        'Overtime Hours': record.overtime_hours || '',
        'Late Arrival (min)': record.late_arrival_minutes || 0,
        'Early Departure (min)': record.early_departure_minutes || 0,
        'Break Time (min)': record.break_time_duration || 0,
        'Work From Home': record.work_from_home ? 'Yes' : 'No',
        'Overtime Enabled': record.overtime_enabled ? 'Yes' : 'No',
        'Attendance Notes': record.attendance_notes || '',
        'Status': record.status,
        'Check In Confidence': record.check_in_confidence_score ? `${(record.check_in_confidence_score * 100).toFixed(1)}%` : '',
        'Check Out Confidence': record.check_out_confidence_score ? `${(record.check_out_confidence_score * 100).toFixed(1)}%` : '',
        'Has Check In Photo': record.check_in_face_image_path ? 'Yes' : 'No',
        'Has Check Out Photo': record.check_out_face_image_path ? 'Yes' : 'No',
        'Created At': new Date(record.created_at).toLocaleString()
      }));
      
      // Create CSV string - handle empty data case
      if (csvData.length === 0) {
        const headers = ['Date', 'Staff ID', 'Staff Name', 'Department', 'Designation', 'Email', 'Work Status', 'Manager Name', 'Supervisor Name', 'Project Code', 'Check In Time', 'Check Out Time', 'Total Hours', 'Day Hours', 'Overtime Hours', 'Late Arrival (min)', 'Early Departure (min)', 'Break Time (min)', 'Work From Home', 'Overtime Enabled', 'Attendance Notes', 'Status', 'Check In Confidence', 'Check Out Confidence', 'Has Check In Photo', 'Has Check Out Photo', 'Created At'];
        const csvContent = headers.join(',') + '\n';
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.csv"');
        res.send(csvContent);
      } else {
        const headers = Object.keys(csvData[0]);
        const csvContent = [
          headers.join(','),
          ...csvData.map(row => headers.map(header => {
            const value = row[header] || '';
            // Escape quotes and wrap in quotes
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(','))
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.csv"');
        res.send(csvContent);
      }
      
    } else {
      // Generate Excel with Summary Statistics
      
      // Helper function to convert HH:MM to decimal hours
      const hhmmToDecimal = (hhmm) => {
        if (!hhmm || hhmm === '00:00') return 0;
        const [hours, minutes] = hhmm.split(':').map(Number);
        return hours + (minutes / 60);
      };
      
      // Helper function to convert decimal hours to HH:MM format
      const decimalToHHMM = (decimalHours) => {
        if (!decimalHours || decimalHours === 0) return '00:00';
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      };
      
      // Calculate overall summary statistics
      const overallSummary = {
        totalDaysWorked: attendanceData.filter(a => {
          // Exclude leave days from days worked count
          // Leave days have status as leave types or total_hours as '00:00'
          const isLeaveStatus = a.status && ['casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave'].includes(a.status);
          const isZeroHours = a.total_hours === '00:00' || !a.total_hours;
          // Count as worked if total_hours exists, is not '00:00', and status is not a leave type
          return a.total_hours && !isZeroHours && !isLeaveStatus;
        }).length,
        totalHours: attendanceData.reduce((sum, a) => sum + hhmmToDecimal(a.total_hours), 0),
        totalRegularHours: attendanceData.reduce((sum, a) => sum + hhmmToDecimal(a.day_hours), 0),
        totalOvertimeHours: attendanceData.reduce((sum, a) => sum + hhmmToDecimal(a.overtime_hours), 0),
        totalLateMinutes: attendanceData.reduce((sum, a) => sum + (parseInt(a.late_arrival_minutes) || 0), 0),
        totalWFHDays: attendanceData.filter(a => a.work_from_home).length
      };
      
      // Calculate individual staff summaries
      const staffSummaries = {};
      attendanceData.forEach(record => {
        if (!staffSummaries[record.staff_id]) {
          staffSummaries[record.staff_id] = {
            staffId: record.staff_id,
            staffName: record.full_name,
            department: record.department,
            designation: record.designation,
            workStatus: record.work_status || '',
            daysWorked: 0,
            totalHours: 0,
            regularHours: 0,
            overtimeHours: 0,
            lateMinutes: 0,
            wfhDays: 0
          };
        }
        
        const summary = staffSummaries[record.staff_id];
        // Exclude leave days from days worked count
        // Leave days have status as leave types or total_hours as '00:00'
        const isLeaveStatus = record.status && ['casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave'].includes(record.status);
        const isZeroHours = record.total_hours === '00:00' || !record.total_hours;
        // Count as worked if total_hours exists, is not '00:00', and status is not a leave type
        if (record.total_hours && !isZeroHours && !isLeaveStatus) {
          summary.daysWorked++;
        }
        summary.totalHours += hhmmToDecimal(record.total_hours);
        summary.regularHours += hhmmToDecimal(record.day_hours);
        summary.overtimeHours += hhmmToDecimal(record.overtime_hours);
        summary.lateMinutes += parseInt(record.late_arrival_minutes) || 0;
        if (record.work_from_home) summary.wfhDays++;
      });
      
      // Convert staff summaries object to array
      const staffSummaryArray = Object.values(staffSummaries).map(summary => ({
        'Staff ID': summary.staffId,
        'Staff Name': summary.staffName,
        'Department': summary.department,
        'Designation': summary.designation,
        'Work Status': summary.workStatus,
        'Days Worked': summary.daysWorked,
        'Total Hours': decimalToHHMM(summary.totalHours),
        'Regular Hours': decimalToHHMM(summary.regularHours),
        'Overtime Hours': decimalToHHMM(summary.overtimeHours),
        'Late Minutes': summary.lateMinutes,
        'Work From Home Days': summary.wfhDays
      }));
      
      // Create overall summary data for Excel
      const overallSummaryData = [
        { 'Metric': 'Total Days Worked', 'Value': overallSummary.totalDaysWorked },
        { 'Metric': 'Total Hours', 'Value': decimalToHHMM(overallSummary.totalHours) },
        { 'Metric': 'Total Regular Hours', 'Value': decimalToHHMM(overallSummary.totalRegularHours) },
        { 'Metric': 'Total Overtime Hours', 'Value': decimalToHHMM(overallSummary.totalOvertimeHours) },
        { 'Metric': 'Total Late Minutes', 'Value': overallSummary.totalLateMinutes },
        { 'Metric': 'Total Work From Home Days', 'Value': overallSummary.totalWFHDays }
      ];
      
      // Create detailed attendance data
      const excelData = attendanceData.map(record => ({
        'Date': record.date,
        'Staff ID': record.staff_id,
        'Staff Name': record.full_name,
        'Department': record.department,
        'Designation': record.designation,
        'Email': record.email,
        'Work Status': record.work_status || '',
        'Manager Name': record.manager_name || '',
        'Supervisor Name': record.supervisor_name || '',
        'Project Code': record.project_code || '',
        'Check In Time': record.check_in_time ? new Date(record.check_in_time).toLocaleString() : '',
        'Check Out Time': record.check_out_time ? new Date(record.check_out_time).toLocaleString() : '',
        'Total Hours': record.total_hours || '',
        'Day Hours': record.day_hours || '',
        'Overtime Hours': record.overtime_hours || '',
        'Late Arrival (min)': record.late_arrival_minutes || 0,
        'Early Departure (min)': record.early_departure_minutes || 0,
        'Break Time (min)': record.break_time_duration || 0,
        'Work From Home': record.work_from_home ? 'Yes' : 'No',
        'Overtime Enabled': record.overtime_enabled ? 'Yes' : 'No',
        'Attendance Notes': record.attendance_notes || '',
        'Status': record.status,
        'Check In Confidence': record.check_in_confidence_score ? `${(record.check_in_confidence_score * 100).toFixed(1)}%` : '',
        'Check Out Confidence': record.check_out_confidence_score ? `${(record.check_out_confidence_score * 100).toFixed(1)}%` : '',
        'Has Check In Photo': record.check_in_face_image_path ? 'Yes' : 'No',
        'Has Check Out Photo': record.check_out_face_image_path ? 'Yes' : 'No',
        'Created At': new Date(record.created_at).toLocaleString()
      }));
      
      try {
        const workbook = XLSX.utils.book_new();
        
        // Create "Overall Summary" sheet
        const overallSummarySheet = XLSX.utils.json_to_sheet(overallSummaryData);
        XLSX.utils.book_append_sheet(workbook, overallSummarySheet, 'Overall Summary');
        
        // Create "Staff Summary" sheet
        const staffSummarySheet = XLSX.utils.json_to_sheet(staffSummaryArray);
        XLSX.utils.book_append_sheet(workbook, staffSummarySheet, 'Staff Summary');
        
        // Create "Detailed Attendance" sheet
        const detailedSheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detailed Attendance');
        
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.xlsx"');
        res.send(excelBuffer);
      } catch (xlsxError) {
        console.error('XLSX generation error:', xlsxError);
        res.status(500).json({ message: 'Excel generation failed', error: xlsxError.message });
      }
    }
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

module.exports = router;
