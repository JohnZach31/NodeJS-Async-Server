const mongoose = require('mongoose');
const pino = require('pino');
require('dotenv').config();

// Logger is shared by all database connection messages.
const logger = pino({ name: 'db' });

let connectionPromise = null;

// Reuses the same connection promise inside a process.
const connectToDatabase = async () => {
  // Ready state 1 means Mongoose is already connected.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // The database address must come from the environment file.
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from the .env file');
  }

  // Creates the connection only once for the current server.
  if (!connectionPromise) {
    // Timeout keeps startup from waiting forever.
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
  }

  // Waits for MongoDB and reports clear startup errors.
  try {
    await connectionPromise;
    logger.info('MongoDB connection established');
    return mongoose.connection;
  } catch (error) {
    // Reset lets the next call try connecting again.
    connectionPromise = null;
    logger.error({ err: error }, 'MongoDB connection failed');
    throw error;
  }
};

module.exports = {
  // Exported helper is used by all four services.
  connectToDatabase,
};
