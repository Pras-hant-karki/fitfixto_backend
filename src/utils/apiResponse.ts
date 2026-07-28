import { Response } from 'express';

interface ApiResponseOptions<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
  code?: string;
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  options: ApiResponseOptions<T>
): Response => {
  return res.status(statusCode).json({
    success: options.success,
    message: options.message,
    data: options.data,
    error: options.error,
    ...(options.code ? { code: options.code } : {}),
  });
};

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200
): Response => {
  return sendResponse(res, statusCode, {
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  error?: unknown,
  code?: string
): Response => {
  return sendResponse(res, statusCode, {
    success: false,
    message,
    error,
    code,
  });
};
