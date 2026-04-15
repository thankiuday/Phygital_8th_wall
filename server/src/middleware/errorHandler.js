'use strict';

const logger = require('../config/logger');

/**
 * notFound — 404 middleware for unmatched routes.
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * errorHandler — global Express error handler.
 *
 * - 4xx errors → warn level (client mistakes, expected)
 * - 5xx errors → error level (server bugs, alert-worthy)
 *
 * Returns a consistent JSON shape:
 *   { success: false, message: string, code?: string, stack?: string }
 */
const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isDev      = process.env.NODE_ENV !== 'production';

  // ── Normalise common Mongoose / JWT errors ──────────────────────────────
  let message = err.message || 'Internal Server Error';

  if (err.name === 'CastError') {
    message = `Invalid ${err.path}: ${err.value}`;
    err.statusCode = 400;
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    err.statusCode = 409;
  }

  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map((e) => e.message).join('. ');
    err.statusCode = 400;
  }

  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token. Please log in again.';
    err.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Your session has expired. Please log in again.';
    err.statusCode = 401;
  }

  // ── Log ─────────────────────────────────────────────────────────────────
  const logMeta = {
    method:     req.method,
    path:       req.originalUrl,
    statusCode: err.statusCode || 500,
    ip:         req.ip,
    userId:     req.user?._id,
    ...(isDev && { stack: err.stack }),
  };

  if ((err.statusCode || 500) >= 500) {
    logger.error(message, logMeta);
  } else {
    logger.warn(message, logMeta);
  }

  // ── Response ─────────────────────────────────────────────────────────────
  res.status(statusCode).json({
    success: false,
    message,
    ...(err.code && { code: String(err.code) }),
    ...(isDev && { stack: err.stack }),
  });
};

/**
 * AppError — custom error class for intentional API errors.
 * Usage: throw new AppError('Not authorized', 403);
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name       = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { notFound, errorHandler, AppError };
