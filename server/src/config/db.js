'use strict';

const mongoose = require('mongoose');

/**
 * connectDB — establishes a MongoDB Atlas connection.
 * Exits the process on first-time connection failure.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options are no longer needed in Mongoose 7+, but kept for clarity
    });

    console.info(`✓ MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });
  } catch (error) {
    console.error('MongoDB initial connection failed:', error.message);
    process.exit(1); // fatal — cannot run without DB
  }
};

module.exports = connectDB;
