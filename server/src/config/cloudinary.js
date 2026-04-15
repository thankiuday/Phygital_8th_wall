'use strict';

const cloudinary = require('cloudinary').v2;

/**
 * configureCloudinary — initializes Cloudinary SDK with env credentials.
 * Called once at app startup. All uploads use the returned instance.
 */
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true, // always use HTTPS URLs
  });

  console.info('✓ Cloudinary configured');
  return cloudinary;
};

module.exports = { cloudinary, configureCloudinary };
