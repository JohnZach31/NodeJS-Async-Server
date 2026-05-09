const mongoose = require('mongoose');

// Defines the user document structure in MongoDB.
const userSchema = new mongoose.Schema(
  {
    // The assignment uses a numeric id instead of MongoDB _id.
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    // Stores the user's first name without extra spaces.
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    // Stores the user's last name without extra spaces.
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    // Birthday is stored as a Date object.
    birthday: {
      type: Date,
      required: true,
    },
  },
  {
    // Hide __v and keep createdAt/updatedAt timestamps.
    versionKey: false,
    timestamps: true,
  }
);

// Reuses the model when files are loaded more than once.
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
