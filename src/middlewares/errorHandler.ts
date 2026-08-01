import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../constants/app.constants';
import { sendError } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, isDevelopment ? err.stack : undefined);
    return;
  }

  console.error('Unhandled error:', err);
  sendError(
    res,
    'Internal server error',
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    isDevelopment ? err.stack : undefined
  );
};

export default errorHandler;
