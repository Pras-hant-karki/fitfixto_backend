import type { Server } from 'http';
import app from './app';
import env from './config/env';
import { connectDB, disconnectDB } from './config/database';

let server: Server | null = null;

export const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    server = app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });

    const gracefulShutdown = async (signal: NodeJS.Signals): Promise<void> => {
      console.info(`Received ${signal}. Shutting down gracefully...`);

      if (server) {
        server.close(async () => {
          await disconnectDB();
          process.exit(0);
        });
      } else {
        await disconnectDB();
        process.exit(0);
      }
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};
