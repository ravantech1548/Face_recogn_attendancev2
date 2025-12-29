require('dotenv').config();
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
const { getDBTimezone } = require('../config/timezone');
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
      
      // Use custom datetime if provided, otherwise use local system timezone
      let checkInTime, dateStr;
      if (customDateTime) {
        checkInTime = new Date(customDateTime);
        dateStr = checkInTime.toISOString().slice(0, 10);
      } else {
        // Use timezone from .env configuration
        const timezone = getDBTimezone();
        const timeRes = await pool.query(`
          SELECT 
            NOW() AT TIME ZONE $1 AS now,
            (NOW() AT TIME ZONE $1)::date AS today
        `, [timezone]);
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
      
      // Use custom datetime if provided, otherwise use local system timezone
      let checkOutTime, dateStr;
      if (customDateTime) {
        checkOutTime = new Date(customDateTime);
        dateStr = checkOutTime.toISOString().slice(0, 10);
      } else {
        // Use timezone from .env configuration
        const timezone = getDBTimezone();
        const timeRes = await pool.query(`
          SELECT 
            NOW() AT TIME ZONE $1 AS now,
            (NOW() AT TIME ZONE $1)::date AS today
        `, [timezone]);
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
    
    // Get current time and date using timezone from .env
    const timezone = getDBTimezone();
    const nowUpdateRes = await pool.query(`
      SELECT 
        NOW() AT TIME ZONE $1 AS now,
        (NOW() AT TIME ZONE $1)::date AS today,
        CURRENT_DATE AS today_db,
        CURRENT_TIMESTAMP AT TIME ZONE $1 AS server_timestamp
    `, [timezone]);
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
      
      const dbTimezone = getDBTimezone();
      const insertRes = await pool.query(
        `INSERT INTO attendance (staff_id, check_in_time, date, status, check_in_face_image_path, check_in_confidence_score)
         VALUES ($1, (NOW() AT TIME ZONE $5), $2, 'present', $3, $4) RETURNING *`,
        [staffId, today, faceImagePath, confidence, dbTimezone]
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
        
        const dbTimezone = getDBTimezone();
        const upd = await pool.query(
          `UPDATE attendance 
           SET check_out_time = (NOW() AT TIME ZONE $4), 
               check_out_face_image_path = $2, 
               check_out_confidence_score = $3 
           WHERE attendance_id = $1 RETURNING *`,
          [att.attendance_id, faceImagePath, confidence, dbTimezone]
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
    
    const dbTimezone = getDBTimezone();
    const upd = await pool.query(
      `UPDATE attendance 
       SET check_out_time = (NOW() AT TIME ZONE $4), 
           check_out_face_image_path = $2, 
           check_out_confidence_score = $3 
       WHERE attendance_id = $1 RETURNING *`,
      [att.attendance_id, faceImagePath, confidence, dbTimezone]
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
      // Use timezone from .env for accurate month calculation
      const timezone = getDBTimezone();
      const monthQuery = await pool.query(`
        SELECT 
          DATE_TRUNC('month', (NOW() AT TIME ZONE $1))::date as first_day,
          (DATE_TRUNC('month', (NOW() AT TIME ZONE $1)) + INTERVAL '1 month' - INTERVAL '1 day')::date as last_day
      `, [timezone]);
      const firstDay = monthQuery.rows[0].first_day;
      const lastDay = monthQuery.rows[0].last_day;
      conditions.push(`a.date >= $${params.length + 1} AND a.date <= $${params.length + 2}`);
      params.push(firstDay);
      params.push(lastDay);
    } else if (dateFilter === 'last_month') {
      // Use timezone from .env for accurate month calculation
      const timezone = getDBTimezone();
      const monthQuery = await pool.query(`
        SELECT 
          DATE_TRUNC('month', ((NOW() AT TIME ZONE $1) - INTERVAL '1 month'))::date as first_day,
          (DATE_TRUNC('month', (NOW() AT TIME ZONE $1)) - INTERVAL '1 day')::date as last_day
      `, [timezone]);
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

// Debug endpoint to test calendar data
router.get('/calendar-view/debug', auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ message: 'year and month are required' });
    }
    
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    // Check calendar table
    const calendarCheck = await pool.query(
      `SELECT COUNT(*) as count FROM dim_calendar 
       WHERE calendar_date >= $1 AND calendar_date <= $2`,
      [startDate, endDate]
    );
    
    // Check attendance records
    const attendanceCheck = await pool.query(
      `SELECT 
        date, 
        status, 
        COUNT(*) as record_count,
        COUNT(DISTINCT staff_id) as staff_count,
        array_agg(DISTINCT staff_id) as staff_ids
      FROM attendance 
      WHERE date >= $1 AND date <= $2
      GROUP BY date, status
      ORDER BY date, status`,
      [startDate, endDate]
    );
    
    // Check staff
    const staffCheck = await pool.query(
      `SELECT COUNT(*) as count FROM staff WHERE is_active = TRUE`
    );
    
    // Test a specific date query
    const testDate = startDate;
    const testQuery = await pool.query(
      `SELECT 
        a.date,
        a.staff_id,
        a.status,
        s.full_name,
        s.is_active
      FROM attendance a
      JOIN staff s ON a.staff_id = s.staff_id
      WHERE a.date = $1
      LIMIT 10`,
      [testDate]
    );
    
    res.json({
      dateRange: { startDate, endDate },
      calendarDays: calendarCheck.rows[0]?.count || 0,
      activeStaff: staffCheck.rows[0]?.count || 0,
      attendanceRecords: attendanceCheck.rows,
      testDateQuery: {
        date: testDate,
        records: testQuery.rows
      },
      summary: {
        totalAttendanceRecords: attendanceCheck.rows.reduce((sum, r) => sum + parseInt(r.record_count), 0),
        uniqueDates: attendanceCheck.rows.length,
        statusBreakdown: attendanceCheck.rows.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + parseInt(r.record_count);
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ message: 'Debug error', error: error.message, stack: error.stack });
  }
});

// Get calendar view attendance summary for a month
router.get('/calendar-view', auth, async (req, res) => {
  try {
    const { year, month, staffId } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ message: 'year and month are required' });
    }
    
    // Calculate first and last day of the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    console.log('Calendar View Request:', { year, month, startDate, endDate, staffId });
    
    // Build query parameters
    const params = [startDate, endDate];
    let staffFilterCondition = '';
    let staffIdParam = null;
    
    // Non-admins can only query their own records
    if (req.user?.role !== 'admin') {
      const ures = await pool.query('SELECT staff_id FROM users WHERE user_id = $1', [req.user.userId]);
      const ownStaffId = ures.rows?.[0]?.staff_id || null;
      if (ownStaffId) {
        staffIdParam = ownStaffId;
        staffFilterCondition = `AND s.staff_id = $3`;
        params.push(ownStaffId);
      }
    } else if (staffId) {
      staffIdParam = staffId;
      staffFilterCondition = `AND s.staff_id = $3`;
      params.push(staffId);
    }
    
    console.log('Query params:', params);
    console.log('Staff filter:', staffFilterCondition);
    
    // Debug: Check if we have attendance data for this staff and date range
    if (staffIdParam) {
      const debugQuery = await pool.query(
        `SELECT date, status, COUNT(*) as count
         FROM attendance 
         WHERE staff_id = $1 AND date >= $2 AND date <= $3
         GROUP BY date, status
         ORDER BY date
         LIMIT 10`,
        [staffIdParam, startDate, endDate]
      );
      console.log('Debug - Attendance records for staff', staffIdParam, ':', debugQuery.rows.length, 'records');
      if (debugQuery.rows.length > 0) {
        console.log('Sample records:', debugQuery.rows.slice(0, 5));
      }
    }
    
    // Query to get month summary with calendar integration
    // Using JOIN approach for better performance and reliability
    const summaryQuery = `
      SELECT 
        TO_CHAR(c.calendar_date, 'YYYY-MM-DD') AS date,
        c.day_name,
        c.is_weekend,
        c.is_public_holiday,
        c.holiday_name,
        -- Count present: count distinct staff with status='present' for this date
        COUNT(DISTINCT CASE 
          WHEN a.attendance_id IS NOT NULL 
               AND a.status = 'present' 
               AND s.is_active = TRUE
          THEN a.staff_id 
        END) AS total_present,
        -- Count leave: count distinct staff with leave status for this date
        COUNT(DISTINCT CASE 
          WHEN a.attendance_id IS NOT NULL 
               AND a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave')
               AND s.is_active = TRUE
          THEN a.staff_id 
        END) AS total_leave,
        -- Count absent: staff with no attendance on working days
        COUNT(DISTINCT CASE 
          WHEN a.attendance_id IS NULL 
               AND s.is_active = TRUE
               AND c.is_weekend = FALSE 
               AND c.is_public_holiday = FALSE
          THEN s.staff_id 
        END) AS total_absent,
        -- Count OT days
        COUNT(DISTINCT CASE 
          WHEN a.attendance_id IS NOT NULL
               AND a.status = 'present'
               AND a.check_in_time IS NOT NULL 
               AND a.check_out_time IS NOT NULL
               AND s.overtime_enabled = TRUE
               AND a.check_out_time::time > (
                 (COALESCE(s.work_end_time, '17:45:00')::time + 
                  INTERVAL '1 minute' * COALESCE(s.ot_threshold_minutes, 30))
               )
               AND s.is_active = TRUE
          THEN a.staff_id 
        END) AS total_ot_days,
        -- Sum OT hours
        COALESCE(SUM(
          CASE 
            WHEN a.attendance_id IS NOT NULL
                 AND a.status = 'present'
                 AND a.check_in_time IS NOT NULL 
                 AND a.check_out_time IS NOT NULL
                 AND s.overtime_enabled = TRUE
                 AND a.check_out_time::time > (
                   (COALESCE(s.work_end_time, '17:45:00')::time + 
                    INTERVAL '1 minute' * COALESCE(s.ot_threshold_minutes, 30))
                 )
                 AND s.is_active = TRUE
            THEN EXTRACT(EPOCH FROM (a.check_out_time::time - COALESCE(s.work_end_time, '17:45:00')::time)) / 3600
            ELSE 0
          END
        ), 0) AS total_ot_hours
      FROM dim_calendar c
      CROSS JOIN staff s
      LEFT JOIN attendance a ON c.calendar_date::date = a.date::date AND s.staff_id = a.staff_id
      WHERE c.calendar_date >= $1::date AND c.calendar_date <= $2::date
        AND s.is_active = TRUE
        ${staffFilterCondition}
      GROUP BY c.calendar_date, c.day_name, c.is_weekend, c.is_public_holiday, c.holiday_name
      ORDER BY c.calendar_date
    `;
    
    // Check if dim_calendar table exists first
    try {
      const tableCheck = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'dim_calendar'
        )`
      );
      
      if (!tableCheck.rows[0].exists) {
        return res.status(404).json({ 
          message: 'Calendar table not found. Please run database migrations.',
          hint: 'Run: cd backend && node scripts/run_all_migration.js'
        });
      }
    } catch (checkError) {
      console.error('Table check error:', checkError);
      // Continue anyway, let the main query fail with a better error
    }
    
    // Debug: Check if we have attendance data for this date range (with staff filter if applicable)
    const debugParams = [startDate, endDate];
    const debugStaffFilter = staffIdParam ? `AND staff_id = $3` : '';
    if (staffIdParam) {
      debugParams.push(staffIdParam);
    }
    const debugQuery = await pool.query(
      `SELECT 
        date, 
        status, 
        COUNT(*) as count,
        COUNT(DISTINCT staff_id) as staff_count,
        array_agg(DISTINCT staff_id) FILTER (WHERE status = 'present') as present_staff,
        array_agg(DISTINCT staff_id) FILTER (WHERE status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave')) as leave_staff
      FROM attendance 
      WHERE date >= $1::date AND date <= $2::date
        ${debugStaffFilter}
      GROUP BY date, status
      ORDER BY date, status
      LIMIT 20`,
      debugParams
    );
    
    // Test a specific date to see if the subquery works
    const testDateResult = await pool.query(
      `SELECT 
        c.calendar_date,
        (SELECT COUNT(DISTINCT a.staff_id)
         FROM attendance a
         INNER JOIN staff s ON a.staff_id = s.staff_id
         WHERE a.date::date = c.calendar_date
           AND a.status = 'present'
           AND s.is_active = TRUE
           ${staffFilterCondition}
        ) AS test_present
      FROM dim_calendar c
      WHERE c.calendar_date >= $1::date AND c.calendar_date <= $2::date
      ORDER BY c.calendar_date
      LIMIT 5`,
      params
    );
    
    console.log('=== Calendar View Debug ===');
    console.log('Date Range:', { startDate, endDate });
    console.log('Params:', params);
    console.log('Staff Filter:', staffFilterCondition);
    console.log('Attendance Records Found:', debugQuery.rows.length);
    console.log('Sample Attendance:', debugQuery.rows.slice(0, 5));
    console.log('Test Date Query Result:', testDateResult.rows);
    
    const summaryResult = await pool.query(summaryQuery, params);
    
    console.log('Summary Result Count:', summaryResult.rows.length);
    console.log('Sample Summary (first 5 days):', summaryResult.rows.slice(0, 5).map(r => ({
      date: r.date,
      day: r.day_name,
      present: r.total_present,
      leave: r.total_leave,
      absent: r.total_absent,
      is_weekend: r.is_weekend,
      is_holiday: r.is_public_holiday
    })));
    
    // Find days with data
    const daysWithData = summaryResult.rows.filter(r => 
      parseInt(r.total_present) > 0 || 
      parseInt(r.total_leave) > 0 || 
      parseInt(r.total_absent) > 0
    );
    console.log('Days with data:', daysWithData.length);
    if (daysWithData.length > 0) {
      console.log('Sample days with data:', daysWithData.slice(0, 3));
    }
    
    res.json({
      summary: summaryResult.rows,
      month: parseInt(month),
      year: parseInt(year),
      startDate,
      endDate,
      debug: {
        attendanceSample: debugQuery.rows,
        testDateQuery: testDateResult.rows,
        daysWithData: daysWithData.length,
        totalDays: summaryResult.rows.length
      }
    });
  } catch (error) {
    console.error('Calendar view error:', error);
    // Check if it's a table doesn't exist error
    if (error.message && (error.message.includes('does not exist') || (error.message.includes('relation') && error.message.includes('dim_calendar')))) {
      return res.status(404).json({ 
        message: 'Calendar table not found. Please run database migrations.',
        error: error.message,
        hint: 'Run: cd backend && node scripts/run_all_migration.js'
      });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export calendar view to Excel/CSV - MUST be before /calendar-view/:date route
router.get('/calendar-view/export', auth, async (req, res) => {
  try {
    console.log('=== Calendar Export Request ===');
    const { year, month, staffId, format = 'excel' } = req.query;
    console.log('Export params:', { year, month, staffId, format });
    
    if (!year || !month) {
      return res.status(400).json({ message: 'year and month are required' });
    }
    
    // Calculate first and last day of the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    console.log('Date range:', { startDate, endDate });
    
    const params = [startDate, endDate];
    let staffFilter = '';
    
    // Non-admins can only query their own records
    if (req.user?.role !== 'admin') {
      const ures = await pool.query('SELECT staff_id FROM users WHERE user_id = $1', [req.user.userId]);
      const ownStaffId = ures.rows?.[0]?.staff_id || null;
      if (ownStaffId) {
        params.push(ownStaffId);
        staffFilter = `AND s.staff_id = $${params.length}`;
        console.log('Non-admin filter applied:', ownStaffId);
      }
    } else if (staffId && staffId !== '') {
      // Only add staff filter if staffId is provided and not empty
      params.push(staffId);
      staffFilter = `AND s.staff_id = $${params.length}`;
      console.log('Staff filter applied:', staffId);
    }
    
    console.log('Query params:', params);
    console.log('Staff filter condition:', staffFilter || '(none)');
    
    // Check if dim_calendar table exists first
    try {
      const tableCheck = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'dim_calendar'
        )`
      );
      
      if (!tableCheck.rows[0].exists) {
        return res.status(404).json({ 
          message: 'Calendar table not found. Please run database migrations.',
          hint: 'Run: cd backend && node scripts/run_all_migration.js'
        });
      }
    } catch (checkError) {
      console.error('Table check error:', checkError);
    }
    
    // Get calendar summary - using same query structure as main calendar view
    const summaryQuery = `
      SELECT 
        TO_CHAR(c.calendar_date, 'YYYY-MM-DD') AS date,
        c.day_name,
        c.is_weekend,
        c.is_public_holiday,
        c.holiday_name,
        COUNT(DISTINCT CASE 
          WHEN a.attendance_id IS NOT NULL 
               AND a.status = 'present' 
               AND s.is_active = TRUE
          THEN a.staff_id 
        END) AS total_present,
        COUNT(DISTINCT CASE 
          WHEN a.attendance_id IS NOT NULL 
               AND a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave')
               AND s.is_active = TRUE
          THEN a.staff_id 
        END) AS total_leave,
        COUNT(DISTINCT CASE 
          WHEN a.attendance_id IS NULL 
               AND s.is_active = TRUE
               AND c.is_weekend = FALSE 
               AND c.is_public_holiday = FALSE
          THEN s.staff_id 
        END) AS total_absent
      FROM dim_calendar c
      CROSS JOIN staff s
      LEFT JOIN attendance a ON c.calendar_date::date = a.date::date AND s.staff_id = a.staff_id
      WHERE c.calendar_date >= $1::date AND c.calendar_date <= $2::date
        AND s.is_active = TRUE
        ${staffFilter}
      GROUP BY c.calendar_date, c.day_name, c.is_weekend, c.is_public_holiday, c.holiday_name
      ORDER BY c.calendar_date
    `;
    
    console.log('Executing export query...');
    console.log('Query:', summaryQuery.substring(0, 200) + '...');
    let summaryResult;
    try {
      summaryResult = await pool.query(summaryQuery, params);
      console.log('Query executed successfully. Rows returned:', summaryResult.rows.length);
    } catch (queryError) {
      console.error('Query execution failed:', queryError);
      console.error('Query error details:', {
        message: queryError.message,
        code: queryError.code,
        detail: queryError.detail,
        hint: queryError.hint,
        position: queryError.position
      });
      throw queryError;
    }
    
    if (summaryResult.rows.length === 0) {
      console.log('No data found for export');
      return res.status(404).json({ message: 'No data found for the selected month' });
    }
    
    console.log('Processing export data for format:', format);
    
    if (format === 'csv') {
      console.log('Preparing CSV data...');
      try {
        const csvData = summaryResult.rows.map(row => ({
          'Date': String(row.date || ''),
          'Day': String(row.day_name || ''),
          'Is Weekend': row.is_weekend ? 'Yes' : 'No',
          'Is Holiday': row.is_public_holiday ? 'Yes' : 'No',
          'Holiday Name': String(row.holiday_name || ''),
          'Total Present': parseInt(row.total_present) || 0,
          'Total Leave': parseInt(row.total_leave) || 0,
          'Total Absent': parseInt(row.total_absent) || 0
        }));
        
        console.log('CSV data prepared, rows:', csvData.length);
        
        if (csvData.length === 0) {
          console.log('No CSV data to export');
          return res.status(404).json({ message: 'No data to export' });
        }
        
        const headers = Object.keys(csvData[0]);
        const csvContent = [
          headers.join(','),
          ...csvData.map(row => headers.map(header => {
            const value = row[header] || '';
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(','))
        ].join('\n');
        
        console.log('CSV content generated, length:', csvContent.length);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="calendar_attendance_${year}_${month}.csv"`);
        res.send(csvContent);
        console.log('CSV export completed successfully');
      } catch (csvError) {
        console.error('CSV generation error:', csvError);
        console.error('CSV error stack:', csvError.stack);
        throw csvError;
      }
    } else {
      // Excel format
      console.log('Preparing Excel data...');
      try {
        const excelData = summaryResult.rows.map(row => {
          // Ensure all values are properly converted
          return {
            'Date': String(row.date || ''),
            'Day': String(row.day_name || ''),
            'Is Weekend': row.is_weekend ? 'Yes' : 'No',
            'Is Holiday': row.is_public_holiday ? 'Yes' : 'No',
            'Holiday Name': String(row.holiday_name || ''),
            'Total Present': parseInt(row.total_present) || 0,
            'Total Leave': parseInt(row.total_leave) || 0,
            'Total Absent': parseInt(row.total_absent) || 0
          };
        });
        
        console.log('Excel data prepared, rows:', excelData.length);
        console.log('Sample Excel data:', excelData.slice(0, 2));
        
        if (excelData.length === 0) {
          console.log('No Excel data to export');
          return res.status(404).json({ message: 'No data to export' });
        }
        
        console.log('Creating Excel workbook...');
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Calendar Attendance');
        
        console.log('Writing Excel buffer...');
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        if (!excelBuffer || excelBuffer.length === 0) {
          console.error('Excel buffer is empty!');
          return res.status(500).json({ message: 'Failed to generate Excel file' });
        }
        
        console.log('Sending Excel file, size:', excelBuffer.length, 'bytes');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="calendar_attendance_${year}_${month}.xlsx"`);
        res.send(excelBuffer);
        console.log('Excel export completed successfully');
      } catch (excelError) {
        console.error('Excel generation error:', excelError);
        console.error('Excel error stack:', excelError.stack);
        throw excelError;
      }
    }
  } catch (error) {
    console.error('=== Calendar Export Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position
    });
    
    // Check if response has already been sent
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Failed to export calendar data', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      console.error('Response already sent, cannot send error response');
    }
  }
});

