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
// Default production client URL — used when Origin header is absent
// Render auto-converts service names — check your Render dashboard for exact URLs
const PRODUCTION_CLIENT =
  process.env.CLIENT_URL || 'https://phygital8thwall-client.onrender.com';

app.use((req, res, next) => {
  // Reflect the exact incoming Origin; fall back to the production client URL.
  // NEVER use '*' with credentials:true — browsers reject it silently.
  const origin = req.headers.origin || PRODUCTION_CLIENT;

  res.setHeader('Access-Control-Allow-Origin',      origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods',     'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',     'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age',           '86400');
  res.setHeader('Vary',                             'Origin');

  // Answer preflight immediately — before Helmet, rate-limiter, body-parser, etc.
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
   Trust proxy — Cloudflare → Render (and similar) often needs >1 hop so
   req.ip / X-Forwarded-For stay usable when cf-connecting-ip is absent.
   ───────────────────────────────────────── */
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS);
app.set(
  'trust proxy',
  Number.isFinite(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 2
);

/* ─────────────────────────────────────────
   Global Rate Limiter — safety net per IP (prod only)
   Tunable: GLOBAL_RATE_LIMIT_MAX, GLOBAL_RATE_LIMIT_WINDOW_MS
   ───────────────────────────────────────── */
const globalWindowMs = Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS);
const globalMax = Number(process.env.GLOBAL_RATE_LIMIT_MAX);
const globalLimiter = rateLimit({
  windowMs:
    Number.isFinite(globalWindowMs) && globalWindowMs >= 1000
      ? globalWindowMs
      : 15 * 60 * 1000,
  max:
    Number.isFinite(globalMax) && globalMax >= 10
      ? globalMax
      : 1200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  // The redirect endpoint has its own per-IP + per-slug limiter — exempt it
  // from the (much stricter) auth-API limiter so a popular QR doesn't get
  // throttled.  /health is also exempted so the platform's health probes don't
  // burn the budget.  OPTIONS skipped if it ever runs after CORS short-circuit.
  skip: (req) =>
    process.env.NODE_ENV !== 'production' ||
    req.method === 'OPTIONS' ||
    req.path === '/health' ||
    req.path.startsWith('/r/'),
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
const { redirectCache } = require('./src/utils/redirectCache');
const scanQueue     = require('./src/utils/scanQueue');

app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'Phygital8ThWall API',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
    uptime:    Math.round(process.uptime()),
    corsMode:  'reflect-all-origins',
    origin:    req.headers.origin || '(none)',
    backends:  {
      cache: redirectCache.backend,
      queue: scanQueue.backend,
    },
  });
});

/* Debug — echo headers so you can verify CORS is working from the client */
app.get('/cors-debug', (req, res) => {
  res.json({
    receivedOrigin:          req.headers.origin,
    acao:                    res.getHeader('Access-Control-Allow-Origin'),
    acac:                    res.getHeader('Access-Control-Allow-Credentials'),
    allRequestHeaders:       req.headers,
  });
});

/* ─────────────────────────────────────────
   API Routes
   ───────────────────────────────────────── */
const { protect } = require('./src/middleware/auth');
const { validate } = require('./src/middleware/validate');
const {
  createSingleLinkOnlySchema,
  createMultipleLinksOnlySchema,
} = require('./src/validators/campaignValidators');
const {
  createSingleLinkCampaign,
  createMultipleLinksCampaign,
} = require('./src/controllers/campaignController');

/**
 * Single Link QR — registered on the root app *before* the `/api/campaigns`
 * router so `POST …/single-link` always resolves (some deployments were still
 * serving an older `campaignRoutes` bundle without this path).
 */
app.post(
  '/api/campaigns/single-link',
  protect,
  validate(createSingleLinkOnlySchema),
  createSingleLinkCampaign
);

app.post(
  '/api/campaigns/multiple-links',
  protect,
  validate(createMultipleLinksOnlySchema),
  createMultipleLinksCampaign
);

app.use('/api/auth',      require('./src/routes/authRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));
app.use('/api/campaigns', require('./src/routes/campaignRoutes'));
app.use('/api/public',    require('./src/routes/publicRoutes'));
app.use('/api/analytics', require('./src/routes/analyticsRoutes'));
app.use('/api/admin',     require('./src/routes/adminRoutes'));

/* ─────────────────────────────────────────
   Public Dynamic-QR Redirect
   Mounted at the app root (NOT under /api) so the encoded URL is short:
       https://api.example.com/r/abcd1234
   Every byte saved here matters because the slug travels inside a printed QR.
   ───────────────────────────────────────── */
app.use('/r', require('./src/routes/redirectRoutes'));

/* ─────────────────────────────────────────
   Error Handling (must be last)
   ───────────────────────────────────────── */
app.use(notFound);
app.use(errorHandler);

/* ─────────────────────────────────────────
   Start Server
   ───────────────────────────────────────── */
const server = app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    env:  process.env.NODE_ENV || 'development',
    url:  `http://localhost:${PORT}`,
  });
});

/* ─────────────────────────────────────────
   HTTP keep-alive tuning for reverse proxies
   (Render / Fly / ALB hold sockets open ~60 s by default).  Node's defaults
   are too tight, which causes intermittent ECONNRESET on busy /r/:slug
   traffic.  headersTimeout MUST be > keepAliveTimeout to satisfy the Node
   contract introduced after CVE-2018-0739.
   ───────────────────────────────────────── */
server.keepAliveTimeout = 65_000;
server.headersTimeout   = 66_000;

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
