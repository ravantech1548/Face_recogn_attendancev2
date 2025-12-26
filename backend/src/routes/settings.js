const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Get all settings
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT setting_key, setting_value, setting_type, description FROM global_settings ORDER BY setting_key'
    );
    
    // Convert settings to object format for easier consumption
    const settings = {};
    result.rows.forEach(row => {
      let value = row.setting_value;
      
      // Parse value based on type
      if (row.setting_type === 'number') {
        value = parseFloat(value);
      } else if (row.setting_type === 'boolean') {
        value = value === 'true' || value === '1';
      } else if (row.setting_type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = row.setting_value; // Keep original if parse fails
        }
      }
      
      settings[row.setting_key] = {
        value,
        type: row.setting_type,
        description: row.description
      };
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific setting
router.get('/:key', auth, async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query(
      'SELECT setting_key, setting_value, setting_type, description FROM global_settings WHERE setting_key = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    const row = result.rows[0];
    let value = row.setting_value;
    
    // Parse value based on type
    if (row.setting_type === 'number') {
      value = parseFloat(value);
    } else if (row.setting_type === 'boolean') {
      value = value === 'true' || value === '1';
    } else if (row.setting_type === 'json') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        value = row.setting_value;
      }
    }
    
    res.json({
      key: row.setting_key,
      value,
      type: row.setting_type,
      description: row.description
    });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a setting (Admin only)
router.put('/:key', [auth, requireAdmin, body('value').notEmpty().withMessage('value is required')], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { key } = req.params;
    const { value, type } = req.body;
    
    // Get existing setting to determine type if not provided
    const existing = await pool.query(
      'SELECT setting_type FROM global_settings WHERE setting_key = $1',
      [key]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    const settingType = type || existing.rows[0].setting_type;
    let settingValue = value;
    
    // Convert value to string for storage
    if (settingType === 'number') {
      settingValue = parseFloat(value).toString();
      if (isNaN(settingValue)) {
        return res.status(400).json({ message: 'Invalid number value' });
      }
    } else if (settingType === 'boolean') {
      settingValue = (value === true || value === 'true' || value === '1') ? 'true' : 'false';
    } else if (settingType === 'json') {
      settingValue = typeof value === 'string' ? value : JSON.stringify(value);
    } else {
      settingValue = String(value);
    }
    
    const result = await pool.query(
      `UPDATE global_settings 
       SET setting_value = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE setting_key = $2 
       RETURNING setting_key, setting_value, setting_type, description`,
      [settingValue, key]
    );
    
    // Parse value for response
    let parsedValue = result.rows[0].setting_value;
    if (settingType === 'number') {
      parsedValue = parseFloat(parsedValue);
    } else if (settingType === 'boolean') {
      parsedValue = parsedValue === 'true' || parsedValue === '1';
    } else if (settingType === 'json') {
      try {
        parsedValue = JSON.parse(parsedValue);
      } catch (e) {
        parsedValue = result.rows[0].setting_value;
      }
    }
    
    res.json({
      key: result.rows[0].setting_key,
      value: parsedValue,
      type: result.rows[0].setting_type,
      description: result.rows[0].description
    });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

