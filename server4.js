const express = require('express');
const crypto = require('crypto');
const pino = require('pino');
require('dotenv').config();
const { connectToDatabase } = require('./db');
const Log = require('./models/Log');

// Service settings are loaded from the environment.
const port = Number(process.env.PORT) || Number(process.env.PORT4) || 3004;
const serviceName = 'about-service';

const app = express();
const logger = pino({ name: serviceName });

// Allows the service to read JSON request bodies.
app.use(express.json());

// Creates a normal Error object with an HTTP status code.
const createHttpError = (message, statusCode) => {
  const error = new Error(message);

  // The error middleware reads this property.
  error.statusCode = statusCode;
  return error;
};

// Reads developers from the environment without inventing extra members.
const getDevelopersFromEnv = () => {
  const rawDevelopers = [
    {
      first_name: process.env.DEVELOPER1_FIRST_NAME,
      last_name: process.env.DEVELOPER1_LAST_NAME,
    },
    {
      first_name: process.env.DEVELOPER2_FIRST_NAME,
      last_name: process.env.DEVELOPER2_LAST_NAME,
    },
    {
      first_name: process.env.DEVELOPER3_FIRST_NAME,
      last_name: process.env.DEVELOPER3_LAST_NAME,
    },
  ];

  // Keep only fully configured developers.
  return rawDevelopers.filter(
    (developer) => developer.first_name && developer.last_name
  );
};

// Persists every incoming request into the logs collection.
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  // Attaches the request id to the request lifecycle.
  req.requestId = requestId;
  req.log = logger.child({ requestId });

  // Saves the log only after Express finishes the response.
  res.on('finish', async () => {
    try {
      await Log.create({
        request_id: requestId,
        service: serviceName,
        // Store request metadata for later review.
        method: req.method,
        path: req.originalUrl,
        query: req.query || {},
        // Body and client data help debug failed requests.
        body: req.body || {},
        ip: req.ip || '',
        user_agent: req.get('user-agent') || '',
        // Store response status and request duration.
        status_code: res.statusCode,
        response_time_ms: Date.now() - startedAt,
      });
    } catch (error) {
      // Logging failures are written to the terminal.
      logger.error({ err: error, requestId }, 'Failed to save request log');
    }
  });

  // Logging setup is done before route handling.
  // Continue to the requested route.
  next();
});

// Returns the project developers from environment variables.
app.get('/api/about', (req, res, next) => {
  try {
    // Pino writes an explicit endpoint access message.
    req.log.info('GET /api/about endpoint accessed');

    const developers = getDevelopersFromEnv();

    // At least one real team member must be configured.
    if (developers.length === 0) {
      throw createHttpError(
        'At least one developer must be configured in the .env file',
        500
      );
    }

    // Returns the developers as a JSON array.
    res.json(developers);
  } catch (error) {
    next(error);
  }
});

// Sends errors in one consistent JSON structure.
app.use((error, req, res, next) => {
  const errorId = req.requestId || crypto.randomUUID();
  logger.error({ err: error, errorId }, 'Unhandled application error');

  // Client receives the tracking id and message.
  res.status(error.statusCode || 500).json({
    id: errorId,
    message: error.message || 'Internal Server Error',
  });
});

// Starts the service only after the database is ready.
connectToDatabase()
  .then(() => {
    app.listen(port, () => {
      // Confirms the service port in the terminal.
      logger.info(`Server is listening on port ${port}`);
    });
  })
  .catch((error) => {
    // Startup failure should stop the process.
    logger.fatal({ err: error }, 'Failed to start about service');
    process.exit(1);
  });
