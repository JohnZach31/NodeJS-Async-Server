const express = require('express');
const crypto = require('crypto');
const pino = require('pino');
// Import shared database and model modules.
const { connectToDatabase } = require('./db');
const User = require('./models/User');
const { Cost } = require('./models/Cost');
const Log = require('./models/Log');

// Users service owns user creation and user lookup.
// Service settings are loaded from the environment.
const port = Number(process.env.PORT2) || 3002;
const serviceName = 'users-service';

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

// Creates a new user from the request body.
app.post('/api/add', async (req, res, next) => {
  try {
    const { id, first_name, last_name, birthday } = req.body;

    // Mongoose validates required fields and data types.
    const createdUser = await User.create({
      // The assignment uses a numeric user id.
      id,
      first_name,
      last_name,
      birthday,
    });

    // Created users are returned with status 201.
    res.status(201).json(createdUser);
  } catch (error) {
    // Duplicate user ids should return a clear conflict error.
    if (error.code === 11000) {
      error.statusCode = 409;
      error.message = 'A user with this id already exists';
    } else if (error.name === 'ValidationError') {
      // Invalid user input returns a bad request.
      error.statusCode = 400;
    }

    next(error);
  }
});

// Returns all users sorted by their numeric id.
app.get('/api/users', async (req, res, next) => {
  try {
    const users = await User.find().sort({ id: 1 }).lean();
    // The response is a simple array of users.
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Returns one user together with the total expense sum.
app.get('/api/users/:id', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    // The URL parameter must be a number.
    if (Number.isNaN(userId)) {
      const error = new Error('User id must be a valid number');
      error.statusCode = 400;
      throw error;
    }

    // Find the requested user before calculating costs.
    const user = await User.findOne({ id: userId }).lean();

    // This lookup is used before calculating the total.
    // The next block handles the not found case.
    // The database query returns null for missing users.
    // Stop early when the user does not exist.
    // A missing user returns a not found response.
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Aggregates all costs that belong to this user.
    const costSummary = await Cost.aggregate([
      { $match: { userid: userId } },
      {
        // Sum all expense amounts for this user.
        $group: {
          _id: '$userid',
          total: { $sum: '$sum' },
        },
      },
    ]);

    // The endpoint returns a summary, not every cost row.
    res.json({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      total: costSummary[0]?.total || 0,
    });
  } catch (error) {
    // Route errors are passed to the error middleware.
    next(error);
  }
});

// User route processing ends before this point.
// This middleware handles errors from all user routes.
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
    logger.fatal({ err: error }, 'Failed to start users service');
    process.exit(1);
  });
