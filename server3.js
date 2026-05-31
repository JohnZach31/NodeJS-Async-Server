const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const pino = require('pino');
// Import shared database and model modules.
const { connectToDatabase } = require('./db');
const User = require('./models/User');
const { Cost, allowedCategories } = require('./models/Cost');
const Log = require('./models/Log');

// Costs service owns expenses and monthly reports.
// Service settings are loaded from the environment.
const port = Number(process.env.PORT3) || 3003;
const serviceName = 'costs-service';
const reportCategoryOrder = ['food', 'education', 'health', 'housing', 'sports'];

const app = express();
const logger = pino({ name: serviceName });

// Allows the service to read JSON request bodies.
app.use(express.json());

/*
 * Computed Design Pattern implementation:
 * reports for months that already ended are computed once, saved in the
 * reports collection, and returned from that collection in later requests.
 */
// Report documents cache old monthly reports.
const reportSchema = new mongoose.Schema(
  {
    userid: { type: Number, required: true, index: true },
    // Year and month identify the report period.
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, index: true },
    // Report stores the final grouped JSON result.
    report: { type: Object, required: true },
  },
  {
    // Report documents do not need the __v version field.
    versionKey: false,
    timestamps: true,
  }
);

// Only one cached report is allowed per user, year and month.
reportSchema.index({ userid: 1, year: 1, month: 1 }, { unique: true });

const Report =
  mongoose.models.Report || mongoose.model('Report', reportSchema, 'reports');

// Creates a normal Error object with an HTTP status code.
const createHttpError = (message, statusCode) => {
  const error = new Error(message);

  // The error middleware reads this property.
  error.statusCode = statusCode;
  return error;
};

// Checks whether a value can be used as a number.
const isValidNumber = (value) =>
  value !== undefined && value !== null && Number.isFinite(Number(value));

// Checks whether the given value is a non-empty string.
const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

// Returns true when the given date is before today.
const isPastDate = (dateValue) => {
  const date = new Date(dateValue);
  const today = new Date();

  // Compare only the calendar date, not the current hour.
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return date < today;
};

// Request logging is repeated in every service.
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

// Builds the exact grouped report shape required by the assignment.
const buildReportSkeleton = (userId, year, month) => ({
  userid: userId,
  year,
  month,
  // Every category exists even when it has no costs.
  costs: reportCategoryOrder.map((category) => ({ [category]: [] })),
});

// A report is cacheable only when the month is fully in the past.
const isPastMonth = (year, month) => {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  // Old months are safe to cache.
  // Current and future months are not cached.
  return year < currentYear || (year === currentYear && month < currentMonth);
};

// Converts raw cost items into the grouped response structure.
const buildComputedReport = (userId, year, month, costs) => {
  const report = buildReportSkeleton(userId, year, month);

  // Each item is placed under its matching category.
  costs.forEach((item) => {
    const categoryGroup = report.costs.find((group) => group[item.category]);

    // Category group exists because categories are validated on insert.
    categoryGroup[item.category].push({
      sum: item.sum,
      description: item.description,
      // Report item stores only the day number.
      day: new Date(item.date).getUTCDate(),
    });
  });

  // Helper output is used directly as the API response.
  // No database writes happen inside this helper.
  // Return the grouped report object to the route.
  return report;
};

// The add endpoint receives JSON from the client.
// The request body contains userid, description, category, sum and date.
// This endpoint receives one expense item.
// Creates a new cost item for an existing user.
app.post('/api/add', async (req, res, next) => {
  try {
    const { userid, description, category, sum, date } = req.body;

    // Required fields must be present and valid.
    if (!isValidNumber(userid)) {
      throw createHttpError('userid must be a valid number', 400);
    }

    // Description must explain the cost item.
    if (!isNonEmptyString(description)) {
      throw createHttpError('description must be a non-empty string', 400);
    }

    // Sum must be numeric and cannot be negative.
    if (!isValidNumber(sum) || Number(sum) < 0) {
      throw createHttpError('sum must be a non-negative number', 400);
    }

    // Category is validated before saving.
    // Category must match the assignment categories.
    if (!allowedCategories.includes(String(category).toLowerCase())) {
      throw createHttpError(
        `Category must be one of: ${allowedCategories.join(', ')}`,
        400
      );
    }

    // Date is optional; missing date uses the schema default.
    if (date !== undefined) {
      const parsedDate = new Date(date);

      // Date must be valid when the client sends it.
      if (Number.isNaN(parsedDate.getTime())) {
      throw createHttpError('date must be a valid date', 400);
      }

      // Past dates are rejected by project requirements.
      if (isPastDate(parsedDate)) {
        throw createHttpError('Cannot add costs with dates in the past', 400);
      }
    }

    // Existing user validation starts here.
    // The next query verifies the user reference.
    // The user id in the cost must match a saved user.
    // User existence is checked before saving the cost.
    // Costs can only be added for users that exist.
    const userExists = await User.exists({ id: userid });

    if (!userExists) {
      throw createHttpError('Cannot add a cost for a non-existing user', 404);
    }

    // The cost document is created after all checks pass.
    // Save the new cost document in MongoDB.
    // The cost is saved only after validation passes.
    // Mongoose validates the required cost fields.
    const createdCost = await Cost.create({
      userid: Number(userid),
      description,
      // Category is normalized by the schema.
      category,
      sum: Number(sum),
      date,
    });

    // Created costs are returned with status 201.
    res.status(201).json(createdCost);
  } catch (error) {
    // Endpoint errors are normalized before response.
    // All add-cost errors are handled in one place.
    // Error handling keeps response codes clear.
    // The next block converts schema errors to client errors.
    // Normalize validation errors to HTTP 400.
    // Mongoose validation errors should not return 500.
    // Validation errors are client input errors.
    if (error.name === 'ValidationError') {
      error.statusCode = 400;
    }

    // Pass the error to the shared middleware.
    next(error);
  }
});

