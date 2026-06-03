const mongoose = require('mongoose');
const { connectToDatabase } = require('../db');
const User = require('../models/User');
const { Cost } = require('../models/Cost');

// Required imaginary user for the final submission state.
const imaginaryUser = {
  id: 123123,
  first_name: 'mosh',
  last_name: 'israeli',
  birthday: new Date('2000-01-01'),
};

// Deletes all documents from a collection only when it exists.
const clearCollectionIfExists = async (collectionName) => {
  const collectionExists = await mongoose.connection.db
    .listCollections({ name: collectionName })
    .hasNext();

  // Skip deleteMany when MongoDB does not have that collection yet.
  if (collectionExists) {
    await mongoose.connection.collection(collectionName).deleteMany({});
  }
};

// Keeps only the single required user and removes all other project data.
const resetSubmissionDatabase = async () => {
  await connectToDatabase();

  // Delete all costs because the submitted database should be almost empty.
  await Cost.deleteMany({});

  // Delete every user except the required imaginary user.
  await User.deleteMany({ id: { $ne: imaginaryUser.id } });

  // Insert or refresh the required imaginary user document.
  await User.findOneAndUpdate(
    { id: imaginaryUser.id },
    imaginaryUser,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  // Remove cached reports and logs collections when they exist.
  await clearCollectionIfExists('reports');
  await clearCollectionIfExists('logs');

  // Close the connection after finishing the cleanup.
  await mongoose.connection.close();
  console.log('Submission database reset completed');
};

resetSubmissionDatabase().catch(async (error) => {
  console.error(error);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  process.exit(1);
});
