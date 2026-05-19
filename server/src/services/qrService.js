'use strict';

const QRCode = require('qrcode');
const { uploadBuffer } = require('./storageService');

/**
 * generateQRCode
 *
 * Creates a QR code PNG for the AR page URL and uploads it to S3.
 *
 * @param {string} campaignId
 * @param {string} userId
 * @returns {Promise<{ qrCodeUrl: string, qrPublicId: string }>}
 */
const generateQRCode = async (campaignId, userId) => {
  const arPageUrl = `${process.env.CLIENT_URL}/ar/${campaignId}`;

  const dataUrl = await QRCode.toDataURL(arPageUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 512,
    margin: 2,
    color: {
      dark: '#7c3aed',
      light: '#ffffff',
    },
  });

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const key = `phygital8thwall/${userId}/qrcodes/qr_${campaignId}.png`;

  const uploadResult = await uploadBuffer({
    buffer,
    key,
    contentType: 'image/png',
    tags: 'status=permanent',
  });

  return {
    qrCodeUrl: uploadResult.url,
    qrPublicId: uploadResult.publicId,
  };
};

module.exports = { generateQRCode };
