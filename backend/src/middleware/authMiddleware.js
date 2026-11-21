const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Allow preflight OPTIONS requests to pass through without authentication
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Loads the signed-in account from the database, so a role change or a
// removed account takes effect immediately instead of when the token expires.
// Use after authenticateToken (or optionalAuth).
const makeLoadUser = ({ required }) => async (req, res, next) => {
  if (!req.user) return next();
  try {
    // Required here so this module can be loaded without a database (unit tests).
    const { User } = require('../models');
    const user = await User.findByPk(req.user.userId, { attributes: ['id', 'role'] });
    if (!user) {
      if (!required) {
        req.user = undefined;
        return next();
      }
      return res.status(401).json({ message: 'This account no longer exists' });
    }
    req.user = { ...req.user, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
};
const loadCurrentUser = makeLoadUser({ required: true });

// For public endpoints that show more to signed-in users. A missing or invalid
// token is treated as an anonymous visitor rather than an error.
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    req.user = undefined;
  }
  return next();
};

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient access' });
  }

  return next();
};

// Signed-in user whose account still exists.
const requireAuth = [authenticateToken, loadCurrentUser];
// Anonymous visitors allowed; signed-in users are identified when possible.
const identifyUser = [optionalAuth, makeLoadUser({ required: false })];

module.exports = {
  authenticateToken,
  loadCurrentUser,
  optionalAuth,
  requireAuth,
  identifyUser,
  authorizeRoles,
};

