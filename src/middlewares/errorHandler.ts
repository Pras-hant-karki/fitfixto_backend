import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

interface ErrorResponse {
  success: boolean;
  message: string;
  statusCode: number;
  error?: unknown;
}

const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      message: err.message,
      statusCode: err.statusCode,
    };

    if (isDevelopment) {
      response.error = err;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  const response: ErrorResponse = {
    success: false,
    message: 'Internal server error',
    statusCode: 500,
  };

  if (isDevelopment) {
    response.error = {
      message: err.message,
      stack: err.stack,
    };
  }

  console.error('Unhandled error:', err);
  res.status(500).json(response);
};

export default errorHandler;
