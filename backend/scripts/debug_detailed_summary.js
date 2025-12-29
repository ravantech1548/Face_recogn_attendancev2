require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');

const pool = new Pool({
  user: process.env.DB_USER || 'faceapp_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'face_recognition_attendance',
  password: process.env.DB_PASSWORD || 'qautomation',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function debugDetailedSummary() {
  const year = 2025;
  const month = 12;
  const format = 'excel';
  
  try {
    console.log('=== DEBUG: Detailed Summary Export ===\n');
    
    // Calculate dates
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    console.log('Parameters:', { year, month, format, startDate, endDate, lastDay });
    
    // Step 1: Check calendar table
    console.log('\n[Step 1] Checking calendar table...');
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'dim_calendar'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.error('❌ Calendar table not found!');
      return;
    }
    console.log('✅ Calendar table exists');
    
    // Step 2: Get staff
    console.log('\n[Step 2] Fetching staff...');
    const staffQuery = `
      SELECT staff_id, full_name, department, designation
      FROM staff
      WHERE is_active = TRUE
      ORDER BY full_name
    `;
    const staffResult = await pool.query(staffQuery, []);
    console.log(`✅ Found ${staffResult.rows.length} active staff`);
    
    if (staffResult.rows.length === 0) {
      console.log('⚠️  No active staff found');
      return;
    }
    
    // Step 3: Get calendar data
    console.log('\n[Step 3] Fetching calendar data...');
    const calendarQuery = `
      SELECT calendar_date, day_name, is_weekend, is_public_holiday, holiday_name,
             EXTRACT(DAY FROM calendar_date)::INTEGER AS day_number
      FROM dim_calendar
      WHERE calendar_date >= $1::date AND calendar_date <= $2::date
      ORDER BY calendar_date
    `;
    const calendarResult = await pool.query(calendarQuery, [startDate, endDate]);
    console.log(`✅ Found ${calendarResult.rows.length} calendar days`);
    
    // Step 4: Get attendance records
    console.log('\n[Step 4] Fetching attendance records...');
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
    const attendanceResult = await pool.query(attendanceQuery, [startDate, endDate]);
    console.log(`✅ Found ${attendanceResult.rows.length} attendance records`);
    
    // Step 5: Create attendance map
    console.log('\n[Step 5] Creating attendance map...');
    const attendanceMap = {};
    attendanceResult.rows.forEach(row => {
      if (!attendanceMap[row.staff_id]) {
        attendanceMap[row.staff_id] = {};
      }
      const dateKey = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
      attendanceMap[row.staff_id][dateKey] = row;
    });
    console.log(`✅ Attendance map created for ${Object.keys(attendanceMap).length} staff`);
    
    // Step 6: Helper function
    const hhmmToDecimal = (hhmm) => {
      if (!hhmm || hhmm === '00:00') return 0;
      const [hours, minutes] = hhmm.split(':').map(Number);
      return hours + (minutes / 60);
    };
    
    // Step 7: Process staff
    console.log('\n[Step 7] Processing staff members...');
    const reportData = [];
    let serialNumber = 1;
    let errorCount = 0;
    
    for (const staff of staffResult.rows) {
      try {
        const staffAttendances = attendanceMap[staff.staff_id] || {};
        
        let totalWorkingDays = 0;
        let presentDays = 0;
        let absentDays = 0;
        let totalOTHours = 0;
        let sundayOTHours = 0;
        const dailyStatus = {};
        
        // Process each day
        for (const calDay of calendarResult.rows) {
          try {
            const dayNum = calDay.day_number;
            if (!dayNum || dayNum < 1 || dayNum > 31) {
              console.warn(`⚠️  Invalid day number: ${dayNum} for staff ${staff.staff_id}`);
              continue;
            }
            
            let dateStr;
            if (calDay.calendar_date instanceof Date) {
              dateStr = calDay.calendar_date.toISOString().split('T')[0];
            } else if (typeof calDay.calendar_date === 'string') {
              dateStr = calDay.calendar_date.split('T')[0];
            } else {
              dateStr = String(calDay.calendar_date);
            }
            
            const attendance = staffAttendances[dateStr];
            const isWeekend = calDay.is_weekend;
            const isHoliday = calDay.is_public_holiday;
            const isWorkingDay = !isWeekend && !isHoliday;
            
            if (isWorkingDay) {
              totalWorkingDays++;
            }
            
            let status = '';
            if (isWeekend) {
              status = 'WO';
            } else if (isHoliday) {
              status = 'NH';
            } else if (attendance) {
              if (attendance.status === 'present') {
                const totalHours = hhmmToDecimal(attendance.total_hours);
                if (totalHours > 0 && totalHours < 4) {
                  status = 'HD';
                  presentDays += 0.5;
                  absentDays += 0.5;
                } else {
                  status = 'P';
                  presentDays++;
                }
                
                const otHours = hhmmToDecimal(attendance.overtime_hours);
                totalOTHours += otHours;
                
                if (calDay.day_name.trim().toLowerCase() === 'sunday' && otHours > 0) {
                  sundayOTHours += otHours;
                }
              } else if (['casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave'].includes(attendance.status)) {
                status = attendance.status.toUpperCase().substring(0, 2);
                absentDays += 1;
              } else {
                status = 'P';
                presentDays++;
              }
            } else {
              if (isWorkingDay) {
                status = 'A';
                absentDays++;
              } else {
                status = isWeekend ? 'WO' : 'NH';
              }
            }
            
            dailyStatus[dayNum] = status;
          } catch (dayError) {
            console.error(`❌ Error processing day ${calDay.day_number} for staff ${staff.staff_id}:`, dayError.message);
            errorCount++;
          }
        }
        
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
          ...dailyStatus
        };
        
        reportData.push(rowData);
      } catch (staffError) {
        console.error(`❌ Error processing staff ${staff.staff_id}:`, staffError.message);
        console.error('Stack:', staffError.stack);
        errorCount++;
      }
    }
    
    console.log(`✅ Processed ${reportData.length} staff members (${errorCount} errors)`);
    
    if (reportData.length === 0) {
      console.error('❌ No data to export!');
      return;
    }
    
    // Step 8: Prepare export data
    console.log('\n[Step 8] Preparing export data...');
    const exportData = reportData.map((row, index) => {
      try {
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
        
        for (let day = 1; day <= lastDay; day++) {
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
        console.error(`❌ Error processing row ${index}:`, rowError.message);
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
        for (let day = 1; day <= lastDay; day++) {
          fallbackRow[`Day ${day}`] = '';
        }
        return fallbackRow;
      }
    });
    
    console.log(`✅ Export data prepared: ${exportData.length} rows`);
    console.log('Sample row keys:', Object.keys(exportData[0] || {}));
    console.log('Sample row (first 5 fields):', Object.fromEntries(Object.entries(exportData[0] || {}).slice(0, 5)));
    
    // Step 9: Generate Excel
    if (format === 'excel') {
      console.log('\n[Step 9] Generating Excel file...');
      try {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Detailed Summary');
        
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        console.log(`✅ Excel buffer created: ${excelBuffer.length} bytes`);
        
        // Save to file for testing
        const fs = require('fs');
        const filename = `detailed_summary_test_${year}_${month}.xlsx`;
        fs.writeFileSync(filename, excelBuffer);
        console.log(`✅ Excel file saved as: ${filename}`);
      } catch (excelError) {
        console.error('❌ Excel generation error:', excelError.message);
        console.error('Stack:', excelError.stack);
        throw excelError;
      }
    }
    
    console.log('\n=== DEBUG COMPLETE ===');
    console.log('✅ All steps completed successfully!');
    
  } catch (error) {
    console.error('\n=== FATAL ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position
    });
    throw error;
  } finally {
    await pool.end();
  }
}

debugDetailedSummary().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

