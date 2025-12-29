const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Helper function to update weekend flags based on global settings
async function updateWeekendFlags() {
  try {
    // Get settings
    const settingsResult = await pool.query(
      `SELECT setting_key, setting_value FROM global_settings 
       WHERE setting_key IN ('sunday_as_non_working_day', 'saturday_as_non_working_day')`
    );
    
    let sundayEnabled = true; // Default
    let saturdayEnabled = false; // Default
    
    settingsResult.rows.forEach(row => {
      if (row.setting_key === 'sunday_as_non_working_day') {
        sundayEnabled = row.setting_value === 'true' || row.setting_value === '1';
      } else if (row.setting_key === 'saturday_as_non_working_day') {
        saturdayEnabled = row.setting_value === 'true' || row.setting_value === '1';
      }
    });
    
    // Update Sunday weekends
    await pool.query(
      `UPDATE dim_calendar 
       SET is_weekend = $1, updated_at = NOW()
       WHERE EXTRACT(DOW FROM calendar_date) = 0`,
      [sundayEnabled]
    );
    
    // Update Saturday weekends
    await pool.query(
      `UPDATE dim_calendar 
       SET is_weekend = $1, updated_at = NOW()
       WHERE EXTRACT(DOW FROM calendar_date) = 6`,
      [saturdayEnabled]
    );
    
    return { sundayEnabled, saturdayEnabled };
  } catch (error) {
    console.error('Error updating weekend flags:', error);
    throw error;
  }
}

