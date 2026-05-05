'use strict';

const crypto = require('crypto');
const { cloudinary, configureCloudinary } = require('../config/cloudinary');

// Ensure Cloudinary is configured before any upload calls
configureCloudinary();

/* ─────────────────────────────────────────
   SIGNED UPLOAD — generate a signature so the
   client can upload directly to Cloudinary CDN.
   The raw API secret never leaves the server.
   ───────────────────────────────────────── */

/**
 * generateUploadSignature
 *
 * Returns params the client needs to POST a file directly to:
 *   https://api.cloudinary.com/v1_1/<cloud_name>/<resource_type>/upload
 *
 * @param {object} options
 * @param {'image'|'video'|'raw'} options.resourceType
 * @param {string}                options.folder       — Cloudinary folder path
 * @param {number}                [options.maxBytes]   — optional byte limit (not enforced server-side but included for reference)
 */
const generateUploadSignature = (options) => {
  const { resourceType = 'image', folder } = options;

  const timestamp = Math.round(Date.now() / 1000);

  // Build the string-to-sign — params must be alphabetically sorted
  const paramsToSign = {
    folder,
    timestamp,
  };

  const stringToSign = Object.entries(paramsToSign)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const signature = crypto
    .createHash('sha256')
    .update(stringToSign + process.env.CLOUDINARY_API_SECRET)
    .digest('hex');

  return {
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    resourceType,
  };
};

/* ─────────────────────────────────────────
   SERVER-SIDE DELETE — remove an asset from
   Cloudinary when a campaign is deleted.
   ───────────────────────────────────────── */

/**
 * deleteCloudinaryAsset
 * @param {string}                publicId
 * @param {'image'|'video'|'raw'} resourceType
 */
const deleteCloudinaryAsset = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error(`Cloudinary delete failed for ${publicId}:`, err.message);
  }
};

module.exports = { generateUploadSignature, deleteCloudinaryAsset };
