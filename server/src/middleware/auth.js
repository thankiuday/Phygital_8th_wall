'use strict';

const User = require('../models/User');
const { verifyAccessToken } = require('../utils/jwt');
const { AppError } = require('./errorHandler');

/**
 * protect — verifies the JWT access token on the Authorization header.
 *
 * Expects: Authorization: Bearer <accessToken>
 * On success, attaches `req.user` for downstream use.
 */
const protect = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Please log in.', 401));
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Access token expired', 401));
    }
    return next(new AppError('Invalid access token', 401));
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return next(new AppError('The user belonging to this token no longer exists', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been suspended', 403));
  }

  // Attach user to request for all downstream handlers
  req.user = user;
  next();
};

/**
 * authorize — role-based access control middleware factory.
 *
 * Usage: router.delete('/users/:id', protect, authorize('admin'), handler)
 */
const authorize = (...roles) => {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(
        new AppError(
          `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user?.role}`,
          403
        )
      );
    }
    next();
  };
};

module.exports = { protect, authorize };
