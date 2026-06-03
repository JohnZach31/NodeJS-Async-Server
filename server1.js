const express = require('express');
const crypto = require('crypto');
const pino = require('pino');
const { connectToDatabase } = require('./db');
const Log = require('./models/Log');

// Service settings are loaded from the environment.
const port = Number(process.env.PORT) || Number(process.env.PORT1) || 3001;
const serviceName = 'logs-service';

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

// Returns all saved request logs, newest first.
app.get('/api/logs', async (req, res, next) => {
  try {
    // Pino writes an explicit endpoint access message.
    req.log.info('GET /api/logs endpoint accessed');

    const logs = await Log.find().sort({ createdAt: -1 }).lean();
    // Logs are returned as JSON documents.
    res.json(logs);
  } catch (error) {
    // Route errors are passed to the error middleware.
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
    logger.fatal({ err: error }, 'Failed to start logs service');
    process.exit(1);
  });