// The report endpoint returns a grouped monthly result.
// The report response is grouped by category.
// This endpoint receives id, year and month in the query string.
// Returns a monthly grouped report for one user.
app.get('/api/report', async (req, res, next) => {
  try {
    const userId = Number(req.query.id);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    // Report query validation starts here.
    // All report query parameters must be numeric.
    if (![userId, year, month].every(Number.isFinite)) {
      throw createHttpError('Query parameters id, year and month must be numbers', 400);
    }

    // Month values must follow the calendar range.
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw createHttpError('Month must be between 1 and 12', 400);
    }

    // Year should not contain decimal values.
    if (!Number.isInteger(year)) {
      throw createHttpError('year must be an integer', 400);
    }

    // User lookup happens after basic query validation.
    // Reports are available only for existing users.
    const userExists = await User.exists({ id: userId });

    if (!userExists) {
      throw createHttpError('User not found', 404);
    }

    // Past months can use cached report documents.
    // Cache behavior depends on whether the month is old.
    // Decide whether this month can use cached data.
    const shouldUseCache = isPastMonth(year, month);

    // Historical reports may already exist in cache.
    // Check the reports collection before computing again.
    // Cache is used only for months that already ended.
    // Old reports can be returned from the reports collection.
    if (shouldUseCache) {
      const cachedReport = await Report.findOne({
        userid: userId,
        // Cache key is user id, year and month.
        year,
        month,
      }).lean();

      if (cachedReport) {
        // Cached reports are already in the correct response shape.
        return res.json(cachedReport.report);
      }
    }

    // Compute the report when no cached result exists.
    // The next values define the MongoDB date filter.
    // The end date is the first day of the next month.
    // Dates are calculated as an inclusive-exclusive range.
    // Date range covers the requested month in UTC time.
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));

    // Finds all costs for the user inside the requested month.
    const costs = await Cost.find({
      userid: userId,
      date: {
        // Include the first day and exclude the next month.
        $gte: monthStart,
        $lt: monthEnd,
      },
    })
      .sort({ date: 1, _id: 1 })
      .lean();

    // Build the final report from the database rows.
    const report = buildComputedReport(userId, year, month, costs);

    // Historical reports are stable enough to store.
    // Only historical report results are stored.
    // Current and future reports are not cached.
    // Saves historical reports for faster future access.
    if (shouldUseCache) {
      await Report.findOneAndUpdate(
        {
          userid: userId,
          // Cache key is user id, year and month.
          year,
          month,
        },
        {
          // The computed report is stored as one object.
          userid: userId,
          year,
          month,
          report,
        },
        {
          // Upsert makes this operation idempotent.
          upsert: true,
          new: true,
          // Update options are kept explicit for readability.
          // The same call handles create and update.
          // Upsert options control insert/update behavior.
          // Upsert creates a new cache row when needed.
          // New cache documents should use schema defaults.
          // Defaults are applied when a new cache row is created.
          // Keeps insert behavior aligned with the schema.
          setDefaultsOnInsert: true,
        }
      );
    }

    // Send the computed report to the client.
    res.json(report);
  } catch (error) {
    // Route errors are passed to the error middleware.
    next(error);
  }
});

// Cost route processing ends before this point.
// This middleware handles errors from all cost routes.
// All thrown errors arrive here.
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
    logger.fatal({ err: error }, 'Failed to start costs service');
    process.exit(1);
  });
