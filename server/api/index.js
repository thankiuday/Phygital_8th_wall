'use strict';

/**
 * Vercel serverless entry for the Express API.
 * Waits for MongoDB before loading the app (see src/config/db.js).
 */

require('dotenv').config();

const connectDB = require('../src/config/db');

let app;

module.exports = async (req, res) => {
  if (!app) {
    await connectDB();
    app = require('../index');
  }
  return app(req, res);
};
