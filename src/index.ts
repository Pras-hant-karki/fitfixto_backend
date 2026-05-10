/// <reference types="node" />
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB } from '@config/database';
import env from '@config/env';
import errorHandler from '@middlewares/errorHandler';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes (will be added later)
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/products', productRoutes);
// etc.

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    statusCode: 404,
  });
});

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start server
    app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

export { app, startServer };

// Only start if this is the main module
if (require.main === module) {
  startServer();
}
