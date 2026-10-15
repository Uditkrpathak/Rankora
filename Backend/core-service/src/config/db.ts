import mongoose from 'mongoose';
import { ENV } from './env';

export const MONGO_POOL_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize: 10,              // Max 10 connections
  minPoolSize: 2,               // Min 2 idle connections
  maxIdleTimeMS: 60000,         // Recycle after 60s idle
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 10000,
  autoIndex: true,
  retryWrites: true,
  retryReads: true,
};

let listenersAttached = false;

function attachMongoListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    console.warn('[Mongo] Connection disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[Mongo] Connection restored');
  });

  mongoose.connection.on('error', (err: Error) => {
    console.error('[Mongo] Connection error:', err.message);
  });
}

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    attachMongoListeners();
    await mongoose.connect(ENV.MONGO_URI, MONGO_POOL_OPTIONS);
    console.log('✅ Connected to MongoDB Atlas (localseo_core) successfully');
  } catch (err: any) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

