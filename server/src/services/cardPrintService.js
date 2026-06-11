'use strict';

/**
 * cardPrintService.js — high-resolution PNG renderer for digital business
 * cards. Two backends:
 *
 *   1. **Direct (default)** — synchronous Puppeteer launch with strict rate
 *      limit on the route. Fine for dev, low traffic, and as a fallback if
 *      Redis is unavailable.
 *
 *   2. **BullMQ render queue (when REDIS_URL is set)** — controller enqueues
 *      a job, returns `{ status: 'pending', jobId }`, and a separate worker
 *      process (`workers/cardRenderWorker.js`) consumes jobs. This keeps a
 *      sudden burst of downloads from spinning up Chromium on the API box.
 *
 * Result caching: every render is keyed by a hash of the card's content +
 * design + print settings + size. Identical re-renders are served from the
 * S3 cache without launching Chromium again, which is the single
 * biggest scaling win for this feature.
 *
 * Output S3 path: `phygital8thwall/{userId}/cards/{hash}.png`.
 */

const crypto = require('crypto');
const fs = require('fs');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client, getBucket } = require('../config/s3');
const { uploadBuffer, headObject, publicUrlForKey, getPresignedReadUrlForKey } = require('./storageService');
const logger = require('../config/logger');

const RENDER_TOKEN_TTL_MS = 5 * 60 * 1000;
const RENDER_TOKEN_SECRET =
  process.env.CARD_RENDER_TOKEN_SECRET
  || process.env.JWT_SECRET
  || process.env.IP_SALT
  || 'phygital8thwall-card-render-secret';

const CARD_RENDER_QUEUE_NAME = 'card-render';
const toErrorMeta = (err) => {
  if (!err) return { message: 'unknown error' };
  if (err instanceof Error) {
    return {
      name: err.name,
      message: String(err.message || 'unknown error').slice(0, 500),
      code: err.code || null,
    };
  }
  if (typeof err === 'string') return { message: err };
  return { message: String(err) };
};

const cardStorageKey = ({ userId, renderHash }) =>
  `phygital8thwall/${userId}/cards/${renderHash}.png`;

/** Private S3 objects must use presigned GET URLs for browser downloads. */
const withSignedDownloadUrl = async (payload) => {
  if (!payload) return payload;
  const publicId = payload.public_id || payload.publicId;
  const signed = publicId ? await getPresignedReadUrlForKey(publicId) : null;
  if (!signed) return payload;
  return { ...payload, url: signed };
};

const uploadPngBuffer = async ({ buffer, userId, renderHash }) => {
  const key = cardStorageKey({ userId, renderHash });
  const result = await uploadBuffer({
    buffer,
    key,
    contentType: 'image/png',
    tags: 'status=permanent',
  });
  return {
    secure_url: result.url,
    public_id: result.publicId,
  };
};

/**
 * Mints a short-lived HMAC token so headless Chromium can fetch the print
 * page without requiring a session cookie. The token is opaque to the
 * client; only the print page's middleware needs to verify it.
 */
const mintPrintToken = (campaignId, ttlMs = RENDER_TOKEN_TTL_MS) => {
  const exp = Date.now() + ttlMs;
  const payload = `${campaignId}.${exp}`;
  const sig = crypto.createHmac('sha256', RENDER_TOKEN_SECRET).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
};

