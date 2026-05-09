const mongoose = require('mongoose');

// Defines a saved HTTP request log.
const logSchema = new mongoose.Schema(
  {
    // Each request receives a unique tracking id.
    request_id: {
      type: String,
      required: true,
      index: true,
    },
    // Service stores the logical service name.
    service: {
      type: String,
      required: true,
      trim: true,
    },
    // Service identifies logs from server1, server2, server3 or server4.
    // Service name shows which server handled the request.
    // HTTP method is saved, for example GET or POST.
    // Request details help debug the different services.
    method: {
      type: String,
      required: true,
      trim: true,
    },
    // Path stores the URL path that was requested.
    path: {
      type: String,
      required: true,
      trim: true,
    },
    // Query is saved separately from the path.
    // Request path is stored without losing query details.
    // Path and query together describe the URL.
    // Query parameters are stored as a plain object.
    query: {
      type: Object,
      default: {},
    },
    // Body is saved so POST requests can be reviewed.
    body: {
      type: Object,
      default: {},
    },
    // Client network data is optional.
    ip: {
      type: String,
      default: '',
    },
    // User agent identifies the client tool or browser.
    user_agent: {
      type: String,
      default: '',
    },
    // Response details show whether the request succeeded.
    status_code: {
      type: Number,
      required: true,
    },
    // Response time is measured in milliseconds.
    response_time_ms: {
      type: Number,
      required: true,
    },
  },
  // Second schema argument contains schema options.
  {
    // Options apply to every log document.
    // Timestamps add createdAt and updatedAt automatically.
    // Schema options control metadata fields.
    // Hide __v and keep createdAt/updatedAt timestamps.
    versionKey: false,
    timestamps: true,
  }
);

// Reuses the model if it was already registered.
module.exports = mongoose.models.Log || mongoose.model('Log', logSchema);
