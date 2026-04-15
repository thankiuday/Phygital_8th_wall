'use strict';

// ── Load .env first — before any other imports ──────────────────────────────
require('dotenv').config();

// ── Validate required env vars — crash fast if any are missing ──────────────
require('./src/utils/validateEnv')();

// ── Patch all async route errors to Express error handler automatically ──────
require('express-async-errors');

const express      = require('express');
const cors         = require('cors');
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
   Security Headers (Helmet)
   ───────────────────────────────────────── */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,           // required for AR engine camera access
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'apps.8thwall.com'],
        styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc:     ["'self'", 'fonts.gstatic.com'],
        imgSrc:      ["'self'", 'data:', 'res.cloudinary.com', 'blob:'],
        mediaSrc:    ["'self'", 'res.cloudinary.com', 'blob:'],
        connectSrc:  ["'self'", 'api.cloudinary.com'],
        frameSrc:    ["'none'"],
        objectSrc:   ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

/* ─────────────────────────────────────────
   CORS
   ───────────────────────────────────────── */
const allowedOrigins = [
  // Local development
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  // Production — injected via env vars on Render
  process.env.CLIENT_URL,
  process.env.AR_ENGINE_URL,
  // Production — hardcoded fallback (in case env vars aren't set yet)
  'https://phygital8thwall-client.onrender.com',
  'https://phygital8thwall-ar.onrender.com',
].filter(Boolean); // remove any undefined entries

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked', { origin });
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods:      ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/* ─────────────────────────────────────────
   Compression — gzip all JSON responses
   ───────────────────────────────────────── */
app.use(compression({ level: 6, threshold: 1024 }));

/* ─────────────────────────────────────────
   Trust proxy (needed behind Render/Railway/Vercel reverse proxy)
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
  skip: (req) => req.path === '/health', // never rate-limit health checks
});
app.use(globalLimiter);

/* ─────────────────────────────────────────
   HTTP Parameter Pollution protection
   ───────────────────────────────────────── */
app.use(hpp({ whitelist: ['status', 'page', 'limit', 'period', 'role'] }));

/* ─────────────────────────────────────────
   Body Parsers
   ───────────────────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

/* ─────────────────────────────────────────
   Input Sanitization (must run after body parsing)
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
      // Skip health-check noise in logs
      skip: (_req, res) => res.statusCode < 400 && process.env.NODE_ENV === 'production',
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
  });
});

/* ─────────────────────────────────────────
   API Routes
   ───────────────────────────────────────── */
app.use('/api/auth',      require('./src/routes/authRoutes'));        // Module 2
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));   // Module 3
app.use('/api/campaigns', require('./src/routes/campaignRoutes'));    // Module 4
app.use('/api/public',    require('./src/routes/publicRoutes'));      // Module 5 — no auth
app.use('/api/analytics', require('./src/routes/analyticsRoutes'));   // Module 7
app.use('/api/admin',     require('./src/routes/adminRoutes'));       // Module 9

/* ─────────────────────────────────────────
   Error Handling (must be last)
   ───────────────────────────────────────── */
app.use(notFound);
app.use(errorHandler);

/* ─────────────────────────────────────────
   Start Server
   ───────────────────────────────────────── */
app.listen(PORT, () => {
  logger.info(`Server started`, {
    port: PORT,
    env:  process.env.NODE_ENV || 'development',
    url:  `http://localhost:${PORT}`,
  });
});

/* ─────────────────────────────────────────
   Unhandled rejection / exception safety net
   ───────────────────────────────────────── */
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = app;