const verifyPrintToken = (token, expectedCampaignId) => {
  try {
    const decoded = Buffer.from(String(token), 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return false;
    const [campaignId, expStr, sig] = parts;
    if (campaignId !== String(expectedCampaignId)) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    const expectedSig = crypto.createHmac('sha256', RENDER_TOKEN_SECRET)
      .update(`${campaignId}.${exp}`)
      .digest('hex')
      .slice(0, 32);
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   S3 cache helpers
   ─────────────────────────────────────────────────────────────────────────── */

const lookupCachedRender = async ({ userId, renderHash }) => {
  const public_id = cardStorageKey({ userId, renderHash });
  const exists = await headObject(public_id);
  if (!exists) return null;
  return {
    url: publicUrlForKey(public_id),
    public_id,
    cached: true,
  };
};

/* ─────────────────────────────────────────────────────────────────────────────
   Puppeteer browser singleton — one Chromium per process, lazy-launched.
   The worker resets the singleton after a configurable number of renders to
   guard against memory creep.
   ─────────────────────────────────────────────────────────────────────────── */

let browserPromise = null;
let rendersOnCurrentBrowser = 0;
const MAX_RENDERS_PER_BROWSER = Number(process.env.CARD_RENDER_MAX_PER_BROWSER) || 200;

const SYSTEM_CHROMIUM_CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/snap/bin/chromium',
];

const resolveChromiumExecutable = (puppeteer) => {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  for (const candidate of SYSTEM_CHROMIUM_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }

  try {
    const bundled = puppeteer.executablePath?.();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    /* fall through */
  }

  if (fromEnv) return fromEnv;
  return undefined;
};

const getBrowser = async () => {
  if (browserPromise && rendersOnCurrentBrowser < MAX_RENDERS_PER_BROWSER) {
    return browserPromise;
  }
  if (browserPromise) {
    try {
      const old = await browserPromise;
      old.close().catch(() => {});
    } catch {/* noop */}
    browserPromise = null;
  }
  rendersOnCurrentBrowser = 0;

  // Resolve the runtime: prefer full puppeteer, fall back to puppeteer-core +
  // an env-supplied executable (so deployments on Render can use the system
  // Chromium build at /usr/bin/google-chrome-stable etc.).
  let puppeteer;
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--font-render-hinting=none',
  ];

  try {
    puppeteer = require('puppeteer');
  } catch (errFull) {
    try {
      puppeteer = require('puppeteer-core');
    } catch (errCore) {
      const msg = 'Card rendering requires `puppeteer` or `puppeteer-core` to be installed';
      logger.error(msg, { puppeteerError: errFull.message, coreError: errCore.message });
      throw new Error(msg);
    }
  }

  const executablePath = resolveChromiumExecutable(puppeteer);
  if (!executablePath) {
    throw new Error(
      'Chromium not found. On the VPS run: apt install -y chromium-browser (or set PUPPETEER_EXECUTABLE_PATH)'
    );
  }

  browserPromise = puppeteer.launch({
    headless: 'new',
    args: launchArgs,
    executablePath,
    defaultViewport: null,
  });
  const browser = await browserPromise;
  browser.on('disconnected', () => {
    if (browserPromise) browserPromise = null;
  });
  return browser;
};

/* ─────────────────────────────────────────────────────────────────────────────
   Direct render path — used when REDIS_URL is absent or BullMQ is unavailable.
   ─────────────────────────────────────────────────────────────────────────── */

const { getCardSize } = require('../constants/cardSizes');

const renderDirect = async ({ campaignId, userId, cardSlug, size, face, renderHash }) => {
  const sizeSpec = getCardSize(size);
  const requestedFace = face === 'back' ? 'back' : 'front';
  const renderScaleRaw = Number.parseInt(process.env.CARD_RENDER_DPR || '', 10);
  const renderScale =
    Number.isFinite(renderScaleRaw) && renderScaleRaw >= 1
      ? Math.min(renderScaleRaw, 8)
      : 3;
  const browser = await getBrowser();
  const page = await browser.newPage();
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err?.message || String(err));
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`);
  });
  try {
    await page.setViewport({
      width: sizeSpec.bleed.widthPx,
      height: sizeSpec.bleed.heightPx,
      deviceScaleFactor: renderScale,
    });

    const clientBase = (process.env.CLIENT_URL || '').replace(/\/$/, '');
    if (!clientBase) {
      throw new Error('CLIENT_URL must be configured to render card images');
    }
    // Token binds to the campaign id so direct-URL access can never trigger
    // a render even though we route Puppeteer via the public slug (which the
    // print page uses to look up the card's public meta document).
    const token = mintPrintToken(campaignId);
    const slug = cardSlug || campaignId;
    const url = `${clientBase}/print/card/${slug}?size=${encodeURIComponent(size)}&face=${encodeURIComponent(requestedFace)}&token=${encodeURIComponent(token)}&campaignId=${encodeURIComponent(campaignId)}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // The print page paints a sentinel attribute when fonts/images/QR are settled.
    try {
      await page.waitForSelector('[data-print-ready="1"]', { timeout: 90_000 });
    } catch (err) {
      throw new Error(
        `Print page did not become ready in time (${requestedFace}). ${err.message}`
      );
    }

    const buffer = await page.screenshot({
      type: 'png',
      omitBackground: false,
      clip: {
        x: 0,
        y: 0,
        width: sizeSpec.bleed.widthPx,
        height: sizeSpec.bleed.heightPx,
      },
    });

    rendersOnCurrentBrowser += 1;

    // Upload and cache.
    const upload = await uploadPngBuffer({ buffer, userId, renderHash });

    return { url: upload.secure_url, public_id: upload.public_id, cached: false };
  } catch (err) {
    const errMeta = toErrorMeta(err);
    logger.error('cardPrintService.renderDirect failed', {
      campaignId,
      userId,
      cardSlug,
      size,
      face: requestedFace,
      renderHash,
      error: errMeta,
      pageErrors: pageErrors.slice(0, 3).map((x) => String(x).slice(0, 300)),
      failedRequests: failedRequests.slice(0, 5).map((x) => String(x).slice(0, 300)),
    });
    throw new Error(`Card render failed (${requestedFace}): ${errMeta.message}`);
  } finally {
    await page.close().catch(() => {});
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   BullMQ render queue (lazy / optional). Mirrors `utils/scanQueue.js` so the
   shape stays familiar to the rest of the codebase.
   ─────────────────────────────────────────────────────────────────────────── */

const buildBullmqAdapter = (redisUrl) => {
  let Queue;
  try {
    ({ Queue } = require('bullmq'));
  } catch (err) {
    logger.warn('cardRenderQueue: REDIS_URL set but bullmq is not installed — falling back to direct rendering', {
      error: err.message,
    });
    return null;
  }
  let connection;
  try {
    const url = new URL(redisUrl);
    connection = {
      host: url.hostname,
      port: Number(url.port) || 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    logger.warn('cardRenderQueue: invalid REDIS_URL — falling back to direct rendering');
    return null;
  }

  const queue = new Queue(CARD_RENDER_QUEUE_NAME, { connection });
  logger.info('cardRenderQueue: backend=bullmq');

  return {
    backend: 'bullmq',
    async enqueue(data) {
      const job = await queue.add('render', data, {
        removeOnComplete: 200,
        removeOnFail: 1000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 4000 },
      });
      return job.id;
    },
    async getJob(jobId) {
      return queue.getJob(jobId);
    },
  };
};

const queueAdapter = process.env.REDIS_URL ? buildBullmqAdapter(process.env.REDIS_URL) : null;
if (!queueAdapter) {
  logger.info('cardRenderQueue: backend=direct');
}

/* ─────────────────────────────────────────────────────────────────────────────
   Public API
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Render (or fetch a cached version of) a card PNG.
 *
 * Resolution order:
 *   1. S3 cache for `(userId, renderHash)` → return `status: 'ready'`.
 *   2. BullMQ enqueue (when Redis is on)         → return `status: 'pending'`.
 *   3. Synchronous Puppeteer render              → return `status: 'ready'`.
 *
 * Callers should always handle both shapes; the client polls the status
 * endpoint when it sees `status: 'pending'`.
 */
const renderCardPng = async ({ campaignId, userId, cardSlug, size, face, renderHash }) => {
  const requestedFace = face === 'back' ? 'back' : 'front';
  const filename = `card-${cardSlug || campaignId}-${size}-${requestedFace}.png`;

  const cached = await lookupCachedRender({ userId, renderHash });
  if (cached) {
    return await withSignedDownloadUrl({
      status: 'ready',
      url: cached.url,
      public_id: cached.public_id,
      filename,
      face: requestedFace,
      cached: true,
    });
  }

  if (queueAdapter) {
    try {
      const jobId = await queueAdapter.enqueue({
        campaignId,
        userId,
        cardSlug,
        size,
        face: requestedFace,
        renderHash,
      });
      return {
        status: 'pending',
        jobId,
        backend: 'bullmq',
        filename,
        face: requestedFace,
      };
    } catch (err) {
      logger.warn('cardRenderQueue.enqueue failed — falling back to direct render', { error: err.message });
    }
  }

  const direct = await renderDirect({ campaignId, userId, cardSlug, size, face: requestedFace, renderHash });
  return await withSignedDownloadUrl({
    status: 'ready',
    url: direct.url,
    public_id: direct.public_id,
    filename,
    face: requestedFace,
    cached: false,
  });
};

/**
 * Worker entrypoint — exposed so `workers/cardRenderWorker.js` can import the
 * same render function rather than re-implementing it.
 */
const renderCardJob = async ({ campaignId, userId, cardSlug, size, face, renderHash }) =>
  renderDirect({ campaignId, userId, cardSlug, size, face, renderHash });

const getRenderJobStatus = async (jobId) => {
  if (!queueAdapter || !jobId) return { status: 'unknown' };
  try {
    const job = await queueAdapter.getJob(jobId);
    if (!job) return { status: 'unknown' };
    const state = await job.getState();
    if (state === 'completed') {
      return await withSignedDownloadUrl({ status: 'ready', ...job.returnvalue });
    }
    if (state === 'failed') {
      return { status: 'failed', reason: job.failedReason || 'render failed' };
    }
    return { status: 'pending', state };
  } catch (err) {
    logger.warn('cardRenderQueue.getJob failed', { error: err.message });
    return { status: 'unknown' };
  }
};

const getCachedCardDownload = async ({ userId, renderHash, filename, face }) => {
  const cached = await lookupCachedRender({ userId, renderHash });
  if (!cached) return null;
  return await withSignedDownloadUrl({
    status: 'ready',
    url: cached.url,
    public_id: cached.public_id,
    filename,
    face,
    cached: true,
  });
};

const safeAttachmentFilename = (filename) =>
  String(filename || 'card.png').replace(/["\r\n]/g, '').replace(/[^\w.-]+/g, '_');

/**
 * Stream a cached card PNG through the API with Content-Disposition: attachment
 * so browsers save the file instead of opening a new tab.
 */
const streamCachedCardPng = async ({ userId, renderHash, filename }, res) => {
  const cached = await lookupCachedRender({ userId, renderHash });
  if (!cached?.public_id) return false;

  const s3 = getS3Client();
  const obj = await s3.send(new GetObjectCommand({
    Bucket: getBucket(),
    Key: cached.public_id,
  }));

  const safeFilename = safeAttachmentFilename(filename);
  res.setHeader('Content-Type', obj.ContentType || 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  if (typeof obj.ContentLength === 'number') {
    res.setHeader('Content-Length', String(obj.ContentLength));
  }

  const body = obj.Body;
  if (body && typeof body.pipe === 'function') {
    body.on('error', (err) => {
      logger.error('cardPrintService.streamCachedCardPng pipe failed', { error: err?.message });
      if (!res.headersSent) res.status(500).end();
    });
    body.pipe(res);
    return true;
  }

  const bytes = await body.transformToByteArray();
  res.send(Buffer.from(bytes));
  return true;
};

module.exports = {
  renderCardPng,
  renderCardJob,
  getRenderJobStatus,
  getCachedCardDownload,
  streamCachedCardPng,
  lookupCachedRender,
  mintPrintToken,
  verifyPrintToken,
  CARD_RENDER_QUEUE_NAME,
  usesRenderQueue: () => !!queueAdapter,
};
