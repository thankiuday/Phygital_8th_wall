'use strict';

// ── Load .env first — before any other imports ──────────────────────────────
require('dotenv').config();

// ── Validate required env vars — crash fast if any are missing ──────────────
require('./src/utils/validateEnv')();

// ── Patch all async route errors to Express error handler automatically ──────
require('express-async-errors');

const express      = require('express');
const helmet       = require('helmet');
const compression  = require('compression');
const hpp          = require('hpp');
const cookieParser = require('cookie-parser');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const connectDB    = require('./src/config/db');
const logger       = require('./src/config/logger');
const sanitize     = require('./src/middleware/sanitize');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

/* ─────────────────────────────────────────
   Database Connection
   ───────────────────────────────────────── */
connectDB();

/* ─────────────────────────────────────────
   CORS — MUST be the very first middleware.
   Manual implementation guarantees headers
   are present on every response, including
   errors thrown by later middleware.
   ───────────────────────────────────────── */
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'https://phygital8thwall-client.onrender.com',
  'https://phygital8thwall-ar.onrender.com',
  process.env.CLIENT_URL,
  process.env.AR_ENGINE_URL,
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Always set Vary so caches handle multi-origin correctly
  res.setHeader('Vary', 'Origin');

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight 24 h
  }

  // Respond to preflight immediately — before helmet, rate-limit, etc.
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

/* ─────────────────────────────────────────
   Security Headers (Helmet) — after CORS
   ───────────────────────────────────────── */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // Disabled — this is an API server, not a browser page
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

/* ─────────────────────────────────────────
   Compression
   ───────────────────────────────────────── */
app.use(compression({ level: 6, threshold: 1024 }));

/* ─────────────────────────────────────────
   Trust proxy (Render / Railway reverse proxy)
   ───────────────────────────────────────── */
app.set('trust proxy', 1);

/* ─────────────────────────────────────────
   Global Rate Limiter — 100 req / 15 min per IP
   ───────────────────────────────────────── */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  skip: (req) => req.path === '/health',
});
app.use(globalLimiter);

/* ─────────────────────────────────────────
   HTTP Parameter Pollution
   ───────────────────────────────────────── */
app.use(hpp({ whitelist: ['status', 'page', 'limit', 'period', 'role'] }));

/* ─────────────────────────────────────────
   Body Parsers
   ───────────────────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

/* ─────────────────────────────────────────
   Input Sanitization
   ───────────────────────────────────────── */
app.use(sanitize);

/* ─────────────────────────────────────────
   HTTP Request Logger
   ───────────────────────────────────────── */
app.use(
  morgan(
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    {
      stream: logger.stream,
      skip: (_req, res) =>
        res.statusCode < 400 && process.env.NODE_ENV === 'production',
    }
  )
);

/* ─────────────────────────────────────────
   Health Check
   ───────────────────────────────────────── */
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'Phygital8ThWall API',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
    uptime:    Math.round(process.uptime()),
    cors:      ALLOWED_ORIGINS,
  });
});

/* ─────────────────────────────────────────
   API Routes
   ───────────────────────────────────────── */
app.use('/api/auth',      require('./src/routes/authRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));
app.use('/api/campaigns', require('./src/routes/campaignRoutes'));
app.use('/api/public',    require('./src/routes/publicRoutes'));
app.use('/api/analytics', require('./src/routes/analyticsRoutes'));
app.use('/api/admin',     require('./src/routes/adminRoutes'));

/* ─────────────────────────────────────────
   Error Handling (must be last)
   ───────────────────────────────────────── */
app.use(notFound);
app.use(errorHandler);

/* ─────────────────────────────────────────
   Start Server
   ───────────────────────────────────────── */
app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    env:  process.env.NODE_ENV || 'development',
    url:  `http://localhost:${PORT}`,
  });
});

/* ─────────────────────────────────────────
   Safety net
   ───────────────────────────────────────── */
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

module.exports = app;
