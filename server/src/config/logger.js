'use strict';

/**
 * logger.js — Winston structured logger
 *
 * Outputs:
 *   - Console: colorized, human-readable in development
 *   - File:    JSON, daily-rotated, kept for 14 days
 *
 * Usage:
 *   const logger = require('../config/logger');
 *   logger.info('Server started', { port: 5000 });
 *   logger.error('DB connection failed', { err: error.message });
 */

const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, errors, json, colorize, printf } = format;

const isProduction = process.env.NODE_ENV === 'production';

// ── Console format (development only) ──────────────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${stack || message}${extra}`;
  })
);

// ── File format (production) ────────────────────────────────────────────────
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ── Transports ──────────────────────────────────────────────────────────────
const transportList = [];

// Always log to console
transportList.push(
  new transports.Console({
    format: isProduction ? fileFormat : devFormat,
    silent: process.env.NODE_ENV === 'test',
  })
);

// In production, also write to rotating files
if (isProduction) {
  const logDir = path.join(process.cwd(), 'logs');

  transportList.push(
    new transports.DailyRotateFile({
      filename:     path.join(logDir, 'error-%DATE%.log'),
      datePattern:  'YYYY-MM-DD',
      level:        'error',
      maxFiles:     '14d',
      zippedArchive: true,
      format:        fileFormat,
    }),
    new transports.DailyRotateFile({
      filename:     path.join(logDir, 'combined-%DATE%.log'),
      datePattern:  'YYYY-MM-DD',
      maxFiles:     '14d',
      zippedArchive: true,
      format:        fileFormat,
    })
  );
}

// ── Logger instance ─────────────────────────────────────────────────────────
const logger = createLogger({
  level:       isProduction ? 'info' : 'debug',
  exitOnError: false,
  transports:  transportList,
});

// Allow logger.stream for Morgan integration
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
