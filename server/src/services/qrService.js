'use strict';

const QRCode = require('qrcode');
const { cloudinary, configureCloudinary } = require('../config/cloudinary');

configureCloudinary();

/**
 * generateQRCode
 *
 * Creates a QR code PNG for the given AR page URL and uploads it to Cloudinary.
 * Returns the public CDN URL of the QR image.
 *
 * Strategy:
 *   1. Generate QR as a base64 PNG data-URI in memory (no temp files needed).
 *   2. Stream it directly to Cloudinary upload API.
 *   3. Store the returned secure_url on the Campaign document.
 *
 * @param {string} campaignId  — MongoDB _id of the campaign
 * @param {string} userId      — Owner's _id (for folder organisation)
 * @returns {Promise<{ qrCodeUrl: string, qrPublicId: string }>}
 */
const generateQRCode = async (campaignId, userId) => {
  const arPageUrl = `${process.env.CLIENT_URL}/ar/${campaignId}`;

  // Build a styled QR code data URL
  const dataUrl = await QRCode.toDataURL(arPageUrl, {
    errorCorrectionLevel: 'H',  // High — tolerates up to 30% damage
    type: 'image/png',
    width: 512,
    margin: 2,
    color: {
      dark: '#7c3aed',   // brand purple dots
      light: '#ffffff',  // white background
    },
  });

  // Upload the base64 PNG to Cloudinary
  const uploadResult = await cloudinary.uploader.upload(dataUrl, {
    folder: `phygital8thwall/${userId}/qrcodes`,
    public_id: `qr_${campaignId}`,
    overwrite: true,
    resource_type: 'image',
    format: 'png',
  });

  return {
    qrCodeUrl: uploadResult.secure_url,
    qrPublicId: uploadResult.public_id,
  };
};

module.exports = { generateQRCode };
