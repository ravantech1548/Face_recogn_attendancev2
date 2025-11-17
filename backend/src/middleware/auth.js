const jwt = require('jsonwebtoken');
const pool = require('../config/database');

async function auth(req, res, next) {
  try {
    const header = req.header('Authorization');
    const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const sessionId = decoded.jti;

    if (!sessionId) {
      return res.status(401).json({ message: 'Invalid session token' });
    }

    const sessionResult = await pool.query(
      `
        SELECT session_id, is_active, expires_at
        FROM user_sessions
        WHERE session_id = $1 AND user_id = $2
      `,
      [sessionId, decoded.userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ message: 'Session is no longer active' });
    }

    const session = sessionResult.rows[0];

    if (!session.is_active) {
      return res.status(401).json({ message: 'Session has been terminated' });
    }

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      await pool.query(
        `
          UPDATE user_sessions
          SET is_active = FALSE, revoked_at = NOW()
          WHERE session_id = $1
        `,
        [sessionId]
      );
      return res.status(401).json({ message: 'Session has expired' });
    }

    await pool.query(
      `
        UPDATE user_sessions
        SET last_seen_at = NOW()
        WHERE session_id = $1
      `,
      [sessionId]
    );

    req.user = decoded;
    req.sessionId = sessionId;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = auth;