// Get detailed staff summary report (staff-centric calendar view)
// MUST be before /calendar-view/:date route to avoid route conflict
router.get('/calendar-view/detailed-summary', auth, async (req, res) => {
  let errorStep = 'initialization';
  try {
    console.log('=== Detailed Summary Export Request ===');
    const { year, month, staffId, format = 'json' } = req.query;
    console.log('Export params:', { year, month, staffId, format });
    
    if (!year || !month) {
      return res.status(400).json({ message: 'year and month are required' });
    }
    
    errorStep = 'date_calculation';
    // Calculate first and last day of the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    console.log('Date range:', { startDate, endDate, lastDay });
    
    errorStep = 'user_authorization';
    const params = [startDate, endDate];
    let staffFilter = '';
    
    // Non-admins can only query their own records
    if (req.user?.role !== 'admin') {
      try {
        const ures = await pool.query('SELECT staff_id FROM users WHERE user_id = $1', [req.user.userId]);
        const ownStaffId = ures.rows?.[0]?.staff_id || null;
        if (ownStaffId) {
          params.push(ownStaffId);
          staffFilter = `AND s.staff_id = $${params.length}`;
          console.log('Non-admin filter applied:', ownStaffId);
        }
      } catch (userError) {
        console.error('Error fetching user staff_id:', userError);
        throw new Error(`Failed to fetch user staff_id: ${userError.message}`);
      }
    } else if (staffId) {
      params.push(staffId);
      staffFilter = `AND s.staff_id = $${params.length}`;
      console.log('Staff filter applied:', staffId);
    }
    
    console.log('Query params:', params);
    console.log('Staff filter condition:', staffFilter || '(none)');
    
    errorStep = 'table_check';
    // Check if dim_calendar table exists
    let tableCheck;
    try {
      tableCheck = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'dim_calendar'
        )`
      );
    } catch (tableError) {
      console.error('Error checking calendar table:', tableError);
      throw new Error(`Failed to check calendar table: ${tableError.message}`);
    }
    
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ 
        message: 'Calendar table not found. Please run database migrations.',
        hint: 'Run: cd backend && node scripts/run_all_migration.js'
      });
    }
    
    errorStep = 'fetch_staff';
    // Get all active staff
    // Create a separate staff filter for the staff query (uses $1 instead of $3)
    const staffQueryFilter = staffFilter ? `AND staff_id = $1` : '';
    const staffQuery = `
      SELECT staff_id, full_name, department, designation
      FROM staff
      WHERE is_active = TRUE
      ${staffQueryFilter}
      ORDER BY full_name
    `;
    console.log('Fetching staff list...');
    // If staffFilter exists, use the staffId from params (which is at index 2)
    // Otherwise use empty array
    const staffParams = staffFilter ? [params[2]] : [];
    console.log('Staff query:', staffQuery);
    console.log('Staff query params:', staffParams);
    let staffResult;
    try {
      staffResult = await pool.query(staffQuery, staffParams);
      console.log('Staff count:', staffResult.rows.length);
    } catch (staffError) {
      console.error('Staff query error:', staffError);
      errorStep = 'fetch_staff_query';
      throw new Error(`Failed to fetch staff: ${staffError.message}`);
    }
    
    errorStep = 'fetch_calendar';
    // Get calendar info for the month
    const calendarQuery = `
      SELECT calendar_date, day_name, is_weekend, is_public_holiday, holiday_name,
             EXTRACT(DAY FROM calendar_date)::INTEGER AS day_number
      FROM dim_calendar
      WHERE calendar_date >= $1::date AND calendar_date <= $2::date
      ORDER BY calendar_date
    `;
    let calendarResult;
    try {
      calendarResult = await pool.query(calendarQuery, [startDate, endDate]);
      console.log('Calendar days fetched:', calendarResult.rows.length);
    } catch (calendarError) {
      console.error('Calendar query error:', calendarError);
      errorStep = 'fetch_calendar_query';
      throw new Error(`Failed to fetch calendar data: ${calendarError.message}`);
    }
    
    errorStep = 'fetch_attendance';
    // Get all attendance records for the month (match test script - no staffFilter in query)
    const attendanceQuery = `
      SELECT 
        a.staff_id,
        a.date,
        a.status,
        a.check_in_time,
        a.check_out_time,
        s.overtime_enabled,
        s.work_end_time,
        s.ot_threshold_minutes,
        s.break_time_minutes,
        CASE 
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
          WHEN a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave') 
               OR (a.check_in_time::time = '00:00:00'::time AND a.check_out_time::time = '00:00:00'::time) THEN
            '00:00'
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL 
               AND s.overtime_enabled = TRUE THEN
            CASE 
              WHEN a.check_out_time::time > (
                (COALESCE(s.work_end_time, '17:45:00')::time + 
                 INTERVAL '1 minute' * COALESCE(s.ot_threshold_minutes, 30))
              ) THEN
                TO_CHAR(a.check_out_time::time - COALESCE(s.work_end_time, '17:45:00')::time, 'HH24:MI')
              ELSE '00:00'
            END
          ELSE '00:00'
        END as overtime_hours
      FROM attendance a
      JOIN staff s ON s.staff_id = a.staff_id
      WHERE a.date >= $1::date AND a.date <= $2::date
        AND s.is_active = TRUE
      ORDER BY a.staff_id, a.date
    `;
    console.log('Fetching attendance records...');
    // Use only startDate and endDate for attendance query (match test script)
    const attendanceParams = [startDate, endDate];
    console.log('Attendance query params:', attendanceParams);
    let attendanceResult;
    try {
      attendanceResult = await pool.query(attendanceQuery, attendanceParams);
      console.log('Attendance records fetched:', attendanceResult.rows.length);
    } catch (attendanceError) {
      console.error('Attendance query error:', attendanceError);
      errorStep = 'fetch_attendance_query';
      throw new Error(`Failed to fetch attendance records: ${attendanceError.message}`);
    }
    
    // Create attendance map: staff_id -> date -> attendance record
    // Filter by staff if needed (match test script approach)
    const attendanceMap = {};
    let filteredAttendanceRows = attendanceResult.rows;
    
    // If staff filter is needed, filter in memory (like test script)
    if (staffFilter) {
      const filterStaffId = params[2]; // Get staffId from params
      filteredAttendanceRows = attendanceResult.rows.filter(row => row.staff_id === filterStaffId);
      console.log(`Filtered attendance records to ${filteredAttendanceRows.length} for staff ${filterStaffId}`);
    }
    
    filteredAttendanceRows.forEach(row => {
      if (!attendanceMap[row.staff_id]) {
        attendanceMap[row.staff_id] = {};
      }
      // Convert date to string for consistent lookup
      const dateKey = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
      attendanceMap[row.staff_id][dateKey] = row;
    });
    console.log('Attendance records processed:', filteredAttendanceRows.length);
    
    // Helper function to convert HH:MM to decimal hours
    const hhmmToDecimal = (hhmm) => {
      if (!hhmm || hhmm === '00:00') return 0;
      const [hours, minutes] = hhmm.split(':').map(Number);
      return hours + (minutes / 60);
    };
    
    errorStep = 'process_staff';
    // Process each staff member
    const reportData = [];
    let serialNumber = 1;
    
    console.log('Processing staff members...');
    for (const staff of staffResult.rows) {
      try {
        const staffAttendances = attendanceMap[staff.staff_id] || {};
        
        let totalWorkingDays = 0;
        let presentDays = 0;
        let absentDays = 0;
        let totalOTHours = 0;
        let sundayOTHours = 0;
        const dailyStatus = {};
        
        // Process each day in the month
        for (const calDay of calendarResult.rows) {
          try {
            const dayNum = calDay.day_number;
            // Skip if dayNum is invalid
            if (!dayNum || dayNum < 1 || dayNum > 31) {
              console.warn(`Invalid day number: ${dayNum} for staff ${staff.staff_id}`);
              continue;
            }
            // Convert date to string for consistent lookup
            let dateStr;
            if (calDay.calendar_date instanceof Date) {
              dateStr = calDay.calendar_date.toISOString().split('T')[0];
            } else if (typeof calDay.calendar_date === 'string') {
              dateStr = calDay.calendar_date.split('T')[0]; // Handle ISO strings
            } else {
              dateStr = String(calDay.calendar_date);
            }
            const attendance = staffAttendances[dateStr];
            const isWeekend = calDay.is_weekend;
            const isHoliday = calDay.is_public_holiday;
            
            // Determine if it's a working day
            const isWorkingDay = !isWeekend && !isHoliday;
            
            if (isWorkingDay) {
              totalWorkingDays++;
            }
            
            // Determine status for the day
            let status = '';
            if (isWeekend) {
              status = 'WO'; // Weekly Off
            } else if (isHoliday) {
              status = 'NH'; // National Holiday
            } else if (attendance) {
              if (attendance.status === 'present') {
                // Check if it's a half day based on total hours (less than 4 hours = half day)
                const totalHours = hhmmToDecimal(attendance.total_hours);
                if (totalHours > 0 && totalHours < 4) {
                  status = 'HD'; // Half Day
                  presentDays += 0.5;
                  absentDays += 0.5; // Half day counts as 0.5 absent
                } else {
                  status = 'P'; // Present
                  presentDays++;
                }
                
                // Calculate OT
                const otHours = hhmmToDecimal(attendance.overtime_hours);
                totalOTHours += otHours;
                
                // Check if it's Sunday and has OT
                if (calDay.day_name.trim().toLowerCase() === 'sunday' && otHours > 0) {
                  sundayOTHours += otHours;
                }
              } else if (attendance.status === 'casual_leave' || 
                         attendance.status === 'medical_leave' || 
                         attendance.status === 'unpaid_leave' || 
                         attendance.status === 'hospitalised_leave') {
                status = attendance.status.toUpperCase().substring(0, 2); // CL, ML, UL, HL
                absentDays += 1; // Leave counts as absent for working days
              } else {
                status = 'P'; // Default to present if status exists but not recognized
                presentDays++;
              }
            } else {
              // No attendance record on a working day = absent
              if (isWorkingDay) {
                status = 'A'; // Absent
                absentDays++;
              } else {
                status = isWeekend ? 'WO' : 'NH';
              }
            }
            
            dailyStatus[dayNum] = status;
          } catch (dayError) {
            console.error(`Error processing day ${calDay.day_number} for staff ${staff.staff_id}:`, dayError);
            // Continue with next day
          }
        }
        
        // Build row data
        const rowData = {
          sno: serialNumber++,
          staffId: staff.staff_id,
          name: staff.full_name,
          department: staff.department || '',
          totalWorkingDays: totalWorkingDays,
          absentDays: absentDays.toFixed(1),
          presentDays: presentDays.toFixed(1),
          otHours: totalOTHours.toFixed(2),
          sundayOTHours: sundayOTHours.toFixed(2),
          ...dailyStatus // Add all day columns (1-31)
        };
        
        reportData.push(rowData);
      } catch (staffError) {
        console.error(`Error processing staff ${staff.staff_id}:`, staffError);
        // Continue with next staff
      }
    }
    
    console.log('Staff processing completed, total rows:', reportData.length);
    
    errorStep = 'prepare_export';
    console.log('Report data prepared, rows:', reportData.length);
    
    // Ensure lastDay is available
    if (!lastDay || lastDay < 1 || lastDay > 31) {
      console.error('Invalid lastDay:', lastDay);
      throw new Error(`Invalid lastDay value: ${lastDay}`);
    }
    
    // If format is Excel or CSV, export it
    if (format === 'excel' || format === 'csv') {
      errorStep = 'export_format_check';
      if (reportData.length === 0) {
        console.log('No report data to export');
        return res.status(404).json({ message: 'No data found for the selected month' });
      }
      
      // Prepare export data
      console.log('Preparing export data...');
      console.log('Using lastDay:', lastDay);
      const exportData = reportData.map((row, index) => {
        try {
          // Ensure all base fields are properly formatted (no null/undefined)
          const exportRow = {
            'S.No': Number(row.sno) || (index + 1),
            'Staff ID': String(row.staffId || ''),
            'Name': String(row.name || ''),
            'Department': String(row.department || ''),
            'Total Working Days': Number(row.totalWorkingDays) || 0,
            'Absent Days': String(row.absentDays || '0.0'),
            'Present Days': String(row.presentDays || '0.0'),
            'OT Hours': String(row.otHours || '0.00'),
            'Sunday OT Hours': String(row.sundayOTHours || '0.00')
          };
          
          // Add day columns (1-31) - access numeric keys correctly
          // Ensure lastDay is valid
          const validLastDay = lastDay && lastDay >= 1 && lastDay <= 31 ? lastDay : 31;
          for (let day = 1; day <= validLastDay; day++) {
            // Access the day status - try both numeric and string key
            let dayStatus = '';
            if (row[day] !== undefined && row[day] !== null) {
              dayStatus = String(row[day]);
            } else if (row[String(day)] !== undefined && row[String(day)] !== null) {
              dayStatus = String(row[String(day)]);
            }
            exportRow[`Day ${day}`] = dayStatus;
          }
          
          return exportRow;
        } catch (rowError) {
          console.error(`Error processing row ${index}:`, rowError);
          // Return a minimal valid row to prevent export failure
          const fallbackRow = {
            'S.No': index + 1,
            'Staff ID': '',
            'Name': 'Error processing row',
            'Department': '',
            'Total Working Days': 0,
            'Absent Days': '0.0',
            'Present Days': '0.0',
            'OT Hours': '0.00',
            'Sunday OT Hours': '0.00'
          };
          const validLastDay = lastDay && lastDay >= 1 && lastDay <= 31 ? lastDay : 31;
          for (let day = 1; day <= validLastDay; day++) {
            fallbackRow[`Day ${day}`] = '';
          }
          return fallbackRow;
        }
      });
      
      console.log('Export data prepared, rows:', exportData.length);
      
      if (exportData.length === 0) {
        console.log('No data to export');
        return res.status(404).json({ message: 'No data found for the selected month' });
      }
      
      if (format === 'csv') {
        try {
          const headers = Object.keys(exportData[0] || {});
          const csvContent = [
            headers.join(','),
            ...exportData.map(row => headers.map(header => {
              const value = row[header] || '';
              return `"${String(value).replace(/"/g, '""')}"`;
            }).join(','))
          ].join('\n');
          
          console.log('CSV content generated, length:', csvContent.length);
          
          // Check if response has already been sent
          if (res.headersSent) {
            console.error('Response headers already sent, cannot send CSV file');
            return;
          }
          
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="detailed_attendance_summary_${year}_${month}.csv"`);
          
          try {
            res.send(csvContent);
            console.log('CSV file sent successfully');
            return; // Explicitly return to prevent further execution
          } catch (sendError) {
            console.error('Error sending CSV file:', sendError);
            // Don't throw here as response might be partially sent
            return;
          }
        } catch (csvError) {
          console.error('CSV generation error:', csvError);
          errorStep = 'csv_generation';
          throw csvError;
        }
      } else {
        // Excel format
        try {
          console.log('Creating Excel workbook...');
          console.log('Sample export data (first row):', exportData.length > 0 ? exportData[0] : 'No data');
          console.log('Export data keys (first row):', exportData.length > 0 ? Object.keys(exportData[0]) : 'No data');
          
          const workbook = XLSX.utils.book_new();
          
          // Validate exportData before creating worksheet
          if (!exportData || exportData.length === 0) {
            console.error('Export data is empty!');
            return res.status(500).json({ message: 'No data to export' });
          }
          
          // Ensure all rows have the same structure
          const allKeys = new Set();
          exportData.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
          });
          console.log('All unique keys in export data:', Array.from(allKeys).sort());
          console.log('Total columns:', allKeys.size);
          console.log('Sample row structure:', exportData.length > 0 ? {
            'S.No': exportData[0]['S.No'],
            'Staff ID': exportData[0]['Staff ID'],
            'Day 1': exportData[0]['Day 1'],
            'Day 31': exportData[0]['Day 31']
          } : 'No data');
          
          // Create worksheet with error handling
          let worksheet;
          try {
            worksheet = XLSX.utils.json_to_sheet(exportData);
            console.log('Worksheet created successfully');
          } catch (worksheetError) {
            console.error('Failed to create worksheet:', worksheetError);
            errorStep = 'worksheet_creation';
            throw new Error(`Failed to create worksheet: ${worksheetError.message}`);
          }
          
          try {
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Detailed Summary');
            console.log('Worksheet added to workbook');
          } catch (appendError) {
            console.error('Failed to append worksheet:', appendError);
            errorStep = 'worksheet_append';
            throw new Error(`Failed to append worksheet: ${appendError.message}`);
          }
          
          console.log('Writing Excel buffer...');
          let excelBuffer;
          try {
            excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            console.log('Excel buffer created, size:', excelBuffer ? excelBuffer.length : 0);
          } catch (writeError) {
            console.error('Failed to write Excel buffer:', writeError);
            errorStep = 'excel_write';
            throw new Error(`Failed to write Excel buffer: ${writeError.message}`);
          }
          
          if (!excelBuffer || excelBuffer.length === 0) {
            console.error('Excel buffer is empty!');
            return res.status(500).json({ message: 'Failed to generate Excel file' });
          }
          
          console.log('Sending Excel file, size:', excelBuffer.length, 'bytes');
          
          // Check if response has already been sent
          if (res.headersSent) {
            console.error('Response headers already sent, cannot send Excel file');
            return;
          }
          
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="detailed_attendance_summary_${year}_${month}.xlsx"`);
          
          try {
            res.send(excelBuffer);
            console.log('Excel file sent successfully');
            return; // Explicitly return to prevent further execution
          } catch (sendError) {
            console.error('Error sending Excel file:', sendError);
            // Don't throw here as response might be partially sent
            return;
          }
        } catch (excelError) {
          console.error('Excel generation error:', excelError);
          console.error('Excel error details:', {
            message: excelError.message,
            stack: excelError.stack,
            name: excelError.name
          });
          errorStep = 'excel_generation';
          throw excelError;
        }
      }
    }
    
    // Return JSON response (only if format is not excel or csv)
    if (format !== 'excel' && format !== 'csv') {
      console.log('Returning JSON response');
      return res.json({
        year: parseInt(year),
        month: parseInt(month),
        startDate,
        endDate,
        totalStaff: reportData.length,
        data: reportData
      });
    } else {
      // This should not happen, but just in case
      console.warn('Format was excel/csv but no response was sent');
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: 'Export completed but no response was sent',
          format: format
        });
      }
    }
    
  } catch (error) {
    console.error('=== Detailed Summary Error ===');
    console.error('Error step:', errorStep || 'unknown');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      step: errorStep
    });
    
    // Check if response has already been sent
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Failed to generate detailed summary', 
        error: error.message,
        step: errorStep,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      console.error('Response already sent, cannot send error response');
    }
  }
});

