'use strict';

const Campaign = require('../models/Campaign');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

/** URL-safe, no look-alikes (0/O, 1/l/I) — matches campaignController + client wizards. */
const REDIRECT_SLUG_ALPHABET =
  '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

const REDIRECT_SLUG_SIZE = 8;

let nanoidPromise = null;

const getNanoid8 = () => {
  if (!nanoidPromise) {
    nanoidPromise = import('nanoid').then((m) =>
      m.customAlphabet(REDIRECT_SLUG_ALPHABET, REDIRECT_SLUG_SIZE)
    );
  }
  return nanoidPromise;
};

/**
 * Allocate a unique 8-char redirectSlug for hub / dynamic QR routes.
 */
const generateUniqueRedirectSlug = async () => {
  const nanoid = await getNanoid8();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = nanoid();
    const exists = await Campaign.exists({ redirectSlug: slug });
    if (!exists) return slug;
    logger.warn('redirectSlug collision — retrying', { slug, attempt });
  }
  throw new AppError('Could not allocate a unique short URL — please retry', 500);
};

module.exports = {
  REDIRECT_SLUG_ALPHABET,
  REDIRECT_SLUG_SIZE,
  generateUniqueRedirectSlug,
};
