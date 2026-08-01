import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const notImplemented = (res: Response) => sendError(res, 'Not implemented', 501);

const createReview = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const updateReview = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const deleteReview = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const listReviews = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

export { createReview, updateReview, deleteReview, listReviews };