// Get all public holidays (with optional date range filter)
router.get('/holidays', auth, async (req, res) => {
  try {
    const { startDate, endDate, year } = req.query;
    
    let query = `
      SELECT calendar_date, day_name, holiday_name, is_public_holiday, is_weekend
      FROM dim_calendar
      WHERE is_public_holiday = TRUE
    `;
    const params = [];
    
    if (year) {
      query += ` AND EXTRACT(YEAR FROM calendar_date) = $${params.length + 1}`;
      params.push(parseInt(year));
    } else if (startDate && endDate) {
      query += ` AND calendar_date >= $${params.length + 1} AND calendar_date <= $${params.length + 2}`;
      params.push(startDate);
      params.push(endDate);
    }
    
    query += ` ORDER BY calendar_date`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get calendar information for a date range
router.get('/calendar', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }
    
    const result = await pool.query(
      `SELECT calendar_date, day_name, is_weekend, is_public_holiday, holiday_name
       FROM dim_calendar
       WHERE calendar_date >= $1 AND calendar_date <= $2
       ORDER BY calendar_date`,
      [startDate, endDate]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get working days count for a date range
router.get('/working-days', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }
    
    const result = await pool.query(
      `SELECT COUNT(*) as working_days_count
       FROM dim_calendar
       WHERE calendar_date >= $1 AND calendar_date <= $2
         AND is_weekend = FALSE AND is_public_holiday = FALSE`,
      [startDate, endDate]
    );
    
    res.json({ 
      startDate, 
      endDate, 
      workingDays: parseInt(result.rows[0].working_days_count) 
    });
  } catch (error) {
    console.error('Get working days error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add or update a single public holiday (Admin only)
router.post(
  '/holidays',
  [
    auth,
    requireAdmin,
    body('date').isISO8601().withMessage('Valid date (ISO 8601) is required'),
    body('holidayName').notEmpty().withMessage('holidayName is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { date, holidayName } = req.body;
      
      // Ensure the date exists in calendar table
      await pool.query(
        `INSERT INTO dim_calendar (calendar_date, day_name, is_weekend)
         SELECT 
           $1::DATE,
           TRIM(TO_CHAR($1::DATE, 'Day')),
           CASE WHEN EXTRACT(DOW FROM $1::DATE) = 0 THEN TRUE ELSE FALSE END
         ON CONFLICT (calendar_date) DO NOTHING`,
        [date]
      );
      
      // Update or insert holiday
      const result = await pool.query(
        `UPDATE dim_calendar 
         SET is_public_holiday = TRUE, 
             holiday_name = $1,
             updated_at = NOW()
         WHERE calendar_date = $2
         RETURNING calendar_date, day_name, holiday_name, is_public_holiday, is_weekend`,
        [holidayName, date]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Date not found in calendar' });
      }
      
      res.status(200).json({
        message: 'Holiday added/updated successfully',
        holiday: result.rows[0]
      });
    } catch (error) {
      console.error('Add holiday error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Bulk upload/update public holidays (Admin only)
router.post(
  '/holidays/bulk',
  [
    auth,
    requireAdmin,
    body('holidays').isArray().withMessage('holidays must be an array'),
    body('holidays.*.date').isISO8601().withMessage('Each holiday must have a valid date'),
    body('holidays.*.holidayName').notEmpty().withMessage('Each holiday must have a holidayName')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { holidays } = req.body;
      const results = {
        created: [],
        updated: [],
        errors: []
      };
      
      for (const holiday of holidays) {
        try {
          const { date, holidayName } = holiday;
          
          // Ensure the date exists in calendar table
          await pool.query(
            `INSERT INTO dim_calendar (calendar_date, day_name, is_weekend)
             SELECT 
               $1::DATE,
               TRIM(TO_CHAR($1::DATE, 'Day')),
               CASE WHEN EXTRACT(DOW FROM $1::DATE) = 0 THEN TRUE ELSE FALSE END
             ON CONFLICT (calendar_date) DO NOTHING`,
            [date]
          );
          
          // Check if holiday already exists
          const existing = await pool.query(
            'SELECT is_public_holiday FROM dim_calendar WHERE calendar_date = $1',
            [date]
          );
          
          const isUpdate = existing.rows.length > 0 && existing.rows[0].is_public_holiday;
          
          // Update holiday
          const result = await pool.query(
            `UPDATE dim_calendar 
             SET is_public_holiday = TRUE, 
                 holiday_name = $1,
                 updated_at = NOW()
             WHERE calendar_date = $2
             RETURNING calendar_date, day_name, holiday_name`,
            [holidayName, date]
          );
          
          if (result.rows.length > 0) {
            if (isUpdate) {
              results.updated.push(result.rows[0]);
            } else {
              results.created.push(result.rows[0]);
            }
          }
        } catch (error) {
          results.errors.push({
            date: holiday.date,
            holidayName: holiday.holidayName,
            error: error.message
          });
        }
      }
      
      res.status(200).json({
        message: `Bulk holiday update completed: ${results.created.length} created, ${results.updated.length} updated, ${results.errors.length} errors`,
        results
      });
    } catch (error) {
      console.error('Bulk add holidays error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update a public holiday (Admin only)
router.put(
  '/holidays/:date',
  [
    auth,
    requireAdmin,
    body('holidayName').notEmpty().withMessage('holidayName is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { date } = req.params;
      const { holidayName } = req.body;
      
      const result = await pool.query(
        `UPDATE dim_calendar 
         SET holiday_name = $1,
             updated_at = NOW()
         WHERE calendar_date = $2 AND is_public_holiday = TRUE
         RETURNING calendar_date, day_name, holiday_name, is_public_holiday, is_weekend`,
        [holidayName, date]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Holiday not found for the specified date' });
      }
      
      res.json({
        message: 'Holiday updated successfully',
        holiday: result.rows[0]
      });
    } catch (error) {
      console.error('Update holiday error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Delete a public holiday (Admin only) - marks it as non-holiday
router.delete(
  '/holidays/:date',
  [auth, requireAdmin],
  async (req, res) => {
    try {
      const { date } = req.params;
      
      const result = await pool.query(
        `UPDATE dim_calendar 
         SET is_public_holiday = FALSE,
             holiday_name = NULL,
             updated_at = NOW()
         WHERE calendar_date = $1 AND is_public_holiday = TRUE
         RETURNING calendar_date, day_name, is_weekend`,
        [date]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Holiday not found for the specified date' });
      }
      
      res.json({
        message: 'Holiday removed successfully',
        date: result.rows[0]
      });
    } catch (error) {
      console.error('Delete holiday error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update weekend configuration and refresh calendar (Admin only)
router.post(
  '/weekend-config/refresh',
  [auth, requireAdmin],
  async (req, res) => {
    try {
      const config = await updateWeekendFlags();
      
      res.json({
        message: 'Weekend configuration refreshed successfully',
        config
      });
    } catch (error) {
      console.error('Refresh weekend config error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;

