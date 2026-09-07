import mongoose from 'mongoose';
import { config } from './config.js';

export const connectDatabase = async () => {
  if (!config.mongodbUri) {
    console.info('[database] MONGODB_URI not set; using in-memory persistence.');
    return false;
  }

  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 5000
  });
  console.info('[database] connected to MongoDB.');
  return true;
};
