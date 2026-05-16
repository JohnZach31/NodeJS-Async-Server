const express = require('express');
const crypto = require('crypto');
const pino = require('pino');
require('dotenv').config();
const { connectToDatabase } = require('./db');
const Log = require('./models/Log');

// Service settings are loaded from the environment.
const port = Number(process.env.PORT4) || 3004;
const serviceName = 'about-service';

const app = express();
const logger = pino({ name: serviceName });

// Allows the service to read JSON request bodies.
app.use(express.json());

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
app.get('/api/about', (req, res) => {
  const developers = [
    // First developer is configured in the environment file.
    {
      first_name: process.env.DEVELOPER1_FIRST_NAME || 'FirstDeveloper',
      last_name: process.env.DEVELOPER1_LAST_NAME || 'LastDeveloper',
    },
    // Second developer is configured in the environment file.
    {
      first_name: process.env.DEVELOPER2_FIRST_NAME || 'SecondDeveloper',
      last_name: process.env.DEVELOPER2_LAST_NAME || 'LastDeveloper',
    },
    // Third developer is configured in the environment file.
    {
      first_name: process.env.DEVELOPER3_FIRST_NAME || 'ThirdDeveloper',
      last_name: process.env.DEVELOPER3_LAST_NAME || 'LastDeveloper',
    },
  ];

  // Returns the developers as a JSON array.
  res.json(developers);
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
