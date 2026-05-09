const { connectToDatabase } = require('../db');
const User = require('../models/User');

// Required imaginary user for final submission.
const imaginaryUser = {
  id: 123123,
  first_name: 'mosh',
  last_name: 'israeli',
};

// Inserts or updates the single required user.
const seedImaginaryUser = async () => {
  await connectToDatabase();

  // Birthday is required by the schema although the guideline lists only names.
  await User.findOneAndUpdate(
    { id: imaginaryUser.id },
    {
      ...imaginaryUser,
      birthday: new Date('2000-01-01'),
    },
    // Upsert keeps the seed script safe to run more than once.
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  // Print a short success message for the terminal.
  // Close the connection after the seed is done.
  await User.db.close();
  console.log('Imaginary user is ready');
};

seedImaginaryUser().catch((error) => {
  console.error(error);
  process.exit(1);
});
