import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/app.constants';
import { sendError } from '../utils/apiResponse';

export const notFoundHandler = (req: Request, res: Response): Response => {
  return sendError(
    res,
    `Route ${req.originalUrl} not found`,
    HTTP_STATUS.NOT_FOUND
  );
};
