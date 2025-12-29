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

const router = express.Router();

// Configure multer for face image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/attendance');
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

// Record check-in
router.post(
  '/check-in',
  [auth, body('staffId').notEmpty().withMessage('staffId is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { staffId, customDateTime, attendanceNotes, manualReason } = req.body;
      
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
        'SELECT attendance_id FROM attendance WHERE staff_id = $1 AND date = $2',
        [staffId, dateStr]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ message: `Already checked in on ${dateStr}` });
      }

      // Set work_from_home flag based on manual reason
      const isWorkFromHome = manualReason === 'work_from_home'
      const finalNotes = manualReason === 'others' ? attendanceNotes : attendanceNotes

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

// Record check-out
router.post(
  '/check-out',
  [auth, body('staffId').notEmpty().withMessage('staffId is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { staffId, customDateTime } = req.body;
      
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
      
      // Validate that check-out time is after check-in time
      const checkInTime = new Date(existing.rows[0].check_in_time);
      if (checkOutTime <= checkInTime) {
        return res.status(400).json({ 
          message: 'Check-out time must be after check-in time',
          checkInTime: checkInTime.toLocaleString(),
          checkOutTime: checkOutTime.toLocaleString()
        });
      }

      // For check-out, only update the check_out_time
      // Keep existing attendance_notes and work_from_home from check-in
      const result = await pool.query(
        'UPDATE attendance SET check_out_time = $2 WHERE attendance_id = $1 RETURNING *',
        [attId, checkOutTime]
      );
      
      const message = customDateTime ? 
        `Check-out recorded for ${dateStr} at ${checkOutTime.toLocaleTimeString()}` : 
        'Check-out recorded';
        
      res.json({ message, attendance: result.rows[0] });
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
              s.project_code, s.supervisor_name, s.break_time_minutes,
              CASE 
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
                WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
                  CASE 
                    WHEN (a.check_out_time - a.check_in_time) > INTERVAL '4 hours 30 minutes' THEN
                      CASE 
                        WHEN (a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30) > INTERVAL '8 hours' THEN
                          TO_CHAR((a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30) - INTERVAL '8 hours', 'HH24:MI')
                        ELSE '00:00'
                      END
                    ELSE
                      CASE 
                        WHEN (a.check_out_time - a.check_in_time) > INTERVAL '8 hours' THEN
                          TO_CHAR((a.check_out_time - a.check_in_time) - INTERVAL '8 hours', 'HH24:MI')
                        ELSE '00:00'
                      END
                  END
                ELSE NULL
              END as overtime_hours
       FROM attendance a
       JOIN staff s ON s.staff_id = a.staff_id
       ${where}
       ORDER BY a.date DESC, a.check_in_time DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// Face event: auto check-in/out with proper daily logic and face capture storage
router.post('/face-event', [auth, requireAdmin, upload.single('faceImage'), body('staffId').notEmpty()], async (req, res) => {
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
      const faceImagePath = faceImage ? `uploads/attendance/${faceImage.filename}` : null;
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
        const faceImagePath = faceImage ? `uploads/attendance/${faceImage.filename}` : null;
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
    const faceImagePath = faceImage ? `uploads/attendance/${faceImage.filename}` : null;
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
             s.manager_name, s.project_code, s.supervisor_name, s.break_time_minutes,
             CASE 
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
               WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
                 CASE 
                   WHEN (a.check_out_time - a.check_in_time) > INTERVAL '4 hours 30 minutes' THEN
                     CASE 
                       WHEN (a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30) > INTERVAL '8 hours' THEN
                         TO_CHAR((a.check_out_time - a.check_in_time) - INTERVAL '1 minute' * COALESCE(s.break_time_minutes, 30) - INTERVAL '8 hours', 'HH24:MI')
                       ELSE '00:00'
                     END
                   ELSE
                     CASE 
                       WHEN (a.check_out_time - a.check_in_time) > INTERVAL '8 hours' THEN
                         TO_CHAR((a.check_out_time - a.check_in_time) - INTERVAL '8 hours', 'HH24:MI')
                       ELSE '00:00'
                     END
                 END
               ELSE NULL
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
        const headers = ['Date', 'Staff ID', 'Staff Name', 'Department', 'Designation', 'Email', 'Work Status', 'Manager Name', 'Supervisor Name', 'Project Code', 'Check In Time', 'Check Out Time', 'Total Hours', 'Day Hours', 'Overtime Hours', 'Late Arrival (min)', 'Early Departure (min)', 'Break Time (min)', 'Work From Home', 'Attendance Notes', 'Status', 'Check In Confidence', 'Check Out Confidence', 'Has Check In Photo', 'Has Check Out Photo', 'Created At'];
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
      // Generate Excel
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
        'Attendance Notes': record.attendance_notes || '',
        'Status': record.status,
        'Check In Confidence': record.check_in_confidence_score ? `${(record.check_in_confidence_score * 100).toFixed(1)}%` : '',
        'Check Out Confidence': record.check_out_confidence_score ? `${(record.check_out_confidence_score * 100).toFixed(1)}%` : '',
        'Has Check In Photo': record.check_in_face_image_path ? 'Yes' : 'No',
        'Has Check Out Photo': record.check_out_face_image_path ? 'Yes' : 'No',
        'Created At': new Date(record.created_at).toLocaleString()
      }));
      
      try {
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');
        
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