// Get detailed attendance for a specific date (for drill-down)
router.get('/calendar-view/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const { staffId } = req.query;
    
    const params = [date];
    let staffFilter = '';
    
    // Non-admins can only query their own records
    if (req.user?.role !== 'admin') {
      const ures = await pool.query('SELECT staff_id FROM users WHERE user_id = $1', [req.user.userId]);
      const ownStaffId = ures.rows?.[0]?.staff_id || null;
      if (ownStaffId) {
        params.push(ownStaffId);
        staffFilter = `AND s.staff_id = $${params.length}`;
      }
    } else if (staffId) {
      params.push(staffId);
      staffFilter = `AND s.staff_id = $${params.length}`;
    }
    
    // Check if dim_calendar table exists first
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'dim_calendar'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ 
        message: 'Calendar table not found. Please run database migrations.',
        hint: 'Run: cd backend && node scripts/run_all_migration.js'
      });
    }
    
    // Get calendar info for the date
    const calendarInfo = await pool.query(
      'SELECT * FROM dim_calendar WHERE calendar_date = $1',
      [date]
    );
    
    // Get all active staff
    const allStaffQuery = `
      SELECT staff_id, full_name, department, designation
      FROM staff
      WHERE is_active = TRUE
      ${staffFilter}
      ORDER BY full_name
    `;
    const allStaffResult = await pool.query(allStaffQuery, staffFilter ? params.slice(1) : []);
    
    // Get attendance for the date
    const attendanceQuery = `
      SELECT 
        a.attendance_id,
        a.staff_id,
        a.check_in_time,
        a.check_out_time,
        a.status,
        a.attendance_notes,
        a.work_from_home,
        s.full_name,
        s.department,
        s.designation,
        s.overtime_enabled,
        s.work_end_time,
        s.ot_threshold_minutes,
        CASE 
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
          WHEN a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave') 
               OR (a.check_in_time::time = '00:00:00'::time AND a.check_out_time::time = '00:00:00'::time) THEN
            '00:00'
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL 
               AND s.overtime_enabled = TRUE THEN
            CASE 
              WHEN a.check_out_time::time > (
                (COALESCE(s.work_end_time, '17:45:00')::time + 
                 INTERVAL '1 minute' * COALESCE(s.ot_threshold_minutes, 30))
              ) THEN
                TO_CHAR(a.check_out_time::time - COALESCE(s.work_end_time, '17:45:00')::time, 'HH24:MI')
              ELSE '00:00'
            END
          ELSE '00:00'
        END as overtime_hours
      FROM attendance a
      JOIN staff s ON s.staff_id = a.staff_id
      WHERE a.date = $1
        AND s.is_active = TRUE
        ${staffFilter}
      ORDER BY s.full_name
    `;
    
    const attendanceResult = await pool.query(attendanceQuery, params);
    
    // Map attendance to staff
    const attendanceMap = {};
    attendanceResult.rows.forEach(row => {
      attendanceMap[row.staff_id] = row;
    });
    
    // Combine all staff with their attendance status
    const staffWithAttendance = allStaffResult.rows.map(staff => {
      const attendance = attendanceMap[staff.staff_id];
      return {
        ...staff,
        attendance: attendance || null,
        status: attendance ? attendance.status : 
                (calendarInfo.rows[0]?.is_weekend || calendarInfo.rows[0]?.is_public_holiday ? 'non_working' : 'absent')
      };
    });
    
    res.json({
      date,
      calendarInfo: calendarInfo.rows[0] || null,
      staff: staffWithAttendance,
      summary: {
        total: staffWithAttendance.length,
        present: staffWithAttendance.filter(s => s.attendance && s.attendance.status === 'present').length,
        absent: staffWithAttendance.filter(s => !s.attendance && s.status === 'absent').length,
        leave: staffWithAttendance.filter(s => s.attendance && ['casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave'].includes(s.attendance?.status)).length,
        nonWorking: staffWithAttendance.filter(s => s.status === 'non_working').length,
        overtime: staffWithAttendance.filter(s => s.attendance && s.attendance.overtime_hours && s.attendance.overtime_hours !== '00:00').length
      }
    });
  } catch (error) {
    console.error('Calendar view date details error:', error);
    if (error.message && (error.message.includes('does not exist') || error.message.includes('relation') && error.message.includes('dim_calendar'))) {
      return res.status(404).json({ 
        message: 'Calendar table not found. Please run database migrations.',
        error: error.message,
        hint: 'Run: cd backend && node scripts/run_all_migration.js'
      });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get detailed staff summary report (staff-centric calendar view)
router.get('/calendar-view/detailed-summary', auth, async (req, res) => {
  let errorStep = 'initialization';
  try {
    console.log('=== Detailed Summary Export Request ===');
    const { year, month, staffId, format = 'json' } = req.query;
    console.log('Export params:', { year, month, staffId, format });
    
    if (!year || !month) {
      return res.status(400).json({ message: 'year and month are required' });
    }
    
    errorStep = 'date_calculation';
    // Calculate first and last day of the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    console.log('Date range:', { startDate, endDate, lastDay });
    
    errorStep = 'user_authorization';
    const params = [startDate, endDate];
    let staffFilter = '';
    
    // Non-admins can only query their own records
    if (req.user?.role !== 'admin') {
      try {
        const ures = await pool.query('SELECT staff_id FROM users WHERE user_id = $1', [req.user.userId]);
        const ownStaffId = ures.rows?.[0]?.staff_id || null;
        if (ownStaffId) {
          params.push(ownStaffId);
          staffFilter = `AND s.staff_id = $${params.length}`;
          console.log('Non-admin filter applied:', ownStaffId);
        }
      } catch (userError) {
        console.error('Error fetching user staff_id:', userError);
        throw new Error(`Failed to fetch user staff_id: ${userError.message}`);
      }
    } else if (staffId) {
      params.push(staffId);
      staffFilter = `AND s.staff_id = $${params.length}`;
      console.log('Staff filter applied:', staffId);
    }
    
    console.log('Query params:', params);
    console.log('Staff filter condition:', staffFilter || '(none)');
    
    errorStep = 'table_check';
    // Check if dim_calendar table exists
    let tableCheck;
    try {
      tableCheck = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'dim_calendar'
        )`
      );
    } catch (tableError) {
      console.error('Error checking calendar table:', tableError);
      throw new Error(`Failed to check calendar table: ${tableError.message}`);
    }
    
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ 
        message: 'Calendar table not found. Please run database migrations.',
        hint: 'Run: cd backend && node scripts/run_all_migration.js'
      });
    }
    
    errorStep = 'fetch_staff';
    // Get all active staff
    // Create a separate staff filter for the staff query (uses $1 instead of $3)
    const staffQueryFilter = staffFilter ? `AND staff_id = $1` : '';
    const staffQuery = `
      SELECT staff_id, full_name, department, designation
      FROM staff
      WHERE is_active = TRUE
      ${staffQueryFilter}
      ORDER BY full_name
    `;
    console.log('Fetching staff list...');
    // If staffFilter exists, use the staffId from params (which is at index 2)
    // Otherwise use empty array
    const staffParams = staffFilter ? [params[2]] : [];
    console.log('Staff query:', staffQuery);
    console.log('Staff query params:', staffParams);
    let staffResult;
    try {
      staffResult = await pool.query(staffQuery, staffParams);
      console.log('Staff count:', staffResult.rows.length);
    } catch (staffError) {
      console.error('Staff query error:', staffError);
      errorStep = 'fetch_staff_query';
      throw new Error(`Failed to fetch staff: ${staffError.message}`);
    }
    
    errorStep = 'fetch_calendar';
    // Get calendar info for the month
    const calendarQuery = `
      SELECT calendar_date, day_name, is_weekend, is_public_holiday, holiday_name,
             EXTRACT(DAY FROM calendar_date)::INTEGER AS day_number
      FROM dim_calendar
      WHERE calendar_date >= $1::date AND calendar_date <= $2::date
      ORDER BY calendar_date
    `;
    let calendarResult;
    try {
      calendarResult = await pool.query(calendarQuery, [startDate, endDate]);
      console.log('Calendar days fetched:', calendarResult.rows.length);
    } catch (calendarError) {
      console.error('Calendar query error:', calendarError);
      errorStep = 'fetch_calendar_query';
      throw new Error(`Failed to fetch calendar data: ${calendarError.message}`);
    }
    
    errorStep = 'fetch_attendance';
    // Get all attendance records for the month (match test script - no staffFilter in query)
    const attendanceQuery = `
      SELECT 
        a.staff_id,
        a.date,
        a.status,
        a.check_in_time,
        a.check_out_time,
        s.overtime_enabled,
        s.work_end_time,
        s.ot_threshold_minutes,
        s.break_time_minutes,
        CASE 
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
          WHEN a.status IN ('casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave') 
               OR (a.check_in_time::time = '00:00:00'::time AND a.check_out_time::time = '00:00:00'::time) THEN
            '00:00'
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL 
               AND s.overtime_enabled = TRUE THEN
            CASE 
              WHEN a.check_out_time::time > (
                (COALESCE(s.work_end_time, '17:45:00')::time + 
                 INTERVAL '1 minute' * COALESCE(s.ot_threshold_minutes, 30))
              ) THEN
                TO_CHAR(a.check_out_time::time - COALESCE(s.work_end_time, '17:45:00')::time, 'HH24:MI')
              ELSE '00:00'
            END
          ELSE '00:00'
        END as overtime_hours
      FROM attendance a
      JOIN staff s ON s.staff_id = a.staff_id
      WHERE a.date >= $1::date AND a.date <= $2::date
        AND s.is_active = TRUE
      ORDER BY a.staff_id, a.date
    `;
    console.log('Fetching attendance records...');
    // Use only startDate and endDate for attendance query (match test script)
    const attendanceParams = [startDate, endDate];
    console.log('Attendance query params:', attendanceParams);
    let attendanceResult;
    try {
      attendanceResult = await pool.query(attendanceQuery, attendanceParams);
      console.log('Attendance records fetched:', attendanceResult.rows.length);
    } catch (attendanceError) {
      console.error('Attendance query error:', attendanceError);
      errorStep = 'fetch_attendance_query';
      throw new Error(`Failed to fetch attendance records: ${attendanceError.message}`);
    }
    
    // Create attendance map: staff_id -> date -> attendance record
    // Filter by staff if needed (match test script approach)
    const attendanceMap = {};
    let filteredAttendanceRows = attendanceResult.rows;
    
    // If staff filter is needed, filter in memory (like test script)
    if (staffFilter) {
      const filterStaffId = params[2]; // Get staffId from params
      filteredAttendanceRows = attendanceResult.rows.filter(row => row.staff_id === filterStaffId);
      console.log(`Filtered attendance records to ${filteredAttendanceRows.length} for staff ${filterStaffId}`);
    }
    
    filteredAttendanceRows.forEach(row => {
      if (!attendanceMap[row.staff_id]) {
        attendanceMap[row.staff_id] = {};
      }
      // Convert date to string for consistent lookup
      const dateKey = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
      attendanceMap[row.staff_id][dateKey] = row;
    });
    console.log('Attendance records processed:', filteredAttendanceRows.length);
    
    // Helper function to convert HH:MM to decimal hours
    const hhmmToDecimal = (hhmm) => {
      if (!hhmm || hhmm === '00:00') return 0;
      const [hours, minutes] = hhmm.split(':').map(Number);
      return hours + (minutes / 60);
    };
    
    errorStep = 'process_staff';
    // Process each staff member
    const reportData = [];
    let serialNumber = 1;
    
    console.log('Processing staff members...');
    for (const staff of staffResult.rows) {
      try {
        const staffAttendances = attendanceMap[staff.staff_id] || {};
        
        let totalWorkingDays = 0;
        let presentDays = 0;
        let absentDays = 0;
        let totalOTHours = 0;
        let sundayOTHours = 0;
        const dailyStatus = {};
        
        // Process each day in the month
        for (const calDay of calendarResult.rows) {
          try {
            const dayNum = calDay.day_number;
            // Skip if dayNum is invalid
            if (!dayNum || dayNum < 1 || dayNum > 31) {
              console.warn(`Invalid day number: ${dayNum} for staff ${staff.staff_id}`);
              continue;
            }
            // Convert date to string for consistent lookup
            let dateStr;
            if (calDay.calendar_date instanceof Date) {
              dateStr = calDay.calendar_date.toISOString().split('T')[0];
            } else if (typeof calDay.calendar_date === 'string') {
              dateStr = calDay.calendar_date.split('T')[0]; // Handle ISO strings
            } else {
              dateStr = String(calDay.calendar_date);
            }
            const attendance = staffAttendances[dateStr];
            const isWeekend = calDay.is_weekend;
            const isHoliday = calDay.is_public_holiday;
            
            // Determine if it's a working day
            const isWorkingDay = !isWeekend && !isHoliday;
            
            if (isWorkingDay) {
              totalWorkingDays++;
            }
            
            // Determine status for the day
            let status = '';
            if (isWeekend) {
              status = 'WO'; // Weekly Off
            } else if (isHoliday) {
              status = 'NH'; // National Holiday
            } else if (attendance) {
              if (attendance.status === 'present') {
                // Check if it's a half day based on total hours (less than 4 hours = half day)
                const totalHours = hhmmToDecimal(attendance.total_hours);
                if (totalHours > 0 && totalHours < 4) {
                  status = 'HD'; // Half Day
                  presentDays += 0.5;
                  absentDays += 0.5; // Half day counts as 0.5 absent
                } else {
                  status = 'P'; // Present
                  presentDays++;
                }
                
                // Calculate OT
                const otHours = hhmmToDecimal(attendance.overtime_hours);
                totalOTHours += otHours;
                
                // Check if it's Sunday and has OT
                if (calDay.day_name.trim().toLowerCase() === 'sunday' && otHours > 0) {
                  sundayOTHours += otHours;
                }
              } else if (attendance.status === 'casual_leave' || 
                         attendance.status === 'medical_leave' || 
                         attendance.status === 'unpaid_leave' || 
                         attendance.status === 'hospitalised_leave') {
                status = attendance.status.toUpperCase().substring(0, 2); // CL, ML, UL, HL
                absentDays += 1; // Leave counts as absent for working days
              } else {
                status = 'P'; // Default to present if status exists but not recognized
                presentDays++;
              }
            } else {
              // No attendance record on a working day = absent
              if (isWorkingDay) {
                status = 'A'; // Absent
                absentDays++;
              } else {
                status = isWeekend ? 'WO' : 'NH';
              }
            }
            
            dailyStatus[dayNum] = status;
          } catch (dayError) {
            console.error(`Error processing day ${calDay.day_number} for staff ${staff.staff_id}:`, dayError);
            // Continue with next day
          }
        }
        
        // Build row data
        const rowData = {
          sno: serialNumber++,
          staffId: staff.staff_id,
          name: staff.full_name,
          department: staff.department || '',
          totalWorkingDays: totalWorkingDays,
          absentDays: absentDays.toFixed(1),
          presentDays: presentDays.toFixed(1),
          otHours: totalOTHours.toFixed(2),
          sundayOTHours: sundayOTHours.toFixed(2),
          ...dailyStatus // Add all day columns (1-31)
        };
        
        reportData.push(rowData);
      } catch (staffError) {
        console.error(`Error processing staff ${staff.staff_id}:`, staffError);
        // Continue with next staff
      }
    }
    
    console.log('Staff processing completed, total rows:', reportData.length);
    
    errorStep = 'prepare_export';
    console.log('Report data prepared, rows:', reportData.length);
    
    // Ensure lastDay is available
    if (!lastDay || lastDay < 1 || lastDay > 31) {
      console.error('Invalid lastDay:', lastDay);
      throw new Error(`Invalid lastDay value: ${lastDay}`);
    }
    
    // If format is Excel or CSV, export it
    if (format === 'excel' || format === 'csv') {
      errorStep = 'export_format_check';
      if (reportData.length === 0) {
        console.log('No report data to export');
        return res.status(404).json({ message: 'No data found for the selected month' });
      }
      
      // Prepare export data
      console.log('Preparing export data...');
      console.log('Using lastDay:', lastDay);
      const exportData = reportData.map((row, index) => {
        try {
          // Ensure all base fields are properly formatted (no null/undefined)
          const exportRow = {
            'S.No': Number(row.sno) || (index + 1),
            'Staff ID': String(row.staffId || ''),
            'Name': String(row.name || ''),
            'Department': String(row.department || ''),
            'Total Working Days': Number(row.totalWorkingDays) || 0,
            'Absent Days': String(row.absentDays || '0.0'),
            'Present Days': String(row.presentDays || '0.0'),
            'OT Hours': String(row.otHours || '0.00'),
            'Sunday OT Hours': String(row.sundayOTHours || '0.00')
          };
          
          // Add day columns (1-31) - access numeric keys correctly
          // Ensure lastDay is valid
          const validLastDay = lastDay && lastDay >= 1 && lastDay <= 31 ? lastDay : 31;
          for (let day = 1; day <= validLastDay; day++) {
            // Access the day status - try both numeric and string key
            let dayStatus = '';
            if (row[day] !== undefined && row[day] !== null) {
              dayStatus = String(row[day]);
            } else if (row[String(day)] !== undefined && row[String(day)] !== null) {
              dayStatus = String(row[String(day)]);
            }
            exportRow[`Day ${day}`] = dayStatus;
          }
          
          return exportRow;
        } catch (rowError) {
          console.error(`Error processing row ${index}:`, rowError);
          // Return a minimal valid row to prevent export failure
          const fallbackRow = {
            'S.No': index + 1,
            'Staff ID': '',
            'Name': 'Error processing row',
            'Department': '',
            'Total Working Days': 0,
            'Absent Days': '0.0',
            'Present Days': '0.0',
            'OT Hours': '0.00',
            'Sunday OT Hours': '0.00'
          };
          const validLastDay = lastDay && lastDay >= 1 && lastDay <= 31 ? lastDay : 31;
          for (let day = 1; day <= validLastDay; day++) {
            fallbackRow[`Day ${day}`] = '';
          }
          return fallbackRow;
        }
      });
      
      console.log('Export data prepared, rows:', exportData.length);
      
      if (exportData.length === 0) {
        console.log('No data to export');
        return res.status(404).json({ message: 'No data found for the selected month' });
      }
      
      if (format === 'csv') {
        try {
          const headers = Object.keys(exportData[0] || {});
          const csvContent = [
            headers.join(','),
            ...exportData.map(row => headers.map(header => {
              const value = row[header] || '';
              return `"${String(value).replace(/"/g, '""')}"`;
            }).join(','))
          ].join('\n');
          
          console.log('CSV content generated, length:', csvContent.length);
          
          // Check if response has already been sent
          if (res.headersSent) {
            console.error('Response headers already sent, cannot send CSV file');
            return;
          }
          
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="detailed_attendance_summary_${year}_${month}.csv"`);
          
          try {
            res.send(csvContent);
            console.log('CSV file sent successfully');
            return; // Explicitly return to prevent further execution
          } catch (sendError) {
            console.error('Error sending CSV file:', sendError);
            // Don't throw here as response might be partially sent
            return;
          }
        } catch (csvError) {
          console.error('CSV generation error:', csvError);
          errorStep = 'csv_generation';
          throw csvError;
        }
      } else {
        // Excel format
        try {
          console.log('Creating Excel workbook...');
          console.log('Sample export data (first row):', exportData.length > 0 ? exportData[0] : 'No data');
          console.log('Export data keys (first row):', exportData.length > 0 ? Object.keys(exportData[0]) : 'No data');
          
          const workbook = XLSX.utils.book_new();
          
          // Validate exportData before creating worksheet
          if (!exportData || exportData.length === 0) {
            console.error('Export data is empty!');
            return res.status(500).json({ message: 'No data to export' });
          }
          
          // Ensure all rows have the same structure
          const allKeys = new Set();
          exportData.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
          });
          console.log('All unique keys in export data:', Array.from(allKeys).sort());
          console.log('Total columns:', allKeys.size);
          console.log('Sample row structure:', exportData.length > 0 ? {
            'S.No': exportData[0]['S.No'],
            'Staff ID': exportData[0]['Staff ID'],
            'Day 1': exportData[0]['Day 1'],
            'Day 31': exportData[0]['Day 31']
          } : 'No data');
          
          // Create worksheet with error handling
          let worksheet;
          try {
            worksheet = XLSX.utils.json_to_sheet(exportData);
            console.log('Worksheet created successfully');
          } catch (worksheetError) {
            console.error('Failed to create worksheet:', worksheetError);
            errorStep = 'worksheet_creation';
            throw new Error(`Failed to create worksheet: ${worksheetError.message}`);
          }
          
          try {
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Detailed Summary');
            console.log('Worksheet added to workbook');
          } catch (appendError) {
            console.error('Failed to append worksheet:', appendError);
            errorStep = 'worksheet_append';
            throw new Error(`Failed to append worksheet: ${appendError.message}`);
          }
          
          console.log('Writing Excel buffer...');
          let excelBuffer;
          try {
            excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            console.log('Excel buffer created, size:', excelBuffer ? excelBuffer.length : 0);
          } catch (writeError) {
            console.error('Failed to write Excel buffer:', writeError);
            errorStep = 'excel_write';
            throw new Error(`Failed to write Excel buffer: ${writeError.message}`);
          }
          
          if (!excelBuffer || excelBuffer.length === 0) {
            console.error('Excel buffer is empty!');
            return res.status(500).json({ message: 'Failed to generate Excel file' });
          }
          
          console.log('Sending Excel file, size:', excelBuffer.length, 'bytes');
          
          // Check if response has already been sent
          if (res.headersSent) {
            console.error('Response headers already sent, cannot send Excel file');
            return;
          }
          
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="detailed_attendance_summary_${year}_${month}.xlsx"`);
          
          try {
            res.send(excelBuffer);
            console.log('Excel file sent successfully');
            return; // Explicitly return to prevent further execution
          } catch (sendError) {
            console.error('Error sending Excel file:', sendError);
            // Don't throw here as response might be partially sent
            return;
          }
        } catch (excelError) {
          console.error('Excel generation error:', excelError);
          console.error('Excel error details:', {
            message: excelError.message,
            stack: excelError.stack,
            name: excelError.name
          });
          errorStep = 'excel_generation';
          throw excelError;
        }
      }
    }
    
    // Return JSON response (only if format is not excel or csv)
    if (format !== 'excel' && format !== 'csv') {
      console.log('Returning JSON response');
      return res.json({
        year: parseInt(year),
        month: parseInt(month),
        startDate,
        endDate,
        totalStaff: reportData.length,
        data: reportData
      });
    } else {
      // This should not happen, but just in case
      console.warn('Format was excel/csv but no response was sent');
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: 'Export completed but no response was sent',
          format: format
        });
      }
    }
    
  } catch (error) {
    console.error('=== Detailed Summary Error ===');
    console.error('Error step:', errorStep || 'unknown');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      step: errorStep
    });
    
    // Check if response has already been sent
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Failed to generate detailed summary', 
        error: error.message,
        step: errorStep,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      console.error('Response already sent, cannot send error response');
    }
  }
});

module.exports = router;
