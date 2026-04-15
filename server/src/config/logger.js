'use strict';

/**
 * logger.js — Winston structured logger.
 *
 * Console-only on Render/production (Render streams logs externally).
 * File transport is only added when LOG_TO_FILE=true is explicitly set.
 */

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json, colorize, printf } = format;

const isProduction = process.env.NODE_ENV === 'production';

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${stack || message}${extra}`;
  })
);

const fileFormat = combine(timestamp(), errors({ stack: true }), json());

const transportList = [
  new transports.Console({
    format: isProduction ? fileFormat : devFormat,
    silent: process.env.NODE_ENV === 'test',
  }),
];

// Only add file transport when explicitly opted-in (not on Render)
if (process.env.LOG_TO_FILE === 'true') {
  try {
    require('winston-daily-rotate-file');
    const path = require('path');
    const logDir = path.join(process.cwd(), 'logs');
    const { DailyRotateFile } = require('winston').transports;

    transportList.push(
      new DailyRotateFile({
        filename:     path.join(logDir, 'error-%DATE%.log'),
        datePattern:  'YYYY-MM-DD',
        level:        'error',
        maxFiles:     '14d',
        zippedArchive: true,
        format:        fileFormat,
      }),
      new DailyRotateFile({
        filename:     path.join(logDir, 'combined-%DATE%.log'),
        datePattern:  'YYYY-MM-DD',
        maxFiles:     '14d',
        zippedArchive: true,
        format:        fileFormat,
      })
    );
  } catch (err) {
    console.warn('[logger] File transport not available:', err.message);
  }
}

const logger = createLogger({
  level:       isProduction ? 'info' : 'debug',
  exitOnError: false,
  transports:  transportList,
});

logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
