import mongoose from 'mongoose';
import env from './env';

const connectDB = async (): Promise<void> => {
  try {
    const uri = env.NODE_ENV === 'test' ? env.MONGODB_TEST_URI : env.MONGODB_URI;

    await mongoose.connect(uri);

    console.log(`MongoDB connected successfully to ${uri}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
    process.exit(1);
  }
};

export { connectDB, disconnectDB };
