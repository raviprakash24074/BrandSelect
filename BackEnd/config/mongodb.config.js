// backend/config/mongodb.config.js
const mongoose = require('mongoose');
const peterEnglandConfig = {
  url: 'mongodb://127.0.0.1:27017/Peter_England',
  database:'Peter_England'
};

const createMongoConnection = async () => {
  try {
    const connection=await mongoose.connect(peterEnglandConfig.url);
    console.log('MongoDB connected on port 27017');
    return connection.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

module.exports = {
  peterEnglandConfig,
  createMongoConnection
};