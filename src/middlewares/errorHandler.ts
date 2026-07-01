import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
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

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded image is too large. Please choose an image under the configured file size limit.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unexpected upload field. Please upload product images using the images field.'
          : err.message;

    sendError(res, message, HTTP_STATUS.BAD_REQUEST, isDevelopment ? err.stack : undefined);
    return;
  }

  const databaseError = err as Error & {
    code?: number;
    keyPattern?: Record<string, number>;
  };

  if (databaseError.code === 11000) {
    const field = Object.keys(databaseError.keyPattern || {})[0] || 'value';
    sendError(
      res,
      `An account with this ${field} already exists. Please use a different ${field}.`,
      HTTP_STATUS.CONFLICT,
      isDevelopment ? err.stack : undefined
    );
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
