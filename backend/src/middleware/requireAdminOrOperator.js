/**
 * Middleware to require admin or operator role
 * Used for routes that both admins and operators can access
 * Typically used for face attendance/recognition features
 */
function requireAdminOrOperator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'operator') {
    return res.status(403).json({ 
      message: 'Access denied. Admin or Operator role required.' 
    });
  }
  
  return next();
}

module.exports = requireAdminOrOperator;

