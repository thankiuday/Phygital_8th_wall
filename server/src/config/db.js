'use strict';

const mongoose = require('mongoose');
const { ensureAdminBootstrapUser } = require('../services/adminBootstrapService');

/** @type {Promise<typeof mongoose> | null} */
let connectPromise = null;

const isServerless = () => process.env.VERCEL === '1';

/**
 * connectDB — MongoDB Atlas connection (cached for serverless cold starts).
 */
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI);

      console.info(`✓ MongoDB connected: ${conn.connection.host}`);

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected. Attempting to reconnect...');
        connectPromise = null;
      });

      await ensureAdminBootstrapUser();
      return conn;
    } catch (error) {
      connectPromise = null;
      console.error('MongoDB initial connection failed:', error.message);
      if (isServerless()) {
        throw error;
      }
      process.exit(1);
    }
  })();

  return connectPromise;
};

module.exports = connectDB;
