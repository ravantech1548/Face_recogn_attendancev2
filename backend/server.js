const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');
const { getJSTimezone, formatDateTime } = require('./src/config/timezone');

dotenv.config();

const authRoutes = require('./src/routes/auth');
const staffRoutes = require('./src/routes/staff');
const attendanceRoutes = require('./src/routes/attendance');
const usersRoutes = require('./src/routes/users');
const settingsRoutes = require('./src/routes/settings');
const calendarRoutes = require('./src/routes/calendar');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/calendar', calendarRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({ message: 'Face Recognition API is running!' });
});

// Custom logging function with timestamp from .env timezone
const logWithTimestamp = (message, level = 'INFO') => {
  const timestamp = formatDateTime();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

// Override console.log to include timestamps using timezone from .env
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
  const timestamp = formatDateTime();
  originalLog(`[${timestamp}]`, ...args);
};

console.error = (...args) => {
  const timestamp = formatDateTime();
  originalError(`[${timestamp}] [ERROR]`, ...args);
};

console.warn = (...args) => {
  const timestamp = formatDateTime();
  originalWarn(`[${timestamp}] [WARN]`, ...args);
};

// Initialize DB schema at startup (best-effort)
const initDb = require('./src/setup/initDb');
initDb().finally(() => {
  // Try to load SSL certificates
  try {
    const options = {
      key: fs.readFileSync('../ssl/key.pem'),
      cert: fs.readFileSync('../ssl/cert.pem')
    };
    
    https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
      logWithTimestamp(`HTTPS Server running on port ${PORT}`, 'INFO');
    });
  } catch (error) {
    logWithTimestamp('SSL certificates not found, falling back to HTTP', 'WARN');
    app.listen(PORT, '0.0.0.0', () => {
      logWithTimestamp(`HTTP Server running on port ${PORT}`, 'INFO');
    });
  }
});


