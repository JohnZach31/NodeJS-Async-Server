const mongoose = require('mongoose');

// These are the only categories accepted by the assignment.
const allowedCategories = ['food', 'health', 'housing', 'sports', 'education'];

// Defines how every cost item is saved in MongoDB.
const costSchema = new mongoose.Schema(
  {
    // References the numeric user id from the users collection.
    userid: {     
      type: Number,
      required: true,
      index: true,
    },
    // Description explains what the user paid for.
    description: {
      type: String,
      required: true,
      trim: true,
    },
    // Category describes the type of expense.
    category: {
      type: String,
      required: true,
      enum: allowedCategories,
      // Mongoose checks the enum before saving.
      // The schema rejects categories outside the list.
      // Lowercase keeps category values consistent.
      lowercase: true,
      // Trim removes extra spaces from category values.
      trim: true,
    },
    // Sum must be a positive number or zero.
    sum: {
      type: Number,
      required: true,
      min: 0,
    },
    // Cost creation time is stored with the cost.
    // Date defaults to the time the cost is created.
    date: {
      type: Date,
      default: Date.now,
    },
  },
  // The following object changes schema behavior.
  // Schema metadata configuration starts here.
  // Second schema argument contains schema options.
  {
    // Options apply to every cost document.
    // Timestamps add createdAt and updatedAt automatically.
    // Schema options control metadata fields.
    // Hide __v and keep createdAt/updatedAt timestamps.
    versionKey: false,
    timestamps: true,
  }
);

// Exports both the model and the category list.
module.exports = {
  Cost: mongoose.models.Cost || mongoose.model('Cost', costSchema),
  allowedCategories,
};
